# How PerStream Payments Work — User Guide

> _A simple explanation for creators, listeners, and AI agents who want to use PerStream._

---

## TL;DR

PerStream turns podcasts and audio into **streams of payable seconds**. A listener pays USDC for every second of audio they actually play. A creator earns from second #1 — no ads, no subscriptions, no audience minimum. AI agents can listen autonomously with a USDC budget.

---

## For Listeners

### How much does it cost?

PerStream charges **per second of audio actually played**. Default pricing is **0.0003 USDC per second** (about **$1.08 per hour**).

| What you do | What you pay |
|---|---|
| Listen for 30 seconds | ~$0.009 (less than 1 cent) |
| Listen for 5 minutes | ~$0.09 |
| Listen for 1 hour | ~$1.08 |
| Listen for 10 hours | ~$10.80 |

The price is set per-track by the creator. Some may charge more (premium content), some less (community podcasts).

### How do I pay?

You need a **USDC wallet on Arc** — PerStream creates one for you when you sign in. You deposit USDC into your PerStream wallet (just like adding money to a vending machine), and PerStream deducts from your balance every second.

**No credit card. No subscription. No MetaMask popup.** Just USDC, paid per second.

### Do I lose money if I pause?

**No.** PerStream only deducts USDC when audio is **actively playing**. Pause = payments stop. Resume = payments start. Skip = no charge for skipped seconds.

### What if I run out of balance?

Audio stops. Your session ends. You add more USDC and start a new session.

### Can I get a refund?

No refunds on already-played audio (the creator earned it). But you can withdraw unused balance anytime.

---

## For Creators

### How do I get paid?

You earn **0.0003 USDC per second of every listener's playback** (or whatever price you set). Payment is **instant** — no 30-day wait, no payment processor, no minimum threshold.

| Listener behavior | Your earnings |
|---|---|
| Listener plays 30 seconds | $0.009 |
| Listener plays 5 minutes | $0.09 |
| Listener plays 1 hour | $1.08 |
| 100 listeners play 1 hour each | $108 |

### What do I need to start?

1. Sign in with email
2. Upload an audio file (MP3, M4A, WAV — up to 50MB)
3. Set a price per second (suggested: 0.0003 USDC)
4. Get a public URL to share

That's it. You're live.

### Where does the money go?

USDC accumulates in your **creator wallet on Arc**. You can:
- **Withdraw** at any time (no minimum)
- Let it accumulate
- Use it to pay other PerStream creators
- Bridge to other chains (Circle Gateway)

### How is this different from ads or subscriptions?

| Model | Cold-start cliff? | Payment speed | Audience minimum |
|---|---|---|---|
| **Ads** | Yes (need ~5k downloads) | 30-60 days | High |
| **Subscriptions** | Yes (need ~1k subs) | Monthly | High |
| **Tip jar** | Yes (need loyal fans) | Immediate | Medium |
| **PerStream** | **No** | **Per second** | **1 listener is enough** |

### What's the catch?

There isn't one — but two practical notes:
1. **Crypto adoption**: your listener needs a USDC wallet. PerStream creates one automatically (embedded wallet via Circle Agent Stack).
2. **Price discovery**: you choose your per-second price. Start low (0.0001 = $0.36/hr) to attract listeners, raise later as you gain audience.

---

## For AI Agents

### How do I, as an agent, use PerStream?

You have three options:

#### Option 1: Use the HTTP API directly

```bash
# Provision your agent's wallet
POST /api/auth/login
{ "email": "my-agent@example.com" }

# See available tracks
GET /api/tracks

# Try to listen — get 402 Payment Required if no deposit
GET /api/tracks/trk-loop/stream
# Response headers:
#   X-PerStream-Price: 100  (micro-USDC per second)

# Deposit USDC
POST /api/listen/deposit
{ "amountUsd": "5" }

# Start listening session
POST /api/listen/start
{ "trackId": "trk-loop" }

# Poll for current state (returns per-second tick)
GET /api/listen/poll?sessionId=ses_xxx

# Stop when done
POST /api/listen/stop
{ "sessionId": "ses_xxx" }
```

#### Option 2: Use the autonomous agent endpoint

```bash
# Tell PerStream: "Here is $5, go consume audio autonomously"
POST /api/agent/auto
{
  "budgetUsd": 5,
  "maxTracks": 3
}
```

The agent will:
1. Provision its own USDC wallet
2. Deposit your budget
3. Discover tracks on PerStream
4. Pick one (shortest/cheapest strategy)
5. Listen, paying per second
6. When track ends or budget runs low, pick the next
7. Return full consumption log

#### Option 3: Use the per-track endpoint with explicit budget

```bash
POST /api/agent/listen
{
  "trackId": "trk-podcast-123",
  "budgetUsd": 1,
  "maxSeconds": 600
}
```

The agent listens for up to 10 minutes or until $1 spent, whichever comes first.

### How does my agent pay for things?

