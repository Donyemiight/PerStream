# PerStream — Live Mode Deployment Guide

> _Switching from mock to real USDC on Arc testnet. ~20 minutes._

---

## What you get in live mode

| Mock mode | Live mode |
|---|---|
| In-memory ledger, lost on restart | Real USDC on Arc testnet |
| No keys needed | One private key (settlement key) |
| No faucet | Free testnet USDC from faucet |
| No on-chain settlement | Real x402 + Circle Gateway batched payments |
| Demo / hackathon only | Production-ready for Arc testnet demos |

The same code, the same endpoints, the same UI. Just real money.

---

## Prerequisites

1. **Node.js 20+** (we tested with v22.17.0)
2. **A wallet private key** for the settlement account
3. **Arc testnet USDC** in that wallet (from faucet)
4. **~5 minutes** to set up

You do **not** need:
- A Circle API key (the SDK handles facilitator calls)
- A deployed contract (the SDK uses Circle's pre-deployed GatewayWallet)
- Real ETH / gas money (x402 batched payments are gasless)

---

## Step 1 — Get testnet USDC

**Visit the Circle faucet**: https://faucet.circle.com

- Select **Arc Testnet** as the network
- Paste your wallet address
- Request USDC (you'll get ~10 USDC for free)
- Wait ~30 seconds for the transaction to confirm

Your wallet is now funded. You can see it in the Arc testnet explorer: https://testnet.arcscan.app

---

## Step 2 — Configure your .env

```bash
cd backend
cp .env.example .env
# Edit .env:
```

Fill in these three values:

```bash
PAYMENTS_MODE=live
ARC_RPC_URL=https://rpc.testnet.arc.io
SETTLEMENT_PRIVATE_KEY=0x_your_private_key_here
```

**Where to get a private key to test with?**
- MetaMask: account details → export private key (use a test wallet, NOT your main wallet)
- Generate one in Node: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- For testnet only, any private key works — just make sure to fund the resulting address

⚠️ **Security**: never commit a real mainnet private key to git. The settlement key is read at startup and kept in memory only.

---

## Step 3 — Verify the SDK wiring

Before starting the server, run the live smoke test:

```bash
cd /workspace/perstream
node scripts/live-smoke.js
```

Expected output:
```
[ok] arc.isLive() returned true
[ok] seller address resolved: 0x...
[arc] live mode initialised
[arc] seller address: 0x...
[arc] chain: Arc Testnet
[ok] getListenerBalance(0) returned: 0 micro-USDC

[live-smoke] all checks passed
```

If you see "RPC error" or "Cannot find module", check that:
1. `node_modules/@circle-fin/x402-batching` exists (run `npm install` in `backend/`)
2. The settlement key is 0x-prefixed and 64 hex chars
3. You have internet access (the SDK calls Circle's Gateway API)

---

## Step 4 — Seed the database

```bash
cd backend
PAYMENTS_MODE=live node scripts/seed.js
```

This creates:
- 1 demo creator: `demo-creator@perstream.fm`
- 1 demo listener: `demo-listener@perstream.fm`
- 3 sample tracks (with placeholder audio if you haven't dropped real MP3s in)

---

## Step 5 — Start the server

```bash
PAYMENTS_MODE=live node src/server.js
```

Expected output:
```
[startup] node: v22.17.0
[arc] live mode initialised
[arc] seller address: 0x...
[arc] chain: Arc Testnet
listening on :3000
```

---

## Step 6 — Test the live flow

Open `http://localhost:3000` in your browser.

1. Sign in as `demo-listener@perstream.fm`
2. Pick a track → 402 Payment Required
3. Click + Add 5 USDC → balance goes up (this is recorded in mock listener balance for the demo; for full live deposit flow, see "Real deposit" below)
4. Press ▶ Start Streaming
5. Watch the meter tick per second — **every tick is a real x402 payment** (signed off-chain, batched via Circle Gateway, settled on Arc testnet)
6. Open the creator dashboard in another tab → earnings tick up in real USDC

### Where to verify the on-chain transactions

- Arc Testnet Explorer: https://testnet.arcscan.app
- Search for your seller address
- You'll see `GatewayWallet` interactions every ~minute (batched settlement)

---

## What the SDK does behind the scenes

```
┌─────────┐                ┌──────────┐                ┌────────────┐
│Listener │  pay() request │PerStream │  signed EIP-3009 │  Circle   │
│(browser)│───────────────▶│ Backend  │─────────────────▶│  Gateway  │
└─────────┘                └──────────┘                  └─────┬──────┘
                                  │                            │
                                  │ every ~1 min batched settle│
                                  ▼                            ▼
                          ┌──────────────┐            ┌──────────────┐
                          │   Creator    │            │  Arc Testnet │
                          │   Wallet     │◀───────────│  (USDC)      │
                          └──────────────┘            └──────────────┘
```

1. Listener's browser hits `POST /api/listen/start`
2. Backend (settlement key) calls `GatewayClient.deposit(0.001)` if not yet deposited
3. Each second, backend ticks → signed EIP-3009 authorization (`TransferWithAuthorization`)
4. Circle Gateway batches authorizations off-chain
5. Every ~1 minute, the batch settles on Arc testnet (one tx, low gas)
6. Creator's USDC balance on Arc testnet increases in real time

**The listener pays nothing in gas** (Circle facilitator covers it). The creator receives real USDC.

---

## Real deposit flow (not in the demo shortcut)

The current demo uses a settlement key on behalf of listeners for simplicity. In production, the listener would:

1. Open the app → see "Connect wallet" (not "Sign in with email")
2. Approve USDC transfer to GatewayWallet
3. Call `GatewayClient.deposit(amount)` from their own wallet
4. Now their Gateway balance is non-zero
5. They can listen and pay

The backend's job becomes: read listener's Gateway balance, decrement on each tick (signed by backend settlement key on listener's behalf, with their prior authorization).

This is the **gasless** part of x402 — listeners never need ETH for gas, only USDC.

---

## Troubleshooting

### "Cannot find module '@circle-fin/x402-batching/client'"

The peer dep is missing. Run from the backend directory:

```bash
cd backend
npm install --no-audit --no-fund --omit=optional
ls node_modules/@circle-fin/x402-batching/
```

### "SETTLEMENT_PRIVATE_KEY is required"

Set the env var or add it to `.env`:

```bash
SETTLEMENT_PRIVATE_KEY=0x1234...
```

### "RPC error: could not connect to https://rpc.testnet.arc.io"

Try a different RPC. Alchemy, QuickNode, or your own node. Update `ARC_RPC_URL` in `.env`.

### Balance always shows 0

The settlement key wallet has no USDC. Either:
- Get USDC from the faucet: https://faucet.circle.com
- Or use the demo mock mode (set `PAYMENTS_MODE=mock`)

### "Live Arc mode not yet activated"

You're on an old version. Update `backend/src/arc.js` from the repo:

```bash
cd /workspace/perstream
git pull
```

---

## Production checklist (for going beyond testnet)

When you're ready to leave testnet:

- [ ] Get a Circle API key (https://console.circle.com)
- [ ] Switch to Arc mainnet (when it launches — set `chain: 'arc'`)
- [ ] Add a private RPC URL (Arc mainnet has no public RPC initially)
- [ ] Use HSM or KMS for the settlement key (not raw .env)
- [ ] Add rate limiting on the tick endpoint
- [ ] Add an "earnings withdrawal" UI for creators
- [ ] Move from SQLite to Postgres for multi-instance deploys
- [ ] Set up monitoring (Datadog, Grafana, etc.)
- [ ] Add user authentication (wallet signature, not email)

---

## Reference

- **Circle Nanopayments**: https://www.circle.com/blog/build-agentic-systems-for-high-frequency-sub-cent-transactions
- **x402 Protocol**: https://x402.org
- **Arc Docs**: https://docs.arc.io
- **SDK**: https://github.com/circlefin/arc-nanopayments
- **Sample App**: https://github.com/circlefin/arc-nanopayments
- **Faucet**: https://faucet.circle.com
- **Explorer**: https://testnet.arcscan.app

Built for the Lepton Agents Hackathon, June 2026.
