/**
 * PerStream Wallet Layer
 *
 * Three modes:
 *  - MOCK: generates deterministic mock wallet addresses from email (for demo / no-keys)
 *  - LIVE: uses Circle Agent Stack to provision embedded wallets (requires API key)
 *  - LIVE-SIMPLE: generates a real viem wallet per user (no Circle API key needed).
 *    Use this for the hackathon demo where the seller has real USDC but listeners
 *    just need a valid Arc testnet address to send ticks from.
 */

const crypto = require('crypto');

const MODE = process.env.PAYMENTS_MODE || 'mock';

// ───────────────────────────────────────────────
// MOCK mode — deterministic address from email
// ───────────────────────────────────────────────

function mockAddressFromEmail(email) {
  const hash = crypto.createHash('sha256').update(`perstream:${email.toLowerCase()}`).digest('hex');
  return '0x' + hash.slice(0, 40);
}

async function createMockWallet({ email, handle }) {
  const wallet = mockAddressFromEmail(email || handle);
  return {
    wallet,
    mode: 'mock',
    createdAt: Date.now(),
  };
}

// ───────────────────────────────────────────────
// LIVE-SIMPLE mode — real viem wallet (no Circle API key)
// Derives a deterministic wallet from email so the same user always gets
// the same address. Useful for the demo where we want real Arc addresses
// without requiring a Circle Developer Console account.
// ───────────────────────────────────────────────

async function createLiveSimpleWallet({ email, handle }) {
  const { privateKeyToAccount } = require('viem/accounts');
  // Derive a deterministic private key from email
  const seed = crypto.createHash('sha256').update(`perstream-live:${(email || handle).toLowerCase()}`).digest('hex');
  const pk = '0x' + seed;
  const account = privateKeyToAccount(pk);
  return {
    wallet: account.address,
    privateKey: pk,  // For demo only — in production this would never be exposed
    mode: 'live-simple',
    createdAt: Date.now(),
  };
}

// ───────────────────────────────────────────────
// LIVE mode — Circle Agent Stack
// ───────────────────────────────────────────────

async function createCircleWallet({ email, userId }) {
  const apiKey = process.env.CIRCLE_API_KEY;
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;

  if (!apiKey || !walletSetId) {
    throw new Error('Circle credentials missing. Set CIRCLE_API_KEY and CIRCLE_WALLET_SET_ID, or use PAYMENTS_MODE=mock.');
  }

  // Real flow (commented for clarity, activate when keys are available):
  //
  // 1. POST /v1/wallets with userId + walletSetId + blockchains: ['ARC']
  // 2. POST /v1/users/token to get session token for the user
  // 3. Return wallet.address + challengeId for client-side signing

  // Placeholder — kept as a documented stub
  throw new Error(
    'Circle live wallet flow not yet wired (this hackathon MVP runs in mock mode). ' +
    'See https://developers.circle.com/wallets for activation steps.'
  );
}

// ───────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────

async function provisionWallet({ email, handle, userId }) {
  if (MODE === 'live' && process.env.CIRCLE_API_KEY && process.env.CIRCLE_WALLET_SET_ID) {
    return createCircleWallet({ email, userId });
  }
  // For PAYMENTS_MODE=live without Circle API key, fall back to live-simple
  // This way the demo works end-to-end on Arc testnet without needing
  // a Circle Developer Console account.
  if (MODE === 'live' || MODE === 'live-simple') {
    return createLiveSimpleWallet({ email, handle });
  }
  return createMockWallet({ email, handle });
}

function isValidWallet(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

module.exports = {
  provisionWallet,
  isValidWallet,
  mockAddressFromEmail,
  MODE,};