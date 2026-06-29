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

const DB_PATH = (() => {
  const env = process.env.DB_PATH;
  if (env && path.isAbsolute(env)) return env;
  if (env && env.trim() !== '') {
    // Resolve relative DB_PATH against the backend dir (where db.js lives)
    return path.resolve(__dirname, '..', env);
  }
  // Default: backend/data/perstream.db (works regardless of CWD)
  return path.join(__dirname, '..', 'data', 'perstream.db');
})();

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
      category        TEXT DEFAULT 'general',
      status          TEXT DEFAULT 'published',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL DEFAULT 0,
      plays           INTEGER NOT NULL DEFAULT 0,
      earnings_total  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id              TEXT PRIMARY KEY,
      creator_id      TEXT NOT NULL,
      amount_micro    INTEGER NOT NULL,
      amount_usd      REAL NOT NULL,
      tx_hash         TEXT,
      status          TEXT DEFAULT 'pending',
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS creator_profiles (
      user_id       TEXT PRIMARY KEY,
      display_name  TEXT,
      bio           TEXT DEFAULT '',
      avatar_url    TEXT DEFAULT '',
      social_links  TEXT DEFAULT '{}',
      wallet_address TEXT,
      updated_at    INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      kind            TEXT NOT NULL,
      title           TEXT NOT NULL,
      body            TEXT DEFAULT '',
      is_read         INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
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

    CREATE TABLE IF NOT EXISTS feedback (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email    TEXT,
      user_handle   TEXT,
      track_id      TEXT,
      rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment       TEXT,
      page          TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL,
      role          TEXT,
      use_case      TEXT,
      source        TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

  `);

  // Migrations: ALTER TABLE to add new columns to existing tracks table
  // (CREATE TABLE IF NOT EXISTS doesn't add columns to existing tables)
  try {
    const tracksCols = db.exec(`PRAGMA table_info(tracks)`);
    const colNames = tracksCols[0] ? tracksCols[0].values.map(v => v[1]) : [];
    if (!colNames.includes('category')) {
      db.run(`ALTER TABLE tracks ADD COLUMN category TEXT DEFAULT 'general'`);
      console.log('[db] migrated: added tracks.category');
    }
    if (!colNames.includes('status')) {
      db.run(`ALTER TABLE tracks ADD COLUMN status TEXT DEFAULT 'published'`);
      console.log('[db] migrated: added tracks.status');
    }
    if (!colNames.includes('updated_at')) {
      db.run(`ALTER TABLE tracks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
      console.log('[db] migrated: added tracks.updated_at');
    }
  } catch (err) {
    console.warn('[db] tracks migration check failed:', err.message);
  }

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

