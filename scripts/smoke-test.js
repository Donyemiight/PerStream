/**
 * PerStream — self-contained smoke test
 *
 * Boots the server in-process, hits every endpoint, asserts responses, exits.
 */

process.env.PORT = process.env.PORT || '3099';
process.env.PAYMENTS_MODE = process.env.PAYMENTS_MODE || 'mock';
process.env.NODE_ENV = 'test';

// Count expected tests for self-check
const EXPECTED_TESTS = 16;
console.log(`[smoke] running ${EXPECTED_TESTS} tests against http://localhost:${process.env.PORT}`);

const http = require('http');
const path = require('path');
const fs = require('fs');

// Reset DB for fresh test
const DB_PATH = path.join(__dirname, '..', 'backend', 'data', 'test.db');
try { fs.unlinkSync(DB_PATH); } catch {}
process.env.DB_PATH = DB_PATH;
process.env.AUDIO_DIR = path.join(__dirname, '..', 'backend', 'data', 'test-audio');
process.env.PUBLIC_BASE_URL = `http://localhost:${process.env.PORT}`;

const db = require('../backend/src/db');
const app = require('../backend/src/server.js');

let failures = 0;
let passed = 0;

function pass(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, err) { failures++; console.log(`  ❌ ${name} — ${err}`); }

function req(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'localhost',
      port: process.env.PORT,
      path: urlPath,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };
    const r = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, text });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  await db.ready();
  const server = await new Promise((resolve) => {
    const s = app.listen(process.env.PORT, () => resolve(s));
  });

  console.log(`\n[test] server on :${process.env.PORT}`);

  // 1. Health
  try {
    const r = await req('GET', '/api/health');
    if (r.status === 200 && r.body.ok) pass('GET /api/health');
    else fail('GET /api/health', JSON.stringify(r));
  } catch (e) { fail('GET /api/health', e.message); }

  // 2. List tracks (empty)
  try {
    const r = await req('GET', '/api/tracks');
    if (r.status === 200 && Array.isArray(r.body.tracks)) pass('GET /api/tracks (empty)');
    else fail('GET /api/tracks', JSON.stringify(r));
  } catch (e) { fail('GET /api/tracks', e.message); }

  // 3. Login creator
  let creatorId, creatorWallet;
  try {
    const r = await req('POST', '/api/auth/login', { email: 'test-creator@perstream.fm' });
    if (r.status === 200 && r.body.user) {
      creatorId = r.body.user.id;
      creatorWallet = r.body.user.wallet;
      pass(`POST /api/auth/login → user ${creatorId.slice(-6)}, wallet ${creatorWallet.slice(0, 10)}…`);
    } else fail('POST /api/auth/login', JSON.stringify(r));
  } catch (e) { fail('POST /api/auth/login', e.message); }

  // 4. x402 stream without auth → 402
  try {
    const track = db.createTrack({
      creatorId,
      title: 'Smoke test track',
      description: 'Test',
      audioUrl: '/api/tracks/audio/test.mp3',
      durationSec: 30,
      pricePerSec: 300,
    });

    const r = await req('GET', `/api/tracks/${track.id}/stream`);
    if (r.status === 402 && r.headers['x-perstream-price'] === '300') {
      pass(`GET /api/tracks/:id/stream → 402 (price: ${r.headers['x-perstream-price']} micro-USDC)`);
    } else fail('GET 402', `status=${r.status}, body=${JSON.stringify(r.body)}`);
  } catch (e) { fail('GET 402', e.message); }

  // 5. Login listener
  let listenerId;
  try {
    const r = await req('POST', '/api/auth/login', { email: 'test-listener@perstream.fm' });
    if (r.status === 200 && r.body.user) {
      listenerId = r.body.user.id;
      pass(`POST /api/auth/login (listener) → user ${listenerId.slice(-6)}`);
    } else fail('login listener', JSON.stringify(r));
  } catch (e) { fail('login listener', e.message); }

  // 6. Listener deposits $1
  try {
    const r = await req('POST', '/api/listen/deposit', { amountUsd: 1 }, { 'X-User-Id': listenerId });
    if (r.status === 200 && r.body.ok) {
      pass(`POST /api/listen/deposit $1 → balance ${r.body.balance} micro-USDC`);
    } else fail('deposit', JSON.stringify(r));
  } catch (e) { fail('deposit', e.message); }

  // 7. Listener starts session
  let sessionId;
  try {
    const track = db.listTracks({ creatorId })[0];
    const r = await req('POST', '/api/listen/start', { trackId: track.id }, { 'X-User-Id': listenerId });
    if (r.status === 200 && r.body.sessionId) {
      sessionId = r.body.sessionId;
      pass(`POST /api/listen/start → session ${sessionId.slice(-6)}`);
    } else fail('start session', JSON.stringify(r));
  } catch (e) { fail('start session', e.message); }

  // 8. Wait 3 seconds, check the meter ticked
  await new Promise(r => setTimeout(r, 3500));
  try {
    const r = await req('GET', `/api/listen/poll?sessionId=${sessionId}`);
    if (r.status === 200 && r.body.tick && r.body.secondsPlayed >= 2) {
      pass(`GET /api/listen/poll → ${r.body.secondsPlayed}s played, ${r.body.amountPaid} micro-USDC paid`);
    } else fail('poll', JSON.stringify(r));
  } catch (e) { fail('poll', e.message); }

  // 9. Stop session
  try {
    const r = await req('POST', '/api/listen/stop', { sessionId }, { 'X-User-Id': listenerId });
    if (r.status === 200 && r.body.session) {
      pass(`POST /api/listen/stop → total paid ${r.body.totalPaidUsd} USDC`);
    } else fail('stop', JSON.stringify(r));
  } catch (e) { fail('stop', e.message); }

  // 10. Creator dashboard
  try {
    const r = await req('GET', '/api/creator/dashboard', null, { 'X-User-Id': creatorId });
    if (r.status === 200 && r.body.tracks && r.body.earningsLive !== undefined) {
      pass(`GET /api/creator/dashboard → earnings ${r.body.earningsLive} USDC, ${r.body.tracks.length} tracks`);
    } else fail('dashboard', JSON.stringify(r));
  } catch (e) { fail('dashboard', e.message); }

  // 11. AI Listener Agent endpoint
  try {
    const r = await req('GET', '/api/agent/info');
    if (r.status === 200 && r.body.capabilities) {
      pass(`GET /api/agent/info → ${r.body.capabilities.length} agent capabilities`);
    } else fail('agent info', JSON.stringify(r));
  } catch (e) { fail('agent info', e.message); }

  // 12. Agent auto run (with small budget to keep test fast)
  try {
    const track = db.listTracks({ creatorId })[0];
    const r = await req('POST', '/api/agent/listen', {
      trackId: track.id,
      budgetUsd: 0.005,
      maxSeconds: 3,
    });
    if (r.status === 200 && r.body.ok && r.body.secondsPlayed >= 2) {
      pass(`POST /api/agent/listen → agent ran ${r.body.secondsPlayed}s, paid $${r.body.totalPaidUsd}`);
    } else fail('agent listen', JSON.stringify(r));
  } catch (e) { fail('agent listen', e.message); }

  // 13. Submit feedback (rating + comment)
  try {
    const r = await req('POST', '/api/feedback', {
      rating: 5,
      comment: 'This is a smoke test rating',
      userEmail: 'smoke-test@perstream.fm',
      page: '/listen.html',
    });
    if (r.status === 200 && r.body.ok) {
      pass(`POST /api/feedback → rating recorded`);
    } else fail('feedback', JSON.stringify(r));
  } catch (e) { fail('feedback', e.message); }

  // 14. Get feedback stats
  try {
    const r = await req('GET', '/api/feedback/stats');
    if (r.status === 200 && typeof r.body.total === 'number' && r.body.total >= 1) {
      pass(`GET /api/feedback/stats → ${r.body.total} ratings, avg ${r.body.average}/5`);
    } else fail('feedback stats', JSON.stringify(r));
  } catch (e) { fail('feedback stats', e.message); }

  // 15. Capture early-access lead
  try {
    const r = await req('POST', '/api/lead', {
      email: 'lead-test@perstream.fm',
      role: 'podcaster',
      useCase: 'Test early access signup',
    });
    if (r.status === 200 && r.body.ok) {
      pass(`POST /api/lead → early-access signup recorded`);
    } else fail('lead', JSON.stringify(r));
  } catch (e) { fail('lead', e.message); }

  // 16. Get lead count
  try {
    const r = await req('GET', '/api/lead/count');
    if (r.status === 200 && r.body.count >= 1) {
      pass(`GET /api/lead/count → ${r.body.count} leads`);
    } else fail('lead count', JSON.stringify(r));
  } catch (e) { fail('lead count', e.message); }

  console.log(`\n[test] ${passed} passed, ${failures} failed\n`);
  db.flushSync();
  server.close();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[test] fatal:', err);
  process.exit(1);
});