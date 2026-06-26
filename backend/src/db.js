/**
 * PerStream Database (SQLite)
 *
 * Three tables:
 *   - users:      listeners and creators (with embedded wallet addresses)
 *   - tracks:     audio files with per-second pricing
 *   - sessions:   active listening sessions for meter tick tracking
 *
 * Zero-config: file-based SQLite, no migrations needed.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'perstream.db');

// Ensure data dir exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema (idempotent)
db.exec(`
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

// ───────────────────────────────────────────────
// User helpers
// ───────────────────────────────────────────────

function createUser({ handle, email = null, wallet, role = 'listener' }) {
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO users (id, handle, email, wallet, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, handle, email, wallet, role, Date.now());
  return getUser(id);
}

function getUser(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

function getUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
}

function getUserByHandle(handle) {
  return db.prepare(`SELECT * FROM users WHERE handle = ?`).get(handle);
}

function getUserByWallet(wallet) {
  return db.prepare(`SELECT * FROM users WHERE wallet = ?`).get(wallet);
}

// ───────────────────────────────────────────────
// Track helpers
// ───────────────────────────────────────────────

function createTrack({ creatorId, title, description, audioUrl, durationSec, pricePerSec, coverUrl = '' }) {
  const id = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO tracks (id, creator_id, title, description, audio_url, duration_sec, price_per_sec, cover_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, creatorId, title, description, audioUrl, durationSec, pricePerSec, coverUrl, Date.now());
  return getTrack(id);
}

function getTrack(id) {
  return db.prepare(`SELECT * FROM tracks WHERE id = ?`).get(id);
}

function listTracks({ creatorId = null, limit = 50 } = {}) {
  if (creatorId) {
    return db.prepare(`SELECT * FROM tracks WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(creatorId, limit);
  }
  return db.prepare(`SELECT * FROM tracks ORDER BY created_at DESC LIMIT ?`).all(limit);
}

function incrementTrackStats(trackId, earningsMicroUsdc) {
  db.prepare(`UPDATE tracks SET plays = plays + 1, earnings_total = earnings_total + ? WHERE id = ?`)
    .run(earningsMicroUsdc, trackId);
}

// ───────────────────────────────────────────────
// Session helpers
// ───────────────────────────────────────────────

function openSession({ trackId, listenerId, creatorId, pricePerSec }) {
  const id = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO sessions (id, track_id, listener_id, creator_id, price_per_sec, started_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, trackId, listenerId, creatorId, pricePerSec, Date.now());
  return getSession(id);
}

function getSession(id) {
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
}

function tickSession(sessionId, amountMicroUsdc) {
  db.prepare(
    `UPDATE sessions SET seconds_played = seconds_played + 1, amount_paid = amount_paid + ? WHERE id = ?`
  ).run(amountMicroUsdc, sessionId);
}

function closeSession(sessionId) {
  db.prepare(`UPDATE sessions SET active = 0, ended_at = ? WHERE id = ?`).run(Date.now(), sessionId);
}

function getActiveSessionsForTrack(trackId) {
  return db.prepare(`SELECT * FROM sessions WHERE track_id = ? AND active = 1`).all(trackId);
}

// ───────────────────────────────────────────────
// Aggregations (for creator dashboard)
// ───────────────────────────────────────────────

function getCreatorEarnings(creatorId) {
  const row = db.prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM sessions WHERE creator_id = ?`)
    .get(creatorId);
  return row.total || 0;
}

function getTrackEarnings(trackId) {
  const row = db.prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM sessions WHERE track_id = ?`)
    .get(trackId);
  return row.total || 0;
}

function getTopTracks(creatorId, limit = 10) {
  return db.prepare(`
    SELECT id, title, plays, earnings_total, duration_sec, price_per_sec
    FROM tracks
    WHERE creator_id = ?
    ORDER BY earnings_total DESC
    LIMIT ?
  `).all(creatorId, limit);
}

module.exports = {
  db,
  createUser,
  getUser,
  getUserByEmail,
  getUserByHandle,
  getUserByWallet,
  createTrack,
  getTrack,
  listTracks,
  incrementTrackStats,
  openSession,
  getSession,
  tickSession,
  closeSession,
  getActiveSessionsForTrack,
  getCreatorEarnings,
  getTrackEarnings,
  getTopTracks,
};