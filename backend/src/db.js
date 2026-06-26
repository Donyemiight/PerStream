/**
 * PerStream Database (SQLite via sql.js — pure JavaScript, no native build)
 *
 * Three tables:
 *   - users:      listeners and creators (with embedded wallet addresses)
 *   - tracks:     audio files with per-second pricing
 *   - sessions:   active listening sessions for meter tick tracking
 *
 * sql.js is in-memory + persisted to file on every commit (acceptable for
 * hackathon, single-process). For production scale, swap to libSQL/Turso.
 *
 * Note: sql.js is synchronous like better-sqlite3 — same API feel, no Promises.
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'perstream.db');

// Ensure data dir exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let SQL = null;
let db = null;
let saveTimer = null;

/**
 * Initialise the sql.js engine + load/create the DB file.
 */
async function init() {
  if (db) return db;  // already initialized
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Schema (idempotent)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      handle        TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE,
      wallet        TEXT UNIQUE NOT NULL,
      role          TEXT NOT NULL DEFAULT 'listener',
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id              TEXT PRIMARY KEY,
      creator_id      TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT DEFAULT '',
      audio_url       TEXT NOT NULL,
      duration_sec    INTEGER NOT NULL DEFAULT 0,
      price_per_sec   INTEGER NOT NULL,
      cover_url       TEXT DEFAULT '',
      created_at      INTEGER NOT NULL,
      plays           INTEGER NOT NULL DEFAULT 0,
      earnings_total  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              TEXT PRIMARY KEY,
      track_id        TEXT NOT NULL,
      listener_id     TEXT NOT NULL,
      creator_id      TEXT NOT NULL,
      price_per_sec   INTEGER NOT NULL,
      seconds_played  INTEGER NOT NULL DEFAULT 0,
      amount_paid     INTEGER NOT NULL DEFAULT 0,
      active          INTEGER NOT NULL DEFAULT 1,
      started_at      INTEGER NOT NULL,
      ended_at        INTEGER,
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (listener_id) REFERENCES users(id),
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(active);
    CREATE INDEX IF NOT EXISTS idx_sessions_track ON sessions(track_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_creator ON tracks(creator_id);
  `);

  persist();
  return db;
}

/**
 * Persist DB to disk. Debounced to avoid hammering the FS.
 */
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
      console.error('[db] persist failed:', err.message);
    }
  }, 100);
}

/**
 * Force-flush any pending writes. Call on graceful shutdown.
 */
function flushSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('[db] flushSync failed:', err.message);
  }
}

// Helper — wait for init before any query
async function ready() {
  if (!db) await init();
}

// ───────────────────────────────────────────────
// Query helpers (sync, after init)
// ───────────────────────────────────────────────

function rowsFromStmt(stmt) {
  const out = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject());
  }
  stmt.free();
  return out;
}

function firstRow(stmt) {
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// ───────────────────────────────────────────────
// User helpers
// ───────────────────────────────────────────────

function createUser({ handle, email = null, wallet, role = 'listener' }) {
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.run(
    `INSERT INTO users (id, handle, email, wallet, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [String(id), String(handle), email == null ? null : String(email), String(wallet), String(role), Date.now()]
  );
  persist();
  return getUser(id);
}

function getUser(id) {
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
  stmt.bind([id]);
  return firstRow(stmt);
}

function getUserByEmail(email) {
  const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
  stmt.bind([email]);
  return firstRow(stmt);
}

function getUserByHandle(handle) {
  const stmt = db.prepare(`SELECT * FROM users WHERE handle = ?`);
  stmt.bind([handle]);
  return firstRow(stmt);
}

function getUserByWallet(wallet) {
  const stmt = db.prepare(`SELECT * FROM users WHERE wallet = ?`);
  stmt.bind([wallet]);
  return firstRow(stmt);
}

// ───────────────────────────────────────────────
// Track helpers
// ───────────────────────────────────────────────

function createTrack({ creatorId, title, description, audioUrl, durationSec, pricePerSec, coverUrl = '' }) {
  const id = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.run(
    `INSERT INTO tracks (id, creator_id, title, description, audio_url, duration_sec, price_per_sec, cover_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(id),
      String(creatorId),
      String(title),
      String(description || ''),
      String(audioUrl),
      Number(durationSec) || 0,
      Number(pricePerSec) || 0,
      String(coverUrl || ''),
      Date.now()
    ]
  );
  persist();
  return getTrack(id);
}

function getTrack(id) {
  const stmt = db.prepare(`SELECT * FROM tracks WHERE id = ?`);
  stmt.bind([id]);
  return firstRow(stmt);
}

function listTracks({ creatorId = null, limit = 50 } = {}) {
  if (creatorId) {
    const stmt = db.prepare(`SELECT * FROM tracks WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?`);
    stmt.bind([creatorId, limit]);
    return rowsFromStmt(stmt);
  }
  const stmt = db.prepare(`SELECT * FROM tracks ORDER BY created_at DESC LIMIT ?`);
  stmt.bind([limit]);
  return rowsFromStmt(stmt);
}

function incrementTrackStats(trackId, earningsMicroUsdc) {
  db.run(`UPDATE tracks SET plays = plays + 1, earnings_total = earnings_total + ? WHERE id = ?`,
    [Number(earningsMicroUsdc) || 0, String(trackId)]);
  persist();
}

// ───────────────────────────────────────────────
// Session helpers
// ───────────────────────────────────────────────

function openSession({ trackId, listenerId, creatorId, pricePerSec }) {
  const id = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.run(
    `INSERT INTO sessions (id, track_id, listener_id, creator_id, price_per_sec, started_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(id),
      String(trackId),
      String(listenerId),
      String(creatorId),
      Number(pricePerSec) || 0,
      Date.now()
    ]
  );
  persist();
  return getSession(id);
}

function getSession(id) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  stmt.bind([id]);
  return firstRow(stmt);
}

