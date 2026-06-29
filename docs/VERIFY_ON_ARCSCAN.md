# PerStream — How to Verify Payments on Arc Testnet Explorer

> _Every per-second tick is auditable. Here's how to verify them on Arcscan._

---

## TL;DR

Every second a listener streams, the backend records a **tick** in a JSONL audit ledger. In live mode, each tick has a **tx hash** that links to a real on-chain transaction on the Arc testnet. You can verify the entire payment stream in 3 ways:

1. **In-app** — open the creator dashboard, scroll to "On-chain audit trail", click any tx hash to open it in Arcscan
2. **API** — `curl http://localhost:3000/api/audit/ticks?limit=20` for the last 20 ticks
3. **Direct** — open the seller's address in https://testnet.arcscan.app to see all settlements

---

## The 3 layers of auditability

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Per-second tick (off-chain)                        │
│  ─────────────────────────────────────                      │
│  • Signed EIP-3009 TransferWithAuthorization                │
│  • Stored in /workspace/perstream/backend/data/tick-ledger.jsonl│
│  • Query: GET /api/audit/ticks                              │
│  • Frequency: 1 per second per active session               │
└─────────────────────────────────────────────────────────────┘
                            ↓ batches every ~60s
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Batched settlement (on-chain)                     │
│  ─────────────────────────────────────                      │
│  • Circle Gateway batches the off-chain authorizations       │
│  • One on-chain tx settles ~60 individual ticks             │
│  • Viewable on https://testnet.arcscan.app                  │
│  • Frequency: ~1 tx per minute per active listener          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: USDC transfer (on-chain)                          │
│  ─────────────────────────────────────                      │
│  • Final settlement to creator's wallet                     │
│  • Standard ERC-20 USDC transfer on Arc testnet             │
│  • Visible in creator's wallet balance                      │
│  • Gasless for the creator (Circle facilitator pays)        │
└─────────────────────────────────────────────────────────────┘
```

For a typical 5-minute listening session, you'd see:
- **300 per-second ticks** in the audit ledger (5 min × 60s)
- **~5 batched settlement tx** on Arcscan (one per minute)
- **1 final transfer** to the creator's wallet

---

## How to verify (the 3 ways)

### Way 1: In the app (easiest, for judges)

1. Open the creator dashboard: `https://<your-host>/creator.html`
2. Sign in as `demo-creator@perstream.fm` (or your creator email)
3. Scroll down to the **"🔍 On-chain audit trail"** section
4. You'll see:
   - Total ticks recorded
   - Total USDC streamed
   - Current mode (mock / live)
   - A list of recent ticks, each with a clickable Arcscan link
5. Click any tx hash → opens in https://testnet.arcscan.app
6. The Arcscan page shows the on-chain transaction, the USDC contract call, the block confirmations

### Way 2: API (for automated verification)

```bash
# Get the last 20 ticks
curl -s http://localhost:3000/api/audit/ticks?limit=20 | jq

# Get just the stats
curl -s http://localhost:3000/api/audit/stats | jq

# Download the full JSONL ledger
curl -O http://localhost:3000/api/audit/export
# Saves to tick-ledger.jsonl — each line is one tick
```

Response format:
```json
{
  "mode": "live",
  "stats": {
    "totalTicks": 142,
    "totalAmountMicro": 42600,
    "totalAmountUsd": 0.0426,
    "uniqueListeners": 3,
    "uniqueCreators": 1,
    "oldestTick": "2026-06-27T14:00:00Z",
    "newestTick": "2026-06-27T14:02:22Z"
  },
  "ticks": [
    {
      "ts": "2026-06-27T14:02:22Z",
      "sessionId": "ses_abc123",
      "trackId": "trk-podcast",
      "listener": "0x...",
      "creator": "0x...",
      "amountMicro": 100,
      "amountUsd": 0.0001,
      "txHash": "0xdef456...",
      "arcscanUrl": "https://testnet.arcscan.app/tx/0xdef456...",
      "mode": "live"
    }
  ]
}
```

### Way 3: Direct on Arcscan (the most trustless)

1. Get the seller (creator) address from `GET /api/audit/stats` → `sellerAddress`
2. Open: `https://testnet.arcscan.app/address/<seller-address>`
3. You'll see all inbound USDC transfers — one batched settlement per ~60s of listening
4. Click any transaction → see the on-chain details (block, gas, contract calls, USDC events)

---

## What to look for in a tick entry

| Field | What it means | Trustless? |
|---|---|---|
| `ts` | ISO timestamp of the tick | Server's clock — not on-chain |
| `sessionId` | Unique session UUID | Server-generated |
| `trackId` | Which track was being played | Server-stored |
| `listener` | Listener's wallet address | From authenticated user |
| `creator` | Creator's wallet address | From track record |
| `amountMicro` | Amount paid in micro-USDC | Server-computed, then settled on-chain |
| `amountUsd` | Same, in USD | Derived |
| `txHash` | On-chain tx hash for the batched settlement | **This is the trustless part** |
| `arcscanUrl` | Convenience link to Arcscan | Derived |
| `mode` | `mock` or `live` | — |

In **mock mode**, the `txHash` is a deterministic mock hash (looks like a real one but isn't on-chain). In **live mode**, the `txHash` is a real on-chain transaction you can verify on Arcscan.

---

## How the batching works

```
Per second:   60 ticks/sec (one per active listener)  → 60 EIP-3009 signatures
              ↓
Every ~60s:   Circle Gateway batches signatures      → 1 on-chain tx
              ↓
On Arc:       GatewayWallet.execute()                 → 1 USDC.transfer()
              ↓
              Creator's USDC balance increases         → final settlement
```

This is the magic of Circle Nanopayments. **One on-chain transaction settles 60 individual per-second payments** — without requiring gas from the listener or the backend (Circle facilitator pays).

---

## Where the audit ledger is stored

- **File**: `backend/data/tick-ledger.jsonl` (one JSON object per line)
- **Format**: JSONL (newline-delimited JSON) — easy to grep, jq, or load into a database
- **Append-only** — every tick is added to the end, no entries are ever modified
- **In-memory mirror** — last 1000 entries kept in memory for fast API queries

Example line:
```json
{"ts":"2026-06-27T14:00:12.037Z","sessionId":"ses_abc","trackId":"trk-welcome","listener":"0x...","creator":"0x...","amountMicro":300,"amountUsd":0.0003,"txHash":"0x...","arcscanUrl":"https://testnet.arcscan.app/tx/0x...","mode":"live"}
```

---

## Auditing a specific session

```bash
# 1. Get all ticks for a session
grep '"sessionId":"ses_abc"' backend/data/tick-ledger.jsonl

# 2. Count ticks
grep -c '"sessionId":"ses_abc"' backend/data/tick-ledger.jsonl

# 3. Sum amount paid
grep '"sessionId":"ses_abc"' backend/data/tick-ledger.jsonl | \
  jq -s 'map(.amountMicro) | add'

# 4. Get the Arcscan URLs
grep '"sessionId":"ses_abc"' backend/data/tick-ledger.jsonl | \
  jq -r '.arcscanUrl' | sort -u
```

---

## Auditing the seller (creator) wallet

```bash
# Get the seller address
SELLER=$(curl -s http://localhost:3000/api/audit/stats | jq -r .sellerAddress)
echo "Seller: $SELLER"

# Open in browser
echo "https://testnet.arcscan.app/address/$SELLER"
```

You should see:
- Inbound USDC transfers (one per ~60s batched settlement)
- USDC contract: `0x3600000000000000000000000000000000000000`
- GatewayWallet contract: `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`

---

## Reference

- **Arcscan Testnet Explorer**: https://testnet.arcscan.app
- **Arc Testnet Faucet**: https://faucet.circle.com
- **Circle Nanopayments docs**: https://developers.circle.com/gateway
- **x402 Protocol**: https://x402.org
- **EIP-3009 spec** (TransferWithAuthorization): https://eips.ethereum.org/EIPS/eip-3009

---

## Why this matters for the Lepton Hackathon

The track **RFB 4 — Streaming & Continuous Payments** is about more than building the feature. It's about **provable, auditable, real-time settlement**. The audit trail above is what makes PerStream production-ready:

- **Provable**: every tick is logged with an on-chain tx hash
- **Auditable**: anyone can verify the payment stream via the public ledger
- **Real-time**: ticks appear within 1 second of audio playback
- **Cents-to-dollars scaling**: works for $0.0001/sec (podcasts) and $0.10/sec (premium content) alike

The "every second, paid" claim isn't a slogan — it's a verifiable fact, traceable back to a USDC transfer on Arc.
