/**
 * PerStream — self-contained smoke test
 *
 * Boots the server in-process, hits every endpoint, asserts responses, exits.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

process.env.PORT = process.env.PORT || '3099';
// ALWAYS mock mode for smoke test (regardless of .env)
process.env.PAYMENTS_MODE = 'mock';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'data', 'test.db');
process.env.AUDIO_DIR = process.env.AUDIO_DIR || path.join(__dirname, '..', 'backend', 'data', 'test-audio');

// Wipe ALL test data aggressively
const TEST_DB = process.env.DB_PATH;
const TEST_AUDIO = process.env.AUDIO_DIR;
try { fs.unlinkSync(TEST_DB); } catch {}
try { fs.rmSync(TEST_DB + '-journal', { force: true }); } catch {}
try { fs.rmSync(TEST_AUDIO, { recursive: true, force: true }); } catch {}
fs.mkdirSync(TEST_AUDIO, { recursive: true });

// Count expected tests for self-check
const EXPECTED_TESTS = 21;
console.log(`[smoke] running ${EXPECTED_TESTS} tests against http://localhost:${process.env.PORT}`);
console.log(`[smoke] DB: ${TEST_DB}`);

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

  // 17. Upload track via multipart POST /api/creator/tracks?status=published
  // (regression test for the v98g "Upload failed (HTTP 405)" bug)
  let publishedTrackId;
  try {
    // Build multipart/form-data manually (no deps needed)
    const boundary = '----PerStreamSmoke' + Date.now();
    const fields = {
      title: 'Publish Smoke Test',
      description: 'Verifying POST /api/creator/tracks?status=published works',
      pricePerSec: '150',
      durationSec: '30',
      category: 'smoke',
    };
    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    const audioBuf = Buffer.from('ID3fake-mp3-content-for-smoke-test');
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="smoke.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`));
    parts.push(audioBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const uploadResp = await new Promise((resolve, reject) => {
      const r = http.request({
        method: 'POST',
        hostname: 'localhost',
        port: process.env.PORT,
        path: '/api/creator/tracks?status=published',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': body.length,
          'X-User-Id': creatorId,
        },
      }, (res) => {
        let chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, body: json });
        });
      });
      r.on('error', reject);
      r.write(body);
      r.end();
    });

    if (uploadResp.status === 200 && uploadResp.body && uploadResp.body.track && uploadResp.body.track.status === 'published') {
      publishedTrackId = uploadResp.body.track.id;
      pass(`POST /api/creator/tracks?status=published → track ${publishedTrackId.slice(-6)} published (multipart)`);
    } else {
      fail('publish track', JSON.stringify(uploadResp));
    }
  } catch (e) { fail('publish track', e.message); }

  // 18. Upload DRAFT track (should NOT appear in public listing)
  let draftTrackId;
  try {
    // Build multipart manually
    const boundary = '----PerStreamDraft' + Date.now();
    const fields = {
      title: 'Draft Smoke Test',
      description: 'Should NOT appear publicly',
      pricePerSec: '150',
      durationSec: '30',
      category: 'smoke',
    };
    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    const audioBuf = Buffer.from('ID3fake-mp3-content-for-draft-test');
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="draft.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`));
    parts.push(audioBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const draftBody = Buffer.concat(parts);

    const draftResp = await new Promise((resolve, reject) => {
      const r = http.request({
        method: 'POST',
        hostname: 'localhost',
        port: process.env.PORT,
        path: '/api/creator/tracks?status=draft',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': draftBody.length,
          'X-User-Id': creatorId,
        },
      }, (res) => {
        let chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, body: json });
        });
      });
      r.on('error', reject);
      r.write(draftBody);
      r.end();
    });

    if (draftResp.status === 200 && draftResp.body?.track?.status === 'draft') {
      draftTrackId = draftResp.body.track.id;
      pass(`POST /api/creator/tracks?status=draft → track ${draftTrackId.slice(-6)} saved as draft`);
    } else {
      fail('draft upload', JSON.stringify(draftResp));
    }
  } catch (e) { fail('draft upload', e.message); }

  // 18b. Verify published track is in public listing
  try {
    const r = await req('GET', '/api/tracks');
    const hasPublished = r.body.tracks.find(t => t.id === publishedTrackId);
    const hasDraft = r.body.tracks.find(t => t.id === draftTrackId);
    if (r.status === 200 && hasPublished && !hasDraft) {
      pass(`GET /api/tracks → published visible, draft hidden (public filter works)`);
    } else fail('verify filter', `published=${!!hasPublished} draft=${!!hasDraft}`);
  } catch (e) { fail('verify filter', e.message); }

  // 18c. Verify creator's dashboard shows BOTH (including draft)
  try {
    const r = await req('GET', '/api/creator/dashboard', null, { 'X-User-Id': creatorId });
    const allMine = r.body.tracks.filter(t => t.creator_id === creatorId);
    const hasPublished = allMine.find(t => t.id === publishedTrackId);
    const hasDraft = allMine.find(t => t.id === draftTrackId);
    if (r.status === 200 && hasPublished && hasDraft) {
      pass(`GET /api/creator/dashboard → creator sees both published AND draft tracks`);
    } else fail('dashboard filter', `published=${!!hasPublished} draft=${!!hasDraft}`);
  } catch (e) { fail('dashboard filter', e.message); }

  // 19. Toggle published → draft → published via status endpoint
  try {
    const r1 = await req('POST', `/api/creator/tracks/${publishedTrackId}/status`, { status: 'draft' }, { 'X-User-Id': creatorId });
    const r2 = await req('POST', `/api/creator/tracks/${publishedTrackId}/status`, { status: 'published' }, { 'X-User-Id': creatorId });
    if (r1.status === 200 && r2.status === 200 && r2.body.track.status === 'published') {
      pass(`POST /api/creator/tracks/:id/status → publish/unpublish cycle works`);
    } else fail('toggle status', `${r1.status}/${r2.status}`);
  } catch (e) { fail('toggle status', e.message); }

  console.log(`\n[test] ${passed} passed, ${failures} failed\n`);
  db.flushSync();
  server.close();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[test] fatal:', err);
  process.exit(1);
});