/**
 * PerStream Tick Audit Ledger
 *
 * Records every per-second tick in an append-only JSONL file.
 * This is the audit trail you can use to verify payments on Arcscan:
 *
 *   1. Backend ticks every 1 second per active session
 *   2. Each tick is recorded here with timestamp, amount, tx hash, Arcscan URL
 *   3. You can:
 *      - tail -f the file in real time
 *      - GET /api/audit/ticks to retrieve the recent N entries
 *      - GET /api/audit/export to download the full ledger
 *
 * In LIVE mode, the tick log includes the on-chain tx hash from the
 * Circle Gateway batched settlement. The Arcscan URL lets you click
 * through to verify the actual on-chain transaction.
 *
 * In MOCK mode, the tick log uses deterministic mock tx hashes
 * (0x[sid][timestamp][counter]...) that look like real hashes but
 * aren't on-chain. This is useful for demos where you want to show
 * the audit trail without spending real testnet USDC.
 */

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = process.env.TICK_LEDGER_PATH || path.join(__dirname, '..', 'data', 'tick-ledger.jsonl');
const MAX_ENTRIES_IN_MEMORY = 1000;

// In-memory ring buffer for fast /api/audit/ticks queries
let inMemory = [];

function ensureDir() {
  const dir = path.dirname(LEDGER_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append a tick entry to the ledger.
 *
 * @param {object} entry
 *   - ts:        ISO timestamp
 *   - sessionId: session UUID
 *   - trackId:   track ID
 *   - listener:  listener wallet address
 *   - creator:   creator wallet address
 *   - amountUsd: amount in USDC (decimal, e.g. 0.0001)
 *   - amountMicro: amount in micro-USDC (integer, e.g. 100)
 *   - txHash:    on-chain transaction hash (real or mock)
 *   - arcscanUrl: full URL to Arcscan for this tx
 *   - mode:      'mock' or 'live'
 */
function append(entry) {
  ensureDir();
  const record = {
    ts: entry.ts || new Date().toISOString(),
    ...entry,
  };
  // Append to file
  fs.appendFileSync(LEDGER_PATH, JSON.stringify(record) + '\n');
  // Maintain ring buffer
  inMemory.push(record);
  if (inMemory.length > MAX_ENTRIES_IN_MEMORY) {
    inMemory = inMemory.slice(-MAX_ENTRIES_IN_MEMORY);
  }
  return record;
}

/**
 * Get the most recent N tick entries.
 */
function recent(limit = 50) {
  if (inMemory.length === 0) {
    // Load from disk on first call
    ensureDir();
    if (fs.existsSync(LEDGER_PATH)) {
      const lines = fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter(Boolean);
      inMemory = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean).slice(-MAX_ENTRIES_IN_MEMORY);
    }
  }
  return inMemory.slice(-limit).reverse();  // newest first
}

/**
 * Get aggregate stats for the ledger.
 */
function stats() {
  const all = recent(MAX_ENTRIES_IN_MEMORY);
  const totalAmount = all.reduce((sum, e) => sum + (e.amountMicro || 0), 0);
  const uniqueListeners = new Set(all.map(e => e.listener)).size;
  const uniqueCreators = new Set(all.map(e => e.creator)).size;
  return {
    totalTicks: all.length,
    totalAmountMicro: totalAmount,
    totalAmountUsd: totalAmount / 1_000_000,
    uniqueListeners,
    uniqueCreators,
    oldestTick: all.length > 0 ? all[all.length - 1].ts : null,
    newestTick: all.length > 0 ? all[0].ts : null,
    ledgerPath: LEDGER_PATH,
  };
}

/**
 * Stream the full ledger as JSONL.
 */
function streamAll() {
  ensureDir();
  if (!fs.existsSync(LEDGER_PATH)) return '';
  return fs.readFileSync(LEDGER_PATH, 'utf8');
}

/**
 * Clear the ledger (useful for tests).
 */
function clear() {
  ensureDir();
  if (fs.existsSync(LEDGER_PATH)) {
    fs.unlinkSync(LEDGER_PATH);
  }
  inMemory = [];
}

function getBySession(sessionId) {
  // Return all ticks for a given session (used by batched settlement)
  return inMemory.filter(e => e.sessionId === sessionId);
}

function appendSettlement(entry) {
  // Append a batched-settlement entry (distinct from per-second ticks).
  // This is the REAL on-chain settlement tx for the batch of ticks.
  const record = {
    kind: 'settlement',
    ts: new Date().toISOString(),
    ...entry,
  };
  inMemory.push(record);
  if (inMemory.length > MAX_ENTRIES_IN_MEMORY) {
    inMemory = inMemory.slice(-MAX_ENTRIES_IN_MEMORY);
  }
  ensureDir();
  try {
    fs.appendFileSync(LEDGER_PATH, JSON.stringify(record) + '\n');
  } catch (err) {
    console.warn('[ledger] write failed:', err.message);
  }
  return record;
}

module.exports = {
  append,
  appendSettlement,
  recent,
  getBySession,
  stats,
  streamAll,
  clear,
  LEDGER_PATH,
};