function createTrack({ creatorId, title, description, audioUrl, durationSec, pricePerSec, coverUrl = '', category = 'general', status = 'published' }) {
  const id = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.run(
    `INSERT INTO tracks (id, creator_id, title, description, audio_url, duration_sec, price_per_sec, cover_url, category, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(id),
      String(creatorId),
      String(title),
      String(description || ''),
      String(audioUrl),
      Number(durationSec) || 0,
      Number(pricePerSec) || 0,
      String(coverUrl || ''),
      String(category || 'general'),
      String(status || 'published'),
      Date.now()
    ]
  );
  persist();
  return getTrack(id);
}

function updateTrack(id, creatorId, updates) {
  const existing = getTrack(id);
  if (!existing) return null;
  if (existing.creator_id !== creatorId) return null; // ownership check
  const allowed = ['title', 'description', 'price_per_sec', 'cover_url', 'category', 'duration_sec'];
  const fields = [];
  const values = [];
  for (const k of allowed) {
    if (updates[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(updates[k]);
    }
  }
  if (fields.length === 0) return existing;
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  db.run(`UPDATE tracks SET ${fields.join(', ')} WHERE id = ?`, values);
  persist();
  return getTrack(id);
}

function deleteTrack(id, creatorId) {
  const existing = getTrack(id);
  if (!existing) return false;
  if (existing.creator_id !== creatorId) return false; // ownership check
  db.run(`DELETE FROM tracks WHERE id = ?`, [id]);
  persist();
  return true;
}

function setTrackStatus(id, creatorId, status) {
  const existing = getTrack(id);
  if (!existing) return null;
  if (existing.creator_id !== creatorId) return null;
  if (!['published', 'draft', 'unlisted'].includes(status)) return null;
  db.run(`UPDATE tracks SET status = ?, updated_at = ? WHERE id = ?`, [status, Date.now(), id]);
  persist();
  return getTrack(id);
}

function getTrack(id) {
  const stmt = db.prepare(`SELECT * FROM tracks WHERE id = ?`);
  stmt.bind([id]);
  return firstRow(stmt);
}

function listTracks({ creatorId = null, limit = 50, includeDrafts = false, status = null } = {}) {
  // When creatorId is provided (creator's own dashboard), include drafts so they see everything they uploaded.
  // When called publicly (no creatorId), only show published tracks.
  if (creatorId) {
    const where = status ? `creator_id = ? AND status = ?` : `creator_id = ?`;
    const stmt = db.prepare(`SELECT * FROM tracks WHERE ${where} ORDER BY created_at DESC LIMIT ?`);
    if (status) stmt.bind([creatorId, status, limit]);
    else stmt.bind([creatorId, limit]);
    return rowsFromStmt(stmt);
  }
  // Public listing — only published tracks
  if (!includeDrafts) {
    const stmt = db.prepare(`SELECT * FROM tracks WHERE status = 'published' ORDER BY created_at DESC LIMIT ?`);
    stmt.bind([limit]);
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

// ====== WITHDRAWALS ======
function createWithdrawal({ creatorId, amountMicro, amountUsd, txHash = null, status = 'pending' }) {
  const id = `wdl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  db.run(
    `INSERT INTO withdrawals (id, creator_id, amount_micro, amount_usd, tx_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, creatorId, amountMicro, amountUsd, txHash, status, now]
  );
  persist();
  return getWithdrawal(id);
}

function getWithdrawal(id) {
  const stmt = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`);
  stmt.bind([id]);
  return firstRow(stmt);
}

function listWithdrawals(creatorId, limit = 50) {
  const stmt = db.prepare(`SELECT * FROM withdrawals WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?`);
  stmt.bind([creatorId, limit]);
  return rowsFromStmt(stmt);
}

function updateWithdrawalStatus(id, status, txHash = null) {
  db.run(`UPDATE withdrawals SET status = ?, tx_hash = COALESCE(?, tx_hash) WHERE id = ?`, [status, txHash, id]);
  persist();
  return getWithdrawal(id);
}

// ====== NOTIFICATIONS ======
function createNotification({ userId, kind, title, body = '' }) {
  const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  db.run(
    `INSERT INTO notifications (id, user_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, kind, title, body, now]
  );
  persist();
  return getNotification(id);
}

function getNotification(id) {
  const stmt = db.prepare(`SELECT * FROM notifications WHERE id = ?`);
  stmt.bind([id]);
  return firstRow(stmt);
}

function listNotifications(userId, limit = 50) {
  const stmt = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`);
  stmt.bind([userId, limit]);
  return rowsFromStmt(stmt);
}

function markNotificationRead(id) {
  db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
  persist();
}

function unreadNotificationCount(userId) {
  const stmt = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0`);
  stmt.bind([userId]);
  return firstRow(stmt)?.c || 0;
}

// ====== CREATOR PROFILES ======
function updateCreatorProfile(userId, { displayName, bio, avatarUrl, socialLinks, walletAddress }) {
  const now = Date.now();
  const linksJson = JSON.stringify(socialLinks || {});
  db.run(
    `INSERT INTO creator_profiles (user_id, display_name, bio, avatar_url, social_links, wallet_address, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       bio = excluded.bio,
       avatar_url = excluded.avatar_url,
       social_links = excluded.social_links,
       wallet_address = excluded.wallet_address,
       updated_at = excluded.updated_at`,
    [userId, displayName || null, bio || '', avatarUrl || '', linksJson, walletAddress || null, now]
  );
  persist();
  return getCreatorProfile(userId);
}

function getCreatorProfile(userId) {
  const stmt = db.prepare(`
    SELECT u.id, u.handle, u.email, u.wallet, u.role, u.created_at,
           p.display_name, p.bio, p.avatar_url, p.social_links, p.wallet_address, p.updated_at as profile_updated_at
    FROM users u
    LEFT JOIN creator_profiles p ON p.user_id = u.id
    WHERE u.id = ?
  `);
  stmt.bind([userId]);
  const row = firstRow(stmt);
  if (!row) return null;
  if (row.social_links) {
    try { row.social_links = JSON.parse(row.social_links); } catch { row.social_links = {}; }
  }
  return row;
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
// Feedback (user ratings + comments)
// ───────────────────────────────────────────────

function addFeedback({ userEmail = null, userHandle = null, trackId = null, rating, comment = '', page = '' }) {
  const r = Number(rating);
  if (!r || r < 1 || r > 5) {
    throw new Error('rating must be 1-5');
  }
  db.run(
    `INSERT INTO feedback (user_email, user_handle, track_id, rating, comment, page, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userEmail, userHandle, trackId, r, String(comment || '').slice(0, 2000), String(page || '').slice(0, 100), Date.now()]
  );
  // Get the inserted rowid via a fresh query
  const stmt = db.prepare('SELECT last_insert_rowid() AS id');
  stmt.step();
  const id = stmt.getAsObject().id;
  stmt.free();
  persist();
  return { ok: true, id };
}

function getFeedbackStats() {
  // sql.js needs step()/getAsObject() not .get() — fix here
  const totalStmt = db.prepare(`SELECT COUNT(*) AS n FROM feedback`);
  totalStmt.step();
  const total = totalStmt.getAsObject().n || 0;
  totalStmt.free();

  const avgStmt = db.prepare(`SELECT AVG(rating) AS a FROM feedback`);
  avgStmt.step();
  const avg = avgStmt.getAsObject().a || 0;
  avgStmt.free();

  const distStmt = db.prepare(`SELECT rating, COUNT(*) AS n FROM feedback GROUP BY rating ORDER BY rating DESC`);
  const distribution = rowsFromStmt(distStmt);

  const recentStmt = db.prepare(`SELECT * FROM feedback ORDER BY created_at DESC LIMIT 20`);
  const recent = rowsFromStmt(recentStmt);

  return {
    total,
    average: Math.round((avg || 0) * 10) / 10,
    distribution,
    recent,
  };
}

function getAllFeedback(limit = 200) {
  return rowsFromStmt(db.prepare(`SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?`).bind([limit]));
}

// ───────────────────────────────────────────────
// Leads (early-access capture)
// ───────────────────────────────────────────────

function addLead({ email, role = null, useCase = null, source = null }) {
  if (!email || !email.includes('@')) throw new Error('valid email required');
  db.run(
    `INSERT INTO leads (email, role, use_case, source, created_at) VALUES (?, ?, ?, ?, ?)`,
    [String(email).toLowerCase().trim(), role ? String(role).slice(0, 50) : null, useCase ? String(useCase).slice(0, 500) : null, source ? String(source).slice(0, 100) : null, Date.now()]
  );
  persist();
  return { ok: true };
}

function getAllLeads(limit = 200) {
  return rowsFromStmt(db.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT ?`).bind([limit]));
}

function getLeadCount() {
  const stmt = db.prepare(`SELECT COUNT(*) AS n FROM leads`);
  stmt.step();
  const n = stmt.getAsObject().n || 0;
  stmt.free();
  return n;
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
  updateTrack,
  deleteTrack,
  setTrackStatus,
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
  // withdrawals
  createWithdrawal,
  getWithdrawal,
  listWithdrawals,
  updateWithdrawalStatus,
  // notifications
  createNotification,
  getNotification,
  listNotifications,
  markNotificationRead,
  unreadNotificationCount,
  // creator profile
  updateCreatorProfile,
  getCreatorProfile,
  // feedback
  addFeedback,
  getFeedbackStats,
  getAllFeedback,
  // leads
  addLead,
  getAllLeads,
  getLeadCount,
  // raw db handle (for advanced use)
  get db() { return db; },
};