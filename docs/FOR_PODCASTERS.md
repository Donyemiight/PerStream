# PerStream — For Podcasters (How to Use It)

> _You finished an episode. You want to publish it on PerStream. Here's how._

---

## TL;DR

PerStream treats your MP3 like a streaming meter. Listeners deposit USDC, hit play, and pay you **per second of audio actually played**. The system works for any audio length — 30 seconds, 30 minutes, 3 hours. The demo only has 4-minute content for hackathon time reasons, but the production code is the same for any duration.

---

## Three ways to use PerStream

### 1. Use the hosted demo (no setup, fastest)

Best for: trying it out, sharing with your podcast co-host, getting a feel.

- Go to **https://41fqzfd7q5ya.space.minimax.io**
- Sign in with any email
- Listen to the 4-minute sample episode
- Open `creator.html` in another tab — sign in as `demo-creator@perstream.fm`
- See your "earnings" tick up as the listener plays

**Limitations**: only the 4 preloaded tracks. Mock mode (no real USDC).

---

### 2. Run it locally with your own audio (15 minutes)

Best for: testing with your real podcast episode before deploying.

**Step 1 — Clone the repo**

```bash
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream
```

**Step 2 — Drop your MP3 in**

Put your podcast file here:
```
backend/data/audio/track-1-my-episode.mp3
```

**Step 3 — Add it to the database**

Edit `scripts/seed.js` and add your track to the array:

```js
{
  title: 'Ep. 42: My First PerStream Episode',
  description: 'Why I switched to per-second payments',
  pricePerSec: 100,           // 0.0001 USDC/sec = $0.006/min
  durationSec: 1800,          // 30 minutes
  filename: 'track-1-my-episode.mp3',
}
```

Then run:
```bash
cd backend && npm install --no-audit --no-fund --omit=optional
node scripts/seed.js
npm start
```

**Step 4 — Open it**

Go to `http://localhost:3000/listen.html`, sign in, pick your track, deposit, hit play.

You now have a working per-second paywall for your own episode. Local-only, no blockchain, no fees.

---

### 3. Deploy with real USDC on Arc testnet (production)

Best for: actually getting paid in real USDC by real listeners.

