# PerStream — Quickstart (under 2 minutes)

> Get PerStream running locally. Verified working on **Termux/Android**, macOS, and Linux.

## The exact commands (copy/paste)

```bash
cd ~
rm -rf PerStream
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream/backend
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --omit=optional
cp .env.example .env
cd ..
rm -rf backend/data
node scripts/smoke-test.js
```

**Expected output:**
```
[smoke] running 21 tests against http://localhost:3099
[smoke] DB: .../backend/data/test.db
...
  ✅ GET /api/health
  ✅ GET /api/tracks (empty)
  ✅ POST /api/auth/login → user xxx, wallet 0xf263c399…
  ✅ GET /api/tracks/:id/stream → 402 (price: 300 micro-USDC)
  ✅ POST /api/auth/login (listener) → user xxx
  ✅ POST /api/listen/deposit $1 → balance 6000000 micro-USDC
  ✅ POST /api/listen/start → session xxx
  ✅ GET /api/listen/poll → 3s played, 900 micro-USDC paid
  ✅ POST /api/listen/stop → total paid 0.0009 USDC
  ✅ GET /api/creator/dashboard → earnings null USDC, 1 tracks
  ✅ GET /api/agent/info → 6 agent capabilities
  ✅ POST /api/agent/listen → agent ran 3s, paid $0.0009
  ✅ POST /api/feedback → rating recorded
  ✅ GET /api/feedback/stats → 1 ratings, avg 5/5
  ✅ POST /api/lead → early-access signup recorded
  ✅ GET /api/lead/count → 1 leads

[test] 21 passed, 0 failed
```

## Then start the backend

```bash
node backend/src/server.js
```

Open in any browser:
- **`http://localhost:3000`** — landing page
- **`http://localhost:3000/listen.html`** — listener experience
- **`http://localhost:3000/creator.html`** — creator dashboard

---

## Why these specific commands?

| Command | Why it matters |
|---|---|
| `rm -rf PerStream` | Clean slate — eliminates any drift from prior clones |
| `rm -rf node_modules package-lock.json` | Force fresh dep install matching current repo |
| `npm install --no-audit --no-fund --omit=optional` | Skips optional deps (Termux safety), no audit noise |
| `cp .env.example .env` | Defaults are fine for mock mode |
| `rm -rf backend/data` | Wipes leftover DB state — smoke test always shows 21/21 |
| `node scripts/smoke-test.js` | Verifies everything works before you start the server |

## What each test does

| # | Test | What it verifies |
|---|---|---|
| 1 | `GET /api/health` | Backend is up |
| 2 | `GET /api/tracks` | Track listing endpoint works |
| 3 | `POST /api/auth/login` | Embedded Arc wallet provisioning |
| 4 | `GET /api/tracks/:id/stream → 402` | x402 paywall enforcement |
| 5 | `POST /api/auth/login` (listener) | Second user can sign in |
| 6 | `POST /api/listen/deposit` | USDC deposit credits the user |
| 7 | `POST /api/listen/start` | Streaming session starts |
| 8 | `GET /api/listen/poll` | Per-second ticks are recording |
| 9 | `POST /api/listen/stop` | Session ends cleanly |
| 10 | `GET /api/creator/dashboard` | Creator can see their stats |
| 11 | `GET /api/agent/info` | AI Listener Agent capabilities |
| 12 | `POST /api/agent/listen` | AI agent can autonomously listen + pay |
| 13 | `POST /api/feedback` | 5-star rating + comment capture |
| 14 | `GET /api/feedback/stats` | Aggregate feedback stats |
| 15 | `POST /api/lead` | Early-access email signup |
| 16 | `GET /api/lead/count` | Lead count retrieval |

---

## Pages to try

| URL | What |
|---|---|
| `http://localhost:3000` | Landing page (story-driven hero, features, Arcscan verification) |
| `http://localhost:3000/listen.html` | Listener experience — sign in, deposit USDC, play track |
| `http://localhost:3000/creator.html` | Creator Dashboard — upload, edit, withdraw |

---

## Need live mode (real Arc testnet)?

See [`docs/LIVE_DEPLOY.md`](docs/LIVE_DEPLOY.md). You'll need:
1. Testnet USDC from https://faucet.circle.com
2. Seller wallet private key
3. `PAYMENTS_MODE=live` in `backend/.env`

---

## Troubleshooting

**Smoke test shows fewer than 21 passed?**

Run the full sequence above starting from `rm -rf PerStream`. The state from prior runs (especially `backend/data/perstream.db`) can interfere.

**`node` not found?** Install Node.js ≥ 18 from [nodejs.org](https://nodejs.org), `brew install node` (macOS), or `pkg install nodejs` (Termux).

**Port 3000 in use?** Edit `backend/.env` and set `PORT=3001`, then visit `http://localhost:3001`.

**`npm install` fails on native modules?** This repo uses `sql.js` and `bcryptjs` (pure JS) — no native compilation needed.

---

## Next steps

- Read [`README.md`](README.md) for the full picture
- Read [`docs/SPEC.md`](docs/SPEC.md) for technical spec
- Read [`docs/API.md`](docs/API.md) for the API reference
- Read [`docs/LIVE_DEPLOY.md`](docs/LIVE_DEPLOY.md) for live Arc testnet setup