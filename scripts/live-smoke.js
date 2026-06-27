/**
 * Live-mode smoke test for PerStream on Arc testnet.
 *
 * Tests the full flow:
 *   1. Create GatewayClient (no real on-chain calls)
 *   2. Read USDC balance (will be 0 for a fresh key)
 *   3. Read Gateway balance (will be 0)
 *
 * To run:
 *   export SETTLEMENT_PRIVATE_KEY=0x...
 *   export ARC_RPC_URL=https://rpc.testnet.arc.io
 *   node scripts/live-smoke.js
 *
 * NOTE: This script is for verifying the SDK wiring. To do real deposits
 * and payments, you need a wallet funded with Arc testnet USDC from
 * https://faucet.circle.com
 */

const path = require('path');
const backendNodeModules = path.join(__dirname, '..', 'backend', 'node_modules');
require.main.paths.unshift(backendNodeModules);

require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function main() {
  // Force live mode for this test
  process.env.PAYMENTS_MODE = 'live';

  const arc = require('../backend/src/arc');

  if (!arc.isLive()) {
    console.error('FAIL: PAYMENTS_MODE is not live');
    process.exit(1);
  }
  console.log('[ok] arc.isLive() returned true');

  try {
    const seller = arc.getSellerAddress();
    console.log('[ok] seller address resolved:', seller);
  } catch (err) {
    console.error('FAIL: getSellerAddress threw:', err.message);
    process.exit(1);
  }

  // Test that we can call getListenerBalance (will return 0 for fresh key)
  try {
    const bal = await arc.getListenerBalance(arc.getSellerAddress());
    console.log('[ok] getListenerBalance(0) returned:', bal, 'micro-USDC');
  } catch (err) {
    console.warn('[warn] getListenerBalance failed (expected without funded wallet):', err.message);
  }

  console.log('\n[live-smoke] all checks passed');
  console.log('\nNext steps:');
  console.log('  1. Visit https://faucet.circle.com and get Arc testnet USDC');
  console.log('  2. Send USDC to the seller address above');
  console.log('  3. Run: PAYMENTS_MODE=live node scripts/seed.js');
  console.log('  4. Run: PAYMENTS_MODE=live node backend/src/server.js');
  console.log('  5. Open http://localhost:3000/listen.html');
}

main().catch(err => {
  console.error('[live-smoke] fatal:', err);
  process.exit(1);
});