**Requirements:**
- Circle API key (get from https://console.circle.com)
- Arc testnet USDC for testing (faucet: https://faucet.circle.com)
- A server (Render.com free tier works, ~15 min to deploy)

**Step 1 — Configure**

Copy `backend/.env.example` to `backend/.env` and fill in:

```bash
ARC_MODE=live
ARC_API_KEY=your_circle_api_key_here
ARC_CHAIN_ID=arc_testnet
PORT=3000
```

**Step 2 — Deploy**

```bash
git push heroku main       # or render.com, railway.app, fly.io
```

**Step 3 — Get your creator wallet**

When the backend starts, the seed script creates `demo-creator@perstream.fm` with a real Arc testnet wallet. The wallet address is logged at startup. **Send testnet USDC to that address** to fund it.

**Step 4 — Listeners pay in real USDC**

When a listener deposits, the funds actually move to the smart contract (`contracts/PerStreamPaymaster.sol`). When they hit play, the contract streams USDC to your wallet second by second. **You get paid in real money.**

---

## Pricing your podcast

The economics are different from subscriptions. Here's a calculator:

| Episode length | Price per second | Total per full listen |
|---|---|---|
| 5 min | 100 µUSDC | $0.03 (3 cents) |
| 5 min | 500 µUSDC | $0.15 (15 cents) |
| 30 min | 100 µUSDC | $0.18 (18 cents) |
| 30 min | 1000 µUSDC | $1.80 |
| 1 hour | 100 µUSDC | $0.36 |
| 1 hour | 500 µUSDC | $1.80 |

**Rule of thumb**: most podcasters should charge **50–200 micro-USDC per second** ($0.003–$0.012 per minute). That's enough to feel like "real money" to you but not painful for a curious listener.

**Compare to subscriptions**:
- Spotify pays ~$0.003 per stream (30-min episode)
- Apple Podcasts: ~$0.0025 per stream
- **PerStream with 100 µUSDC/sec: $0.18 per full 30-min listen**

That's 50–70x more than Spotify. For a 1,000-listener month, that's $180 instead of $3. PerStream's per-second model is dramatically more creator-friendly.

---

## How the per-second payment actually works

1. **Listener deposits** USDC into a smart contract (held in escrow).
2. **Listener hits play** → backend returns the audio URL + starts a session.
3. **Every 1 second**, a `setInterval` ticks:
   - Deducts `pricePerSec` from the listener's balance in the contract
   - Credits the same amount to your wallet
4. **Listener pauses** → the meter stops. No payment.
5. **Listener closes the tab** → session ends, no further payment.

The contract code is in `contracts/PerStreamPaymaster.sol`. It uses Circle's `Nanopayments` primitive (which batches the per-second ticks into one on-chain settlement every N seconds to save gas).

---

## What listeners see

From the listener's perspective:

1. Open your podcast page
2. Sign in with email (wallet auto-created)
3. See your track: "Ep. 42: My First PerStream Episode — 30 min — $0.006/min"
4. Click + Add 5 USDC (one-time deposit)
5. Hit ▶ Start Streaming
6. Watch their balance tick down as they listen
7. Pause anytime — the meter stops

They don't pay for ads, intros they skip, or episodes they abandon halfway. **They only pay for what they actually hear.**

---

## What creators see (dashboard)

Open `creator.html` while signed in as a creator:

- **Total earnings** (real USDC, on Arc)
- **Active sessions** (listeners currently streaming)
- **Earnings per track** (which episodes earn most)
- **Listener feedback** (5-star ratings + comments)
- **Payout button** (withdraw to your bank via Circle)

---

## File structure cheat sheet

```
PerStream/
├── backend/
│   ├── data/
│   │   ├── audio/         ← PUT YOUR MP3s HERE
│   │   │   ├── track-1-welcome.mp3
│   │   │   ├── track-2-pitch.mp3
│   │   │   └── track-3-loop.mp3
│   │   └── perstream.db   ← SQLite database
│   └── src/
│       ├── server.js
│       ├── meter.js        ← the per-second tick engine
│       ├── arc.js          ← Circle API client
│       └── db.js           ← sql.js (no native build)
├── frontend/
│   └── assets/             ← static files served by backend
├── contracts/
│   └── PerStreamPaymaster.sol  ← the on-chain payment logic
├── scripts/
│   ├── seed.js             ← adds your tracks to the DB
│   └── smoke-test.js       ← 16 tests, run after any change
└── docs/
    ├── FOR_PODCASTERS.md   ← you are here
    ├── HOW_PAYMENTS_WORK.md
    ├── AGENT_STORY.md
    └── TERMUX_TROUBLESHOOTING.md
```

---

## Common questions

**Q: Can listeners skip the ads?**
A: Yes. They can scrub anywhere in the audio. You only get paid for the seconds they actually play.

**Q: What if a listener's internet drops mid-stream?**
A: The session ends. They can resume from where they were (we store last timestamp), but they only pay for time actually played.

**Q: How much gas does this use?**
A: Almost zero. The Nanopayments primitive batches ticks off-chain and settles on-chain once per minute. One on-chain transaction per minute of listening, not 60.

**Q: Can I use this for video?**
A: Yes, but the demo is audio-only. The contract works for any `durationSec` × `pricePerSec` calculation.

**Q: What about transcripts?**
A: Coming soon. The brief mentions "real-time transcription paid per second of audio" as another use case. The same `pricePerSec` × `secondsActive` model works.

---

## Need help?

- Open an issue: https://github.com/Donyemiight/PerStream/issues
- Twitter DM: [@DonYemiight](https://x.com/DonYemiight)
- Telegram: @Donyemiight

Built for the Lepton Agents Hackathon, June 2026.
