# PerStream — Specification

> **Per-second USDC streaming paywall for podcasts and long-form audio, built on Circle Nanopayments + Arc.**
>
> _Lepton Agents Hackathon · Canteen × Circle · June 15–29, 2026_

---

## 1. The Problem (per Canteen's thesis)

Canteen's distribution + bootstrap analysis lands on a specific pain:

- Creators can't monetize from day one without audience thresholds (Patreon needs 1k subs, podcast ads need 5k downloads, paid newsletters need 10k subs).
- Subscriptions and ad breaks don't fit short attention or niche formats.
- Listeners hate paying for content they never finish.

The result: creators churn before they monetize, and their best content stays free, undermonetized, or never made.

## 2. The Insight

**Paywalls are the wrong unit.** Subscriptions, ad spots, even per-episode pricing all force the listener to overpay for under-engagement.

If you can settle a USDC micro-transaction for **every second** of audio actually played, you solve both sides:

- Creator earns from second #1, no audience minimum.
- Listener pays only for what they actually consume.

Until 2026, this was impossible — fees, latency, and minimums (cents) made per-second pricing uneconomic. **Circle Nanopayments on Arc solves this**: gasless USDC transfers as small as $0.000001, sub-second settlement.

## 3. The Product

**PerStream** is a paid-audio streaming layer where:

1. A creator uploads an audio file (mp3, m4a, wav) to PerStream.
2. The creator sets a per-second price (default `0.0003 USDC/sec` = ~$1.08/hr).
3. PerStream returns a public URL (e.g. `https://perstream.fm/track/<id>`).
4. A listener opens the URL, authenticates with an embedded wallet (no seed phrase, no MetaMask popup), and presses play.
5. **Every second of playback settles a USDC micro-payment** to the creator's wallet, gasless, on Arc.
6. Pause = payments stop instantly. Resume = payments start instantly.
7. Creator's dashboard shows real-time earnings, listener count, and per-track metrics.

The technical primitive is **x402 + Circle Nanopayments on Arc**: each second is an HTTP 402 challenge that resolves with a gasless USDC micropayment.

## 4. Why This Wins the Hackathon

| Judge criterion | PerStream's answer |
|---|---|
| Use of Circle infra | **Core**: Nanopayments + Agent Stack + Arc + x402 — every sponsor primitive in one product. |
| Real creator/founder problem | Solves the exact cold-start problem Canteen's analysis named. |
| Adoption-ready | Trivial to plug into existing podcast hosts (RSS import). Circle can ship as their flagship creator app. |
| Demonstrable | 2-min demo writes itself: press play, watch the wallet tick. |
| Traction story | Every podcaster with a back-catalog is a user. Early traction is viral-by-design. |

## 5. Architecture

```
┌────────────────┐  x402 (HTTP 402)   ┌──────────────────┐
│   Listener     │ ─────────────────▶ │  PerStream       │
│   (Browser)    │ ◀────── USDC/frame │  Backend         │
│                │                    │  (Node, Termux)  │
└────────────────┘                    └────────┬─────────┘
        │                                       │
        │ embedded wallet                       │ per-second settlement
        ▼                                       ▼
┌────────────────┐                    ┌──────────────────┐
│  Circle Agent  │ ◀──── gasless ────▶ │  Arc Testnet     │
│  Stack wallet  │      USDC xfer     │  + PerStream     │
│                │                    │  Paymaster.sol   │
└────────────────┘                    └──────────────────┘
```

### 5.1 Backend (Node, runs on Termux)

- **Express server** on port `3000`
- **SQLite** for users, tracks, sessions (zero-config on Termux)
- **Embedded wallet**: email/social login via Circle's developer-friendly wallet pattern
- **x402 middleware**: every `/api/stream/<id>` request returns `402 Payment Required` with price header unless a valid micropayment session exists
- **Meter**: ticks per second, calls `Nanopayments.transfer()` to creator
- **Arc RPC client**: talks to Arc testnet, signs settlement with creator's session key

### 5.2 On-chain contract (Solidity, Arc)

`PerStreamPaymaster.sol`:
- Holds creator earnings in escrow
- Settles per-session accounting
- Allows creator to withdraw USDC anytime
- Emits events for every micro-settlement (for transparency + analytics)

### 5.3 Frontend (static HTML, no build step)

- **`index.html`**: landing page — "PerStream: every second, paid."
- **`listen.html`**: player with live USDC meter, embedded wallet connect
- **`creator.html`**: upload + dashboard

Pure vanilla JS, no React/Vue/Svelte — runs anywhere, deploys anywhere, loads fast.

### 5.4 Deployment

- **Local**: Termux + cloudflared tunnel for public URL
- **Production**: any $5 VPS (DigitalOcean, Hetzner) with the provided Dockerfile
- **Optional**: Vercel/Railway for the backend if you want zero-ops

## 6. Data Flow: one play, end-to-end

1. Listener visits `https://perstream.fm/track/abc123`
2. Frontend checks wallet — if no wallet, prompts email login (Circle Agent Stack embedded)
3. Frontend hits `GET /api/stream/abc123/play?session=<sid>`
4. Backend returns `402 Payment Required` + `X-PerStream-Price: 0.0003` + `X-PerStream-Creator: 0x...`
5. Frontend opens Nanopayments channel, signs `0.0003 USDC` authorization per second
6. Backend starts audio chunk stream + settlement loop
7. Each second: backend calls `paymaster.tick(creator, listener, 0.0003)` → gasless USDC xfer
8. Listener pauses: backend stops the loop
9. On `ended`: backend closes session, creator's earnings visible in dashboard

## 7. MVP Scope (14 days, solo, Termux)

### Must-have (Day 1–10)
- [x] Backend with x402 + Nanopayments flow
- [x] On-chain contract deployable to Arc testnet
- [x] Embedded wallet via Circle Agent Stack
- [x] Frontend: landing + listen + creator dashboard
- [x] Real per-second settlement running end-to-end
- [x] 2 sample tracks seeded for demo
- [x] Public URL via cloudflared

### Nice-to-have (Day 11–14)
- [ ] RSS import — any podcast becomes a PerStream track
- [ ] Creator analytics: top listeners, peak hours, revenue chart
- [ ] Listener history + bookmark

### Not in scope
- Native mobile app (browser is enough for hackathon)
- Multi-creator splits (v2)
- Fiat on-ramp (Circle handles separately)

## 8. Success Metrics for Hackathon Submission

- ✅ Demo video < 2 minutes, shows live per-second USDC tick
- ✅ GitHub repo: clean README, deployable in 5 commands, MIT licensed
- ✅ Live demo URL: `https://perstream-demo.live` (or current deployed URL)
- ✅ At least 3 real users (3 podcasters with 1 track each) before judging
- ✅ Public Twitter thread showing the build in progress
- ✅ Submission form filled + Discord intro posted

## 9. Post-Hackathon (Adoption Path)

If Canteen/Circle picks PerStream up:
1. White-label the frontend → embed in `canteen.fm/listen/<track>`
2. Open API for any creator to plug in (no PerStream UI required)
3. Add AI-agent listeners — let fans' agents pre-authorize a daily listening budget and stream autonomously (the Agent Stack angle)

---

_Built solo by Oluyemi (donyemiight) (@donYemiight) for Lepton Agents Hackathon 2026._