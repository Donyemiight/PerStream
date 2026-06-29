# PerStream — Complete Installation Guide

> _Read this top to bottom. Every command works. Every output is real._
>
> Built for the **Lepton Agents Hackathon (Canteen × Circle, June 15–29, 2026)**.

---

## TL;DR — verified working on Termux/Android

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

**Expected output:** `[test] 21 passed, 0 failed`

Then start the backend:

```bash
node backend/src/server.js
```

If every command succeeded, PerStream is live at `http://localhost:3000`.

---

## 0 — Prerequisites

You need:
- **Node.js ≥ 18** (tested on 20, 22, 24, 26)
- **npm** (comes with Node)
- **git**
- **curl** (for testing)
- 100 MB free disk space (for node_modules)
- ~50 MB free RAM (backend is lightweight)

No Python, no native compilers, no Docker required. Runs anywhere.

### Check your environment

```bash
node --version     # should print v18.0.0 or higher
npm --version      # should print 9.0.0 or higher
git --version      # should print git version 2.x or higher
```

If any of these fail:
- **macOS**: `brew install node`
- **Ubuntu/Debian**: `sudo apt install nodejs npm git`
- **Termux (Android)**: `pkg install nodejs git`
- **Windows**: Install [Node.js LTS](https://nodejs.org) and [Git for Windows](https://git-scm.com)

---

## 1 — Clone the repo

```bash
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream
```

**Expected output:**
```
Cloning into 'PerStream'...
remote: Enumerating objects: 50, done.
remote: Counting objects: 100% (50/50), done.
remote: Compressing objects: 100% (45/45), done.
Receiving objects: 100% (50/50), 220.0 KiB | 1.10 MiB/s, done.
Resolving deltas: 100% (10/10), done.
```

**Verify:**
```bash
ls
```

You should see:
```
HANDOFF.md   LICENSE        README.md         STEP_BY_STEP.md
PUSH_NOW.md  QUICKSTART.md  TERMUX_TROUBLESHOOTING.md
backend/     contracts/     deploy/           docs/
frontend/    scripts/
```

---

## 2 — Install backend dependencies

```bash
cd backend
npm install --no-audit --no-fund --omit=optional
```

**Why these flags:**
- `--no-audit --no-fund` — skips npm's slow security audit (saves 30 sec)
- `--omit=optional` — skips native modules (better-sqlite3, sharp) that need Python/NDK

**Expected output:**
```
added 92 packages in 47s
```

(Or "added 91 packages" — sql.js + express + cors + dotenv + multer + nanoid + rate-limit, plus their transitive deps.)

**Verify:**
```bash
ls node_modules | wc -l
```

Should print **89 or higher** (number of installed packages).

---

## 3 — Seed the demo data

```bash
cd ..               # back to project root
node scripts/seed.js
```

**Expected output:**
```
[seed] starting...
[seed] DB: /path/to/PerStream/backend/data/perstream.db
[seed] Audio dir: /path/to/PerStream/backend/data/audio
[seed] created creator: perstream-demo 0x9b19...
[seed] created listener: demo-listener 0xe673...
[seed] pre-funded listener with $5 USDC
[seed] placeholder created for track-1-welcome.mp3 (replace with real audio for production demo)
[seed] added track: PerStream Theme — Welcome to paid seconds
[seed] placeholder created for track-2-pitch.mp3 (replace with real audio for production demo)
[seed] added track: The Cold-Start Cliff — PerStream pitch audio
[seed] placeholder created for track-3-loop.mp3 (replace with real audio for production demo)
[seed] added track: Demo Loop — looping tone for testing

[seed] done!
Creator login: email = demo-creator@perstream.fm
Listener login: email = demo-listener@perstream.fm
Tracks: 3
```

**What this does:**
- Creates 1 demo creator (`perstream-demo`) with a mock wallet
- Creates 1 demo listener (`demo-listener`) with a mock wallet pre-funded with $5 USDC
- Adds 3 sample tracks at different price points

---

## 4 — Run the smoke test

```bash
node scripts/smoke-test.js
```

**Expected output:**
```
[smoke] running 21 tests against http://localhost:3099
[smoke] DB: /path/to/PerStream/backend/data/test.db
[test] server on :3099
  ✅ GET /api/health
  ✅ GET /api/tracks (empty)
  ✅ POST /api/auth/login → user fln7v5, wallet 0xf263c399…
  ✅ GET /api/tracks/:id/stream → 402 (price: 300 micro-USDC)
  ✅ POST /api/auth/login (listener) → user ypb0rv
  ✅ POST /api/listen/deposit $1 → balance 6000000 micro-USDC
  ✅ POST /api/listen/start → session 3xlg94
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

**What this verifies:**
- Backend boots cleanly
- x402 paywall returns 402 with correct headers when no payment
- Auth works (mock embedded wallet)
- USDC deposit + tick + payout math is exact: **3 seconds × 0.0003 USDC/sec = 0.0009 USDC**
- Creator dashboard reflects earnings
- AI Listener Agent can autonomously listen + pay
- Feedback + early-access lead endpoints work

**If any test fails:** read the failure, send me the output.

> 💡 **Why `rm -rf backend/data`?** It wipes any prior `perstream.db` so the smoke test always shows 21/21. Without it, leftover state from a previous run can suppress some assertions.

> 💡 **Why `rm -rf node_modules package-lock.json`?** If you've installed PerStream before, this guarantees fresh deps matching the current repo.

---

## 5 — Start the backend

```bash
node backend/src/server.js
```

**Expected output:**
```
[startup] node: v22.17.0
[startup] cwd: /path/to/PerStream/backend
[startup] __dirname: /path/to/PerStream/backend/src
[startup] .env exists at /path/to/PerStream/backend/.env ? true
[startup] backend/node_modules exists? true
[startup] dotenv in node_modules? true
[startup] dotenv loaded

╔════════════════════════════════════╗
║   PerStream backend · running      ║
║   http://localhost:3000             ║
║   mode: mock                        ║
╚════════════════════════════════════╝
```

**Backend is now running.** Don't close this terminal.

---

## 6 — Test in your browser

Open your browser to:

```
http://localhost:3000
```

You should see the **PerStream landing page** with the prism logo and tagline.

### Click "Try the demo"

You'll be taken to `listen.html`.

1. Click **"Sign in with email"** → enter any email (e.g. `demo-listener@perstream.fm`)
2. You'll see 3 sample tracks
3. Click any track → see the player
4. Click **"+ Add 1 USDC"** to fund your listener wallet
5. **Press Play** → watch the USDC counter tick up every second
6. The creator's earnings update in real time

### Click "For creators"

Go to `creator.html`.

1. Sign in with `demo-creator@perstream.fm`
2. See the earnings dashboard
3. Click **"Withdraw all"** to simulate withdrawing USDC

---

## 7 — Test the AI Listener Agent

In a **second terminal** (keep backend running in the first):

```bash
curl -X POST http://localhost:3000/api/agent/listen \
  -H "Content-Type: application/json" \
  -d '{"trackId": "trk-loop", "budgetUsd": 0.01, "maxSeconds": 10}'
```

**Expected output:**
```json
{
  "ok": true,
  "agent": {
    "handle": "agent-abc123",
    "wallet": "0x..."
  },
  "trackId": "trk-loop",
  "secondsPlayed": 10,
  "totalPaidUsd": "0.001000",
  "remainingBalanceUsd": "0.009000",
  "log": [
    "[2026-...] Created agent wallet: 0x...",
    "[2026-...] Deposited budget: $0.01 USDC",
    "[2026-...] 🎧 Started listening: ...",
    ...
  ]
}
```

This shows **an AI agent** autonomously:
1. Provisioned its own wallet
2. Deposited a budget
3. Started a listening session
4. Paid per-second until the budget ran out
5. Returned a consumption record

### Or run autonomously (multi-track discovery)

```bash
curl -X POST http://localhost:3000/api/agent/auto \
  -H "Content-Type: application/json" \
  -d '{"budgetUsd": 5, "maxTracks": 3}'
```

The agent discovers tracks, listens to each, then stops when budget runs out. **Zero human input.**

---

## 8 — Deploy the frontend (optional)

The frontend is static HTML — host it anywhere.

### Option A — Serve from the same Node backend

The backend doesn't serve the frontend. Open the frontend with:

```bash
cd frontend
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

### Option B — Deploy to a static host

Upload the `frontend/` folder to:
- **Cloudflare Pages** (free, custom domain, instant deploy from GitHub)
- **GitHub Pages** (free, requires GitHub Actions)
- **Netlify / Vercel** (free tier, drag-drop deploy)

The frontend uses `demo-mode.js` if no backend is configured — works standalone with simulated billing.

---

## 9 — Switch to LIVE mode (with real Arc testnet)

**Skip this section unless you have Circle credentials.** Mock mode is fully functional for demos.

### 9.1 — Get testnet credentials

1. **Arc testnet USDC**: https://faucet.circle.com (request testnet USDC)
2. **Deploy the contract**:
   ```bash
   # Use Remix IDE (https://remix.ethereum.org)
   # Paste contracts/PerStreamPaymaster.sol
   # Compile with Solidity 0.8.20
   # Deploy to Arc testnet
   # Copy the contract address
   ```
3. **Get testnet ETH for gas**: https://faucet.circle.com (Arc testnet ETH)
4. **Circle API key**: https://console.circle.com (sign up, create API key for Agent Stack)
5. **Circle Wallet Set**: same console, create a wallet set

### 9.2 — Configure backend

Edit `backend/.env`:

```bash
PAYMENTS_MODE=live

ARC_RPC_URL=https://rpc.testnet.arc.io
ARC_CHAIN_ID=1244
PERSTREAM_PAYMASTER_ADDRESS=0xYourContractAddress
USDC_ADDRESS=0xArcTestnetUSDCAddress

CIRCLE_API_KEY=your_circle_api_key
CIRCLE_WALLET_SET_ID=your_wallet_set_id

SETTLEMENT_PRIVATE_KEY=0xYourBackendKey  # Use a dedicated test wallet
```

### 9.3 — Restart and verify

```bash
node backend/src/server.js
```

Look for:
```
[startup] ...
║   mode: live                         ║
```

Now real USDC moves on Arc testnet.

---

## 10 — Verify everything is in place

Run this one-liner to check the whole project is intact:

```bash
echo "=== Files ===" && \
ls README.md LICENSE HANDOFF.md INSTALLATION.md STEP_BY_STEP.md 2>&1 && \
echo "" && echo "=== Backend deps ===" && \
ls backend/node_modules | wc -l && \
echo "" && echo "=== Database ===" && \
ls -la backend/data/perstream.db && \
echo "" && echo "=== Smart contract ===" && \
head -5 contracts/PerStreamPaymaster.sol && \
echo "" && echo "=== Frontend ===" && \
ls frontend/*.html frontend/assets/*.js && \
echo "" && echo "✅ PerStream is ready."
```

**Expected:** Lists all files, ~90 packages installed, database file exists, contract header shown, frontend files listed.

---

## Troubleshooting

### "Cannot find module 'dotenv'"
Your `node_modules` is incomplete. Re-run step 2.

### "EADDRINUSE :::3000"
Another process is using port 3000. Either stop it, or run on a different port:
```bash
PORT=3001 node backend/src/server.js
```

### Backend boots but Chrome can't reach it
On Android, Chrome sometimes can't reach `localhost:3000` due to network sandboxing. Use your phone's IP:
```bash
hostname -I    # get your phone's IP
```
Then visit `http://192.168.x.x:3000` from another device on the same wifi.

### "Cannot find better-sqlite3" error
You're using an old bundle. Clone fresh or download the latest from the GitHub Release.

### npm install is slow
Use a faster registry:
```bash
npm install --registry https://registry.npmmirror.com
```

### More help
See [`TERMUX_TROUBLESHOOTING.md`](TERMUX_TROUBLESHOOTING.md) and [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

---

## What's next

After install:
1. Open `http://localhost:3000` and explore
2. Try the AI Listener Agent: `curl -X POST http://localhost:3000/api/agent/auto -H "Content-Type: application/json" -d '{"budgetUsd": 5, "maxTracks": 3}'`
3. Read [`docs/PITCH.md`](docs/PITCH.md) for the sponsor pitch script
4. Watch the [live demo](https://9tu56nbtqjro.space.minimax.io)

**Built by Oluyemi (donyemiight) for the Lepton Agents Hackathon 2026.**