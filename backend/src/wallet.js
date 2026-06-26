/**
 * PerStream Wallet Layer
 *
 * Two modes:
 *  - MOCK: generates deterministic mock wallet addresses from email (for demo / no-keys)
 *  - LIVE: uses Circle Agent Stack to provision embedded wallets (real, requires API key)
 *
 * Embedded wallets mean the listener never sees a MetaMask popup. They sign in
 * with email (Circle's social-login flow), and Circle holds the keys on their behalf.
 *
 * Real implementation: https://developers.circle.com/wallets/user-controlled
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
  if (MODE === 'live') {
    return createCircleWallet({ email, userId });
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
  MODE,
};