Your agent gets a USDC wallet on Arc automatically. You (the agent's operator) must fund that wallet with USDC before the agent can consume. This is done via Circle Agent Stack (embedded wallet) and Circle Nanopayments (gasless micro-transfers).

For mock/dev mode, PerStream auto-funds the agent with simulated USDC. For production, you fund via:
- Circle's USDC faucet (testnet)
- Bridge from another chain via CCTP
- Receive from another PerStream user/agent

### What's the consumption record?

Every listen session produces a verifiable record:

```json
{
  "sessionId": "ses_abc123",
  "trackId": "trk-welcome",
  "trackTitle": "PerStream Theme — Welcome to paid seconds",
  "secondsPlayed": 60,
  "totalPaidUsd": "0.018000",
  "creatorWallet": "0xabc...",
  "startedAt": 1234567890,
  "endedAt": 1234567950
}
```

This record is hashable, signable, and auditable on Arc. You can prove what your agent consumed.

---

## How the money actually moves (under the hood)

When a listener presses play:

```
1. Browser sends: POST /api/listen/start
   ↓
2. Backend opens session in DB, returns sessionId
   ↓
3. Every second, backend calls:
   POST /api/listen/tick (internal)
   ↓
4. Backend calls PerStreamPaymaster.tick() on Arc:
   - Debits listener's deposit by pricePerSec
   - Credits creator's balance by pricePerSec
   ↓
5. USDC settles gasless via Circle Nanopayments
   (no ETH/gas needed — Arc is stablecoin-native)
   ↓
6. Frontend polls /api/listen/poll every 1.1s
   - Sees updated secondsPlayed, amountPaid, balance
   - Updates USDC counter in UI
   ↓
7. Listener pauses or track ends → POST /api/listen/stop
   - Session closes in DB
   - Creator's earnings accumulate in their wallet
   ↓
8. Creator clicks "Withdraw" → USDC moves from
   PerStreamPaymaster to creator's external wallet
```

**All steps are auditable on Arc's block explorer.** Every micro-payment is a real on-chain transaction.

---

## Why sub-cent pricing works (the technology that makes this possible)

Traditional blockchains charge **$0.01–$1.00 per transaction**. That makes per-second pricing uneconomic (one second of audio for $0.0003 would be wiped out by fees).

**Circle Nanopayments** solves this by:
1. **Gasless**: no separate gas token (Arc is stablecoin-native)
2. **Sub-cent minimum**: as low as $0.000001 per transfer
3. **Sub-second finality**: confirmations in milliseconds, not minutes
4. **Batched settlement**: multiple micropayments batch into one on-chain tx (saves gas)

This is what makes PerStream possible. Without Circle Nanopayments on Arc, this product couldn't exist.

---

## Glossary

| Term | Meaning |
|---|---|
| **USDC** | A stablecoin pegged 1:1 to the US dollar. What PerStream uses for payment. |
| **Arc** | Circle's stablecoin-native Layer 1 blockchain. Where all USDC transactions settle. |
| **Nanopayment** | A payment smaller than one cent ($0.000001 minimum on Arc). |
| **x402** | The HTTP 402 "Payment Required" status code, used as a payment challenge. |
| **Agent Stack** | Circle's developer toolkit for building AI agents with embedded USDC wallets. |
| **PerStreamPaymaster** | The on-chain contract (Arc) that holds USDC and settles per-second payments. |
| **Embedded wallet** | A USDC wallet created automatically when you sign in. No seed phrase, no MetaMask popup. |
| **Cold-start cliff** | The problem PerStream solves: creators can't earn until they have a large audience. |

---

## Common questions

**Q: Do I need to buy crypto to use PerStream?**
A: You need USDC. You can get USDC from any major exchange (Coinbase, Binance, etc.) and bridge to Arc. Or use Circle's testnet faucet for development.

**Q: What if I lose my PerStream account?**
A: Your wallet is tied to your email. Sign in with the same email to recover access.

**Q: Can I set my own price as a listener?**
A: No. The creator sets the per-second price. You can choose not to listen if it's too high.

**Q: Is there a minimum or maximum per-second price?**
A: Technically no, but practical ranges are 0.0001 (very cheap) to 0.01 ($36/hr) USDC.

**Q: Can I transfer my earnings to fiat currency?**
A: Yes, via Circle Gateway (cross-chain USDC bridge) then to any major exchange.

**Q: How does this compare to Bandcamp or Patreon?**
A: Bandcamp/Patreon charge ~5–12% platform fees. PerStream has no platform fee (only network gas, which is ~$0.01 per withdraw on Arc). Creators keep 100% of what they earn, minus network costs.

---

## Need help?

- **Discord**: Join the [Lepton Hackathon Discord](https://discord.gg/8P9Hksd6SU) and ping @donYemiight
- **GitHub**: https://github.com/Donyemiight/PerStream/issues
- **Live demo**: https://zusbfcomkq8u.space.minimax.io

Built by Oluyemi (donyemiight) for the Lepton Agents Hackathon 2026.