function tickSession(sessionId, amountMicroUsdc) {
  db.run(
    `UPDATE sessions SET seconds_played = seconds_played + 1, amount_paid = amount_paid + ? WHERE id = ?`,
    [Number(amountMicroUsdc) || 0, String(sessionId)]
  );
  persist();
}

function closeSession(sessionId) {
  db.run(`UPDATE sessions SET active = 0, ended_at = ? WHERE id = ?`, [Date.now(), String(sessionId)]);
  persist();
}

function getActiveSessionsForTrack(trackId) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE track_id = ? AND active = 1`);
  stmt.bind([trackId]);
  return rowsFromStmt(stmt);
}

// ───────────────────────────────────────────────
// Aggregations (for creator dashboard)
// ───────────────────────────────────────────────

function getCreatorEarnings(creatorId) {
  const stmt = db.prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM sessions WHERE creator_id = ?`);
  stmt.bind([creatorId]);
  const row = firstRow(stmt);
  return row ? row.total : 0;
}

function getTrackEarnings(trackId) {
  const stmt = db.prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM sessions WHERE track_id = ?`);
  stmt.bind([trackId]);
  const row = firstRow(stmt);
  return row ? row.total : 0;
}

function getTopTracks(creatorId, limit = 10) {
  const stmt = db.prepare(`
    SELECT id, title, plays, earnings_total, duration_sec, price_per_sec
    FROM tracks
    WHERE creator_id = ?
    ORDER BY earnings_total DESC
    LIMIT ?
  `);
  stmt.bind([creatorId, limit]);
  return rowsFromStmt(stmt);
}

// ───────────────────────────────────────────────
// Exports — note: all query functions are sync, but you must `await ready()`
// before first use (handled by server.js / seed.js).
// ───────────────────────────────────────────────

module.exports = {
  init,
  ready,
  flushSync,
  // user
  createUser,
  getUser,
  getUserByEmail,
  getUserByHandle,
  getUserByWallet,
  // track
  createTrack,
  getTrack,
  listTracks,
  incrementTrackStats,
  // session
  openSession,
  getSession,
  tickSession,
  closeSession,
  getActiveSessionsForTrack,
  // aggregations
  getCreatorEarnings,
  getTrackEarnings,
  getTopTracks,
  // raw db handle (for advanced use)
  get db() { return db; },
};