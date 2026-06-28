# PerStream — Quickstart (5 minutes)

> Get PerStream running locally in under 5 minutes.

## TL;DR

```bash
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream
cd backend && npm install --no-audit --no-fund --omit=optional && cd ..
node scripts/seed.js
node scripts/smoke-test.js     # should print: [test] 16 passed, 0 failed
node backend/src/server.js
```

Open `http://localhost:3000` → done.

---

## What just happened?

| Command | What it does |
|---|---|
| `git clone` | Downloads the repo |
| `npm install` | Installs 8 backend dependencies (pure JS, no native compile) |
| `node scripts/seed.js` | Creates demo creator, listener, and 4 tracks |
| `node scripts/smoke-test.js` | Runs 16 tests to verify everything works |
| `node backend/src/server.js` | Starts the backend on port 3000 |

---

## Demo accounts (after seeding)

| Role | Email |
|---|---|
| Creator | `demo-creator@perstream.fm` |
| Listener | `demo-listener@perstream.fm` |

Or use **any email** — the system creates an embedded Arc wallet on the fly.

---

## Pages to try

| URL | What |
|---|---|
| `http://localhost:3000` | Landing page (story-driven hero, features, Arcscan verification) |
| `http://localhost:3000/listen.html` | Listener experience — sign in, deposit USDC, play track |
| `http://localhost:3000/creator.html` | Creator Dashboard — upload, edit, withdraw |

---

## What's where

```
PerStream/
├── backend/                  Node + Express + sql.js
│   ├── src/                  Server code (server.js, db.js, arc.js, ...)
│   ├── data/                 SQLite + uploaded audio
│   └── .env.example          Configuration template
├── frontend/                 Static HTML/JS (no build)
│   ├── index.html, listen.html, creator.html
│   └── assets/               CSS, JS, MP3s
├── contracts/                Solidity smart contract
├── scripts/                  seed, smoke test, bundle
├── docs/                     Full documentation
├── README.md                 ← main entry point
├── INSTALLATION.md           ← detailed installation
└── QUICKSTART.md             ← you are here
```

---

## Need live mode (real Arc testnet)?

See [`docs/LIVE_DEPLOY.md`](docs/LIVE_DEPLOY.md). You'll need:
1. Testnet USDC from https://faucet.circle.com
2. Seller wallet private key
3. `PAYMENTS_MODE=live` in `backend/.env`

---

## Troubleshooting

**`node` not found?** Install Node.js ≥ 18 from [nodejs.org](https://nodejs.org) or `brew install node` (macOS) or `pkg install nodejs` (Termux).

**`npm install` fails on native modules?** This repo uses `sql.js` and `bcryptjs` (pure JS) — no native compilation. If you see errors, check your Node version.

**Port 3000 in use?** Edit `backend/.env` and change `PORT=3001`, then visit `http://localhost:3001`.

**Smoke test fails?** Run with verbose output: `node scripts/smoke-test.js` will show which test failed. Most common: backend wasn't restarted after editing `.env`.

---

## Next steps

- Read [`README.md`](README.md) for the full picture
- Read [`docs/SPEC.md`](docs/SPEC.md) for technical spec
- Read [`docs/API.md`](docs/API.md) for the API reference
- Read [`docs/LIVE_DEPLOY.md`](docs/LIVE_DEPLOY.md) for live Arc testnet setup
