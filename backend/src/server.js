/**
 * PerStream Backend Server
 *
 * Endpoints:
 *   GET    /api/health
 *   POST   /api/auth/login             { email, handle? }         → { user, wallet }
 *   GET    /api/auth/me                                          → { user }
 *   GET    /api/tracks                                           → tracks[]
 *   POST   /api/tracks                 multipart: audio file     → { track }
 *   GET    /api/tracks/:id                                      → track
 *   GET    /api/tracks/:id/stream        (x402)                  → audio chunks OR 402
 *   POST   /api/listen/start           { trackId }              → { sessionId, pricePerSec }
 *   POST   /api/listen/stop            { sessionId }            → { totalPaid, duration }
 *   POST   /api/listen/deposit         { amount }               → { balance }
 *   GET    /api/creator/dashboard                                 → { earnings, tracks, sessions }
 *   GET    /api/creator/withdraw       ?amount=...              → { withdrawn }
 *
 * The x402 flow:
 *   - GET /api/tracks/:id/stream without an active session returns:
 *       HTTP/1.1 402 Payment Required
 *       X-PerStream-Price: 300                  (micro-USDC per second)
 *       X-PerStream-Creator: 0x...
 *       X-PerStream-Track-Id: trk_...
 *   - The frontend then opens a listening session via /api/listen/start,
 *     and ticks once per second via the meter.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const wallet = require('./wallet');
const meter = require('./meter');
const arc = require('./arc');

const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const AUDIO_DIR = process.env.AUDIO_DIR || path.join(__dirname, '..', 'data', 'audio');
const MAX_AUDIO_BYTES = parseInt(process.env.MAX_AUDIO_BYTES || '52428800', 10);

// ───────────────────────────────────────────────
// Setup
// ───────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Rate limit
app.use('/api/', rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Audio upload dir
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: AUDIO_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp3';
      cb(null, `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_AUDIO_BYTES },
});

// ───────────────────────────────────────────────
// Auth helper (lightweight — uses X-User-Id header)
// ───────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ error: 'missing_user_id' });
  const user = db.getUser(userId);
  if (!user) return res.status(401).json({ error: 'unknown_user' });
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const userId = req.header('x-user-id');
  if (userId) {
    req.user = db.getUser(userId);
  }
  next();
}

// ───────────────────────────────────────────────
// Routes
// ───────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'perstream-backend',
    mode: arc.MODE,
    meter: { active: meter.active() },
    time: Date.now(),
  });
});

// ─── Auth ───

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, handle } = req.body || {};
    if (!email && !handle) {
      return res.status(400).json({ error: 'email_or_handle_required' });
    }

    // Find or create user
    let user = email ? db.getUserByEmail(email) : null;
    if (!user && handle) user = db.getUserByHandle(handle);

    if (!user) {
      const prov = await wallet.provisionWallet({
        email,
        handle: handle || (email ? email.split('@')[0] : null),
        userId: null,
      });
      user = db.createUser({
        handle: handle || (email ? email.split('@')[0] : `user_${Date.now()}`),
        email,
        wallet: prov.wallet,
        role: 'listener',
      });
    }

    res.json({ user, wallet: { address: user.wallet, mode: wallet.MODE } });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ─── Tracks ───

app.get('/api/tracks', (req, res) => {
  const tracks = db.listTracks();
  res.json({ tracks });
});

app.get('/api/tracks/:id', (req, res) => {
  const track = db.getTrack(req.params.id);
  if (!track) return res.status(404).json({ error: 'track_not_found' });
  const creator = db.getUser(track.creator_id);
  res.json({
    track: {
      ...track,
      audio_url: makeAbsoluteUrl(track.audio_url),
      creator: creator ? { id: creator.id, handle: creator.handle, wallet: creator.wallet } : null,
    },
  });
});

app.post('/api/tracks', authMiddleware, upload.single('audio'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio_file_required' });
    if (req.user.role !== 'creator' && req.user.role !== 'listener') {
      // Auto-promote to creator on first upload
      // (skipped — left as a flag for v2: db.db.prepare("UPDATE users SET role='creator' WHERE id=?").run(req.user.id))
    }

    const { title, description = '', pricePerSecUsd = '0.0003', durationSec = 0 } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title_required' });

    const priceMicroUsdc = arc.usdToMicro(parseFloat(pricePerSecUsd));
    const audioUrl = `/api/tracks/audio/${path.basename(req.file.path)}`;

    const track = db.createTrack({
      creatorId: req.user.id,
      title,
      description,
      audioUrl,
      durationSec: parseInt(durationSec, 10) || 0,
      pricePerSec: priceMicroUsdc,
    });

    res.json({ track });
  } catch (err) {
    console.error('upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tracks/audio/:filename', (req, res) => {
  const filePath = path.join(AUDIO_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

// ─── x402-protected stream endpoint ───

app.get('/api/tracks/:id/stream', optionalAuth, (req, res) => {
  const track = db.getTrack(req.params.id);
  if (!track) return res.status(404).json({ error: 'track_not_found' });

  // Without an active session, return x402 Payment Required
  if (!req.user) {
    return send402(res, {
      pricePerSec: track.price_per_sec,
      creator: track.creator_id,
      trackId: track.id,
      durationSec: track.duration_sec,
    });
  }

  // With a user, return 402 if they have no deposit OR no active session
  const balance = arc.getListenerBalance(req.user.wallet);
  if (balance < track.price_per_sec) {
    return send402(res, {
      pricePerSec: track.price_per_sec,
      creator: track.creator_id,
      trackId: track.id,
      durationSec: track.duration_sec,
      reason: 'no_deposit',
      balanceMicroUsdc: balance,
    });
  }

  // OK — return audio info (the actual streaming is client-side via audio_url)
  res.json({
    ok: true,
    trackId: track.id,
    audioUrl: makeAbsoluteUrl(track.audio_url),
    pricePerSec: track.price_per_sec,
    durationSec: track.duration_sec,
  });
});

function send402(res, info) {
  res.status(402)
    .set('X-PerStream-Price', String(info.pricePerSec))
    .set('X-PerStream-Price-Usd', String(arc.microToUsd(info.pricePerSec)))
    .set('X-PerStream-Creator', String(info.creator))
    .set('X-PerStream-Track-Id', String(info.trackId))
    .set('X-PerStream-Duration', String(info.durationSec))
    .json({
      error: 'payment_required',
      message: 'PerStream x402: pay per second of audio playback',
      pricePerSec: info.pricePerSec,
      pricePerSecUsd: arc.microToUsd(info.pricePerSec),
      creator: info.creator,
      trackId: info.trackId,
      durationSec: info.durationSec,
      reason: info.reason,
      balanceMicroUsdc: info.balanceMicroUsdc,
    });
}

// ─── Listening sessions ───

app.post('/api/listen/start', authMiddleware, (req, res) => {
  const { trackId } = req.body || {};
  if (!trackId) return res.status(400).json({ error: 'track_id_required' });

  const track = db.getTrack(trackId);
  if (!track) return res.status(404).json({ error: 'track_not_found' });

  const creator = db.getUser(track.creator_id);
  const session = db.openSession({
    trackId,
    listenerId: req.user.id,
    creatorId: creator.id,
    pricePerSec: track.price_per_sec,
  });

  // Start meter
  meter.start(session);

  res.json({
    sessionId: session.id,
    trackId,
    pricePerSec: track.price_per_sec,
    pricePerSecUsd: arc.microToUsd(track.price_per_sec),
  });
});

app.post('/api/listen/stop', authMiddleware, (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'session_id_required' });

  meter.stop(sessionId);
  const session = db.getSession(sessionId);
  res.json({
    session,
    totalPaidUsd: arc.microToUsd(session?.amount_paid || 0),
  });
});

// Public poll endpoint — lets the frontend tick its display once per second
// without needing auth (the meter runs server-side).
app.get('/api/listen/poll', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'session_id_required' });

  const session = db.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });

  // Get creator's wallet to compute listener's remaining balance via mock ledger
  const creator = db.getUser(session.creator_id);
  const balance = arc.getListenerBalance(
    db.getUser(session.listener_id)?.wallet || ''
  );

  res.json({
    tick: session.active === 1,
    secondsPlayed: session.seconds_played,
    amountPaid: session.amount_paid,
    balance: balance,
  });
});

app.post('/api/listen/deposit', authMiddleware, async (req, res) => {
  const { amountUsd } = req.body || {};
  const amount = parseFloat(amountUsd);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'amount_usd_required' });
  }

  const amountMicroUsdc = arc.usdToMicro(amount);
  const result = await arc.deposit({
    listener: req.user.wallet,
    amountMicroUsdc,
  });

  res.json(result);
});

// ─── Creator dashboard ───

app.get('/api/creator/dashboard', authMiddleware, (req, res) => {
  const tracks = db.listTracks({ creatorId: req.user.id });
  const earningsTotal = arc.getCreatorEarnings(req.user.wallet);
  const dbEarningsTotal = db.getCreatorEarnings(req.user.id);

  // Per-track analytics
  const trackStats = tracks.map((t) => ({
    ...t,
    earningsLive: arc.getCreatorEarnings(req.user.wallet),
    sessionsActive: db.getActiveSessionsForTrack(t.id).length,
  }));

  res.json({
    creator: req.user,
    earningsLive: arc.microToUsd(earningsTotal),
    earningsRecorded: arc.microToUsd(dbEarningsTotal),
    tracks: trackStats,
  });
});

app.post('/api/creator/withdraw', authMiddleware, async (req, res) => {
  const { amountUsd } = req.body || {};
  const amount = parseFloat(amountUsd);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount_usd_required' });

  const result = await arc.withdraw({
    creator: req.user.wallet,
    amountMicroUsdc: arc.usdToMicro(amount),
  });

  res.json(result);
});

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

function makeAbsoluteUrl(urlOrPath) {
  if (!urlOrPath) return urlOrPath;
  if (urlOrPath.startsWith('http')) return urlOrPath;
  return `${PUBLIC_BASE_URL}${urlOrPath}`;
}

// ───────────────────────────────────────────────
// Boot (only when run directly, not when imported for tests)
// ───────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ╔════════════════════════════════════╗`);
    console.log(`  ║   PerStream backend · running      ║`);
    console.log(`  ║   http://localhost:${PORT}             ║`);
    console.log(`  ║   mode: ${arc.MODE.padEnd(28)}║`);
    console.log(`  ╚════════════════════════════════════╝\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[meter] shutting down, stopping all sessions...');
    meter.stopAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    meter.stopAll();
    process.exit(0);
  });
}

module.exports = app;