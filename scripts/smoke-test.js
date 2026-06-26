/**
 * PerStream — self-contained smoke test
 *
 * Boots the server in-process (via app.listen), hits every endpoint,
 * asserts the responses, then exits cleanly. No hanging servers.
 */

process.env.PORT = process.env.PORT || '3099';
process.env.PAYMENTS_MODE = process.env.PAYMENTS_MODE || 'mock';
process.env.NODE_ENV = 'test';

const http = require('http');
const path = require('path');
const fs = require('fs');

// Reset DB for fresh test
const DB_PATH = path.join(__dirname, '..', 'backend', 'data', 'test.db');
try { fs.unlinkSync(DB_PATH); } catch {}
try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}

process.env.DB_PATH = DB_PATH;
process.env.AUDIO_DIR = path.join(__dirname, '..', 'backend', 'data', 'test-audio');
process.env.PUBLIC_BASE_URL = `http://localhost:${process.env.PORT}`;

const app = require('../backend/src/server.js');

const server = app.listen(process.env.PORT, async () => {
  console.log(`\n[test] server on :${process.env.PORT}`);
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
    // First create a track via direct DB (since we don't have file upload)
    const db = require('../backend/src/db');
    const track = db.createTrack({
      creatorId,
      title: 'Smoke test track',
      description: 'Test',
      audioUrl: '/api/tracks/audio/test.mp3',
      durationSec: 30,
      pricePerSec: 300, // 0.0003 USDC
    });

    const r = await req('GET', `/api/tracks/${track.id}/stream`);
    if (r.status === 402 && r.headers['x-perstream-price'] === '300') {
      pass(`GET /api/tracks/:id/stream → 402 (price: ${r.headers['x-perstream-price']} micro-USDC)`);
    } else fail('GET 402', `status=${r.status}, body=${JSON.stringify(r.body)}`);
  } catch (e) { fail('GET 402', e.message); }

  // 5. Login listener
  let listenerId, listenerWallet;
  try {
    const r = await req('POST', '/api/auth/login', { email: 'test-listener@perstream.fm' });
    if (r.status === 200 && r.body.user) {
      listenerId = r.body.user.id;
      listenerWallet = r.body.user.wallet;
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
    const db = require('../backend/src/db');
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

  console.log(`\n[test] ${passed} passed, ${failures} failed\n`);
  server.close();
  process.exit(failures > 0 ? 1 : 0);
});