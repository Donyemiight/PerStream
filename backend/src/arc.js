/**
 * PerStream Arc + Circle Nanopayments client.
 *
 * Two modes:
 *  - MOCK: in-memory ledger, simulates gasless USDC transfers (no chain interaction)
 *  - LIVE: calls PerStreamPaymaster on Arc testnet
 *
 * The mock ledger tracks:
 *   - listener balances (deposited USDC)
 *   - creator earnings (withdrawable USDC)
 *
 * This mirrors the contract's accounting so swapping to live mode is a no-op for callers.
 */

const MODE = process.env.PAYMENTS_MODE || 'mock';

// ───────────────────────────────────────────────
// Mock ledger (in-memory, lost on restart — demo only)
// ───────────────────────────────────────────────

const mockLedger = {
  listenerBalances: new Map(),  // address → micro-USDC
  creatorEarnings: new Map(),   // address → micro-USDC
  sessions: new Map(),          // sessionId → { listener, creator, pricePerSec }
};

function microUsdc(amount) {
  // 6 decimals, integer math
  return Math.floor(amount * 1_000_000);
}

function fromMicroUsdc(amount) {
  return amount / 1_000_000;
}

// ───────────────────────────────────────────────
// Mock deposit
// ───────────────────────────────────────────────

async function mockDeposit({ listener, amountMicroUsdc }) {
  if (!mockLedger.listenerBalances.has(listener)) {
    mockLedger.listenerBalances.set(listener, 0);
  }
  mockLedger.listenerBalances.set(
    listener,
    mockLedger.listenerBalances.get(listener) + amountMicroUsdc
  );
  return { ok: true, balance: mockLedger.listenerBalances.get(listener) };
}

// ───────────────────────────────────────────────
// Mock tick — settle 1 second
// ───────────────────────────────────────────────

async function mockTick({ sessionId, listener, creator, pricePerSec, seconds }) {
  const balance = mockLedger.listenerBalances.get(listener) || 0;
  const amount = pricePerSec * seconds;

  if (balance < amount) {
    return { ok: false, reason: 'insufficient_balance', balance };
  }

  mockLedger.listenerBalances.set(listener, balance - amount);
  mockLedger.creatorEarnings.set(
    creator,
    (mockLedger.creatorEarnings.get(creator) || 0) + amount
  );

  return {
    ok: true,
    amountMicroUsdc: amount,
    txHash: mockTxHash(sessionId),
  };
}

// Deterministic-ish mock tx hash
let mockTxCounter = 0;
function mockTxHash(sessionId) {
  mockTxCounter++;
  const stamp = Date.now().toString(16);
  const sid = sessionId.slice(0, 8);
  return `0x${sid}${stamp}${mockTxCounter.toString(16).padStart(4, '0')}`.padEnd(66, '0');
}

// ───────────────────────────────────────────────
// Mock withdraw
// ───────────────────────────────────────────────

async function mockWithdraw({ creator, amountMicroUsdc }) {
  const earned = mockLedger.creatorEarnings.get(creator) || 0;
  if (amountMicroUsdc > earned) {
    return { ok: false, reason: 'insufficient_earnings' };
  }
  mockLedger.creatorEarnings.set(creator, earned - amountMicroUsdc);
  return { ok: true, withdrawn: amountMicroUsdc };
}

// ───────────────────────────────────────────────
// Mock views
// ───────────────────────────────────────────────

function mockGetBalance(listener) {
  return mockLedger.listenerBalances.get(listener) || 0;
}

function mockGetEarnings(creator) {
  return mockLedger.creatorEarnings.get(creator) || 0;
}

// ───────────────────────────────────────────────
// LIVE mode (stub — fill in when keys available)
// ───────────────────────────────────────────────

async function liveDeposit({ listener, amountMicroUsdc }) {
  // Real implementation: call usdc.transferFrom(listener, paymaster, amount)
  // Signed by Circle facilitator (gasless for listener)
  throw new Error('Live Arc mode not yet activated. Set PAYMENTS_MODE=mock for now.');
}

async function liveTick({ sessionId, listener, creator, pricePerSec, seconds }) {
  // Real implementation: call paymaster.tick(sessionId, seconds) from backend's settlement key
  throw new Error('Live Arc mode not yet activated. Set PAYMENTS_MODE=mock for now.');
}

async function liveWithdraw({ creator, amountMicroUsdc }) {
  // Real implementation: call paymaster.withdrawAmount(amountMicroUsdc) — creator signs locally
  throw new Error('Live Arc mode not yet activated. Set PAYMENTS_MODE=mock for now.');
}

// ───────────────────────────────────────────────
// Public API (mode-dispatched)
// ───────────────────────────────────────────────

async function deposit(args) {
  return MODE === 'live' ? liveDeposit(args) : mockDeposit(args);
}

async function tick(args) {
  return MODE === 'live' ? liveTick(args) : mockTick(args);
}

async function withdraw(args) {
  return MODE === 'live' ? liveWithdraw(args) : mockWithdraw(args);
}

function getListenerBalance(listener) {
  return MODE === 'live' ? 0 : mockGetBalance(listener);  // live: read from contract
}

function getCreatorEarnings(creator) {
  return MODE === 'live' ? 0 : mockGetEarnings(creator);
}

// Convert helpers (re-export)
function usdToMicro(amount) { return microUsdc(amount); }
function microToUsd(amount) { return fromMicroUsdc(amount); }

module.exports = {
  MODE,
  deposit,
  tick,
  withdraw,
  getListenerBalance,
  getCreatorEarnings,
  usdToMicro,
  microToUsd,
};