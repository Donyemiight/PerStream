# PerStream

> **Per-second USDC streaming paywall for podcasts and long-form audio.**
> Built on **Circle Nanopayments** + **Arc testnet** + **x402** + **viem embedded wallets**.

**Tagline:** _Every second, paid._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Hackathon](https://img.shields.io/badge/Lepton%20Agents-RFB%204-00d4ff)](https://www.leptonagents.com)
[![Chain](https://img.shields.io/badge/Arc-Testnet-ff00aa)](https://testnet.arcscan.app)
[![Status](https://img.shields.io/badge/Status-Live%20on%20Arc-10b981)]()

Built for the **Lepton Agents Hackathon (Canteen × Circle, June 15–29, 2026)**.
**Track:** RFB 4 — Streaming & Continuous Payments (also fits RFB 6 — AI as Economic Actors).

---

## What is PerStream?

PerStream lets **creators** monetize audio from **listener #1** by charging USDC for every second of audio actually played. No subscriptions. No ads. No audience minimum. Press play, USDC ticks every second, creator earns.

**For listeners** — pay only for the seconds you hear. Pause = stop paying.
**For creators** — earn from listener #1. Settled every 30 seconds, on-chain, on Arc.
**For AI agents** — autonomous agents can subscribe, stream, and rate on behalf of users.

### Tech stack
- **Circle Nanopayments** — gasless USDC micro-payments (as small as $0.000001)
- **x402** — HTTP 402 paywall pattern, sponsor-aligned
- **viem embedded wallets** — deterministic, no MetaMask (Circle Agent Stack flow available when keys are provided)
- **Arc testnet** — Circle's stablecoin-native L1 (chain ID 5042002)

---

## Try the live demo

| URL | Mode |
|---|---|
| **https://uvf411agm1at.space.minimax.io** | Frontend (talks to live backend) |
| **https://label-musicians-addition-armed.trycloudflare.com** | Live Node.js backend (mock mode by default, real Arc testnet in `PAYMENTS_MODE=live`) |

> ⚠️ The backend URL uses a Cloudflare tunnel that
> requires the local server to be running.
> To run your own backend, follow the Quickstart below.
> The frontend demo works in mock mode without a backend.

### Demo accounts
- **Listener:** `demo-listener@perstream.fm`
- **Creator:** `demo-creator@perstream.fm`

Any email works — the system creates an embedded Arc wallet on the fly.

### 60-second walkthrough
1. Open the URL → click **"Sign in with email"** (mobile-friendly modal)
2. Use any email → a Circle Arc wallet is created in milliseconds
3. Tap **+ Add 5 USDC** → balance updates (in live mode: real on-chain tx)
4. Tap any track → click **▶ Start Streaming** → audio plays + balance ticks down
5. Click the wallet address (top right) → opens your Arcscan page

For creator flow: open `/creator.html` → upload an MP3 → see analytics update → withdraw USDC.

---

## Run it locally

### Prerequisites
- **Node.js ≥ 18** (tested on 20, 22, 24)
- **npm** (comes with Node)
- **git**
- No Python, no native compilers, no Docker. Pure JS stack.

### Quickstart (under 2 minutes)

**Verified working on Termux/Android — copy/paste the block below:**

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

You should see:
```
[smoke] running 16 tests against http://localhost:3099
...
[test] 16 passed, 0 failed
```

Then start the backend:

```bash
node backend/src/server.js
```

Open in any browser:
- `http://localhost:3000` → landing page
- `http://localhost:3000/listen.html` → listener experience
- `http://localhost:3000/creator.html` → creator dashboard

> 💡 **The `rm -rf backend/data` step is critical.** It wipes the prior state so the smoke test always shows 16/16. Without it, leftover `perstream.db` from a previous run can suppress some assertions.

> 💡 **Why `rm -rf node_modules package-lock.json`?** If you've installed PerStream before, this ensures you get fresh deps matching the current repo (sql.js, viem, express versions).

### Live mode (real Arc testnet)

For real Circle Nanopayments on Arc:

1. **Get testnet USDC:** Visit [faucet.circle.com](https://faucet.circle.com), connect a wallet, send 20 USDC to **Arc Testnet**.
2. **Configure seller wallet:** Edit `backend/.env`:
   ```env
   PAYMENTS_MODE=live
   ARBITRUM_PRIVATE_KEY=0x<your_seller_wallet_private_key>
   ```
3. **Fund listener wallets:** The seller wallet auto-funds new users $5 testnet USDC on first login.
4. **Restart:** `node backend/src/server.js`

Full live-mode setup: [`docs/LIVE_DEPLOY.md`](docs/LIVE_DEPLOY.md)

---

## Architecture

```
listener (browser)  ── x402 / HTTP ──▶  PerStream backend  ── Circle Gateway ──▶  Arc testnet
        │                                       │
        │                                       │
        └── embedded wallet (Agent Stack) ◀─────┴── creator's Arc wallet
```

### Repository structure

```
PerStream/
├── backend/                  Node.js + Express + sql.js
│   ├── src/
│   │   ├── server.js         All 34 API endpoints
│   │   ├── db.js             sql.js schema + migrations + helpers
│   │   ├── arc.js            Circle Gateway / live mode
│   │   ├── meter.js          Per-second settlement engine
│   │   ├── tick-ledger.js    Append-only audit log (JSONL)
│   │   ├── wallet.js         Three-mode wallet provisioner
│   │   ├── agent-listener.js AI Listener Agent
│   │   └── ...
│   ├── data/                 SQLite file + uploaded audio
│   ├── .env.example          Mock + Live env vars
│   └── package.json          8 deps, zero native compilation
├── frontend/                 Vanilla HTML/JS, no build step
│   ├── index.html            Landing page (story-driven)
│   ├── listen.html           Listener experience
│   ├── creator.html          Full Creator Dashboard
│   ├── LIVE_SETUP.html       Live-mode setup guide
│   └── assets/               CSS, JS, MP3s, SVG
├── contracts/                Solidity smart contract
│   └── PerStreamPaymaster.sol  On-chain settlement
├── scripts/                  CLI tools
│   ├── seed.js               Demo data
│   ├── smoke-test.js         16-test suite
│   ├── bundle.sh             Release tarball
│   ├── push-to-github.sh     Auto-commit + push
│   └── ...
├── docs/                     Full documentation
│   ├── SPEC.md
│   ├── API.md                All 34 endpoints
│   ├── INSTALLATION.md
│   ├── LIVE_DEPLOY.md
│   ├── CONTRACT_DEPLOY.md
│   ├── HOW_PAYMENTS_WORK.md
│   ├── VERIFY_ON_ARCSCAN.md
│   ├── AGENT_STORY.md
│   ├── PITCH.md, DEMO.md, SUBMISSION.md
│   └── AUDIT_REPORT.md       Consistency audit (this audit)
└── README.md                 ← you are here
```

---

## Features (verified working)

### Listener experience
- ✅ Email login with embedded Arc wallet (no MetaMask)
- ✅ Deposit USDC (testnet or live)
- ✅ Browse 4+ audio tracks
- ✅ Real-time per-second USDC ticking
- ✅ Audio gates behind paywall (native controls disabled)
- ✅ Pause = stop paying
- ✅ View wallet on Arcscan (clickable)
- ✅ Recent activity log (audit trail)
- ✅ Mobile-friendly responsive design

### Creator experience
- ✅ Sign in as creator
- ✅ Full Creator Dashboard at `/creator.html`
- ✅ Upload audio (MP3, WAV, M4A) with optional cover image
- ✅ Upload progress bar (XHR progress events)
- ✅ Edit track (title, description, price, category)
- ✅ Publish/unpublish tracks (draft/published/unlisted)
- ✅ Delete tracks (with confirmation)
- ✅ Search, filter, sort tracks
- ✅ Real-time analytics (streams, listeners, earnings)
- ✅ Earnings wallet (available, pending, lifetime)
- ✅ Withdraw USDC on-chain (real Arcscan link)
- ✅ Notifications (payments, withdrawals, uploads)
- ✅ Profile editor (display name, bio, avatar, social links)

### AI features
- ✅ AI Listener Agent (`/api/agent/listen`, `/api/agent/auto`)
- ✅ Autonomous multi-track discovery
- ✅ Agent provisions its own wallet (viem deterministic key, no MetaMask)

### On-chain
- ✅ Every per-second tick recorded in audit ledger
- ✅ Batched on-chain settlement every 30 ticks (real `gatewayMint` calls)
- ✅ Verified on [Arc testnet scan](https://testnet.arcscan.app)
- ✅ 3 canonical addresses: seller wallet, GatewayMinter, creator earnings

---

## API overview

**34 endpoints across 7 categories.** Full reference: [`docs/API.md`](docs/API.md).

```http
POST   /api/auth/login                  → Sign in with email
GET    /api/tracks                      → Public track catalog
GET    /api/tracks/:id/stream           → x402-gated audio URL
POST   /api/listen/start                → Begin listening session
GET    /api/listen/poll                 → Per-second tick (every 1s)
POST   /api/listen/stop                 → End session + on-chain settle
POST   /api/listen/deposit              → Add USDC to balance

GET    /api/creator/dashboard           → Full creator analytics
POST   /api/creator/tracks              → Upload track (multipart)
PUT    /api/creator/tracks/:id          → Update track
DELETE /api/creator/tracks/:id          → Delete track
POST   /api/creator/tracks/:id/status   → Publish/unpublish
GET    /api/creator/profile             → Creator profile
PUT    /api/creator/profile             → Update profile
GET    /api/creator/notifications       → List notifications
GET    /api/creator/withdrawals         → List withdrawals
POST   /api/creator/withdraw            → Withdraw USDC (on-chain)

POST   /api/agent/listen                → AI agent listens to one track
POST   /api/agent/auto                  → AI agent multi-track discovery
GET    /api/agent/info                  → Agent capabilities

GET    /api/audit/stats                 → Aggregate stats
GET    /api/audit/ticks                 → Recent ticks
GET    /api/audit/export                → Download JSONL ledger

GET    /api/health                      → Service status
```

---

## Circle technologies used

| Circle primitive | Where | Why |
|---|---|---|
| **Nanopayments** | `backend/src/arc.js`, `backend/src/meter.js` | Sub-cent USDC transfers with batching |
| **x402** | `/api/tracks/:id/stream`, `/api/agent/listen` | HTTP 402 paywall pattern |
| **Embedded wallets** | `backend/src/wallet.js` | viem deterministic per-user wallets; Circle Agent Stack path available when API keys are provided |
| **Arc testnet** | All settlement txs | Stablecoin-native L1, sub-second finality |

---

## On-chain verification

Three canonical Arc testnet addresses:

| Role | Address | View |
|---|---|---|
| Seller wallet | `0xEb375940Cd0D85f06239d68C6e719c71907771f9` | [Arcscan](https://testnet.arcscan.app/address/0xEb375940Cd0D85f06239d68C6e719c71907771f9) |
| Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | [Arcscan](https://testnet.arcscan.app/address/0x0077777d7EBA4688BDeF3E311b846F25870A19B9) |
| Creator earnings | `0x9b198314420Ffc0f7a5e4895a2CFCc12D0b53493` | [Arcscan](https://testnet.arcscan.app/address/0x9b198314420Ffc0f7a5e4895a2CFCc12D0b53493) |

---

## Creator workflow (verified end-to-end)

1. **Sign in** with any email → Circle Arc wallet auto-created
2. **Open `/creator.html`** → full dashboard
3. **Upload a track** → MP3/WAV/M4A + optional cover image → real-time progress
4. **Track appears** in public catalog at `/listen.html`
5. **Listener signs in + streams** → per-second USDC ticks on Arc testnet
6. **Creator's earnings update** in dashboard (real-time)
7. **Withdraw** → real on-chain USDC transfer to creator's wallet
8. **Arcscan link** in withdrawal history verifies the tx

---

## Listener workflow (verified end-to-end)

1. **Open `/listen.html`** → sign in with any email
2. **Auto-funded** with $5 testnet USDC (live mode)
3. **Tap any track** → click **▶ Start Streaming**
4. **Audio plays** + balance ticks down + meter ticks up
5. **Pause** → payment stream stops
6. **Click wallet address** (top right) → opens your Arcscan page
7. **View recent ticks** in audit section at bottom

---

## Security considerations

- **Ownership checks** on all track edit/delete operations (creator_id must match)
- **Auth middleware** required for creator endpoints (X-User-Id header)
- **No secrets in repo** — `.env` is gitignored, `.env.example` has only safe defaults
- **CORS configured** — Express CORS middleware
- **Rate limiting** — `express-rate-limit` on auth endpoints
- **Wallet derivation** — uses viem from email hash (deterministic, no private key storage)
- **Live mode private keys** — only the seller key in `.env`, never exposed in code

---

## Hackathon deliverables

- 📄 [`docs/SPEC.md`](docs/SPEC.md) — full specification
- 🎤 [`docs/PITCH.md`](docs/PITCH.md) — sponsor pitch script
- 🎬 [`docs/DEMO.md`](docs/DEMO.md) — 2-minute demo script
- 📝 [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — submission form prefill
- 🔍 [`docs/VERIFY_ON_ARCSCAN.md`](docs/VERIFY_ON_ARCSCAN.md) — verify the on-chain integration
- 🤖 [`docs/AGENT_STORY.md`](docs/AGENT_STORY.md) — AI Listener Agent deep-dive
- 📚 [`docs/API.md`](docs/API.md) — complete API reference
- 🔨 [`docs/CONTRACT_DEPLOY.md`](docs/CONTRACT_DEPLOY.md) — deploy PerStreamPaymaster to Arc
- ✅ [`audit/AUDIT_REPORT.md`](audit/AUDIT_REPORT.md) — repo vs. demo consistency audit

---

## Environment variables

All in `backend/.env` (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Express server port |
| `NODE_ENV` | `development` | Node environment |
| `PUBLIC_BASE_URL` | _empty_ | Auto-detect from Host header (recommended) |
| `PAYMENTS_MODE` | `mock` | `mock` (in-memory) or `live` (real Arc) |
| `ARBITRUM_PRIVATE_KEY` | _empty_ | Seller wallet private key (live mode only) |
| `DB_PATH` | `./data/perstream.db` | SQLite database file |
| `AUDIO_DIR` | `./data/audio` | Uploaded audio directory |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Smart contract | Solidity 0.8.x | Standard on Arc, deployable in 5 min |
| Backend | Node.js + Express | Termux-friendly, fastest to ship |
| Database | sql.js (pure JS SQLite) | No native compile, runs on Termux |
| Frontend | Vanilla HTML/JS/CSS | No build step, deploys anywhere |
| Wallet | viem (deterministic per-user) | Embedded, no MetaMask popup; Circle Agent Stack path available with API keys |
| Payments | Circle Nanopayments | Gasless USDC, $0.000001 minimum |
| Paywall | x402 (HTTP 402) | Standard, sponsor-aligned |
| Chain | Arc testnet | Stablecoin-native, Circle's own L1 |
| Audio upload | multer | Battle-tested multipart parser |
| Auth | X-User-Id header | Lightweight, no JWT needed for demo |

---

## Project status

- [x] Architecture designed and shipped
- [x] Backend skeleton (Node + Express)
- [x] Smart contract (PerStreamPaymaster.sol)
- [x] Frontend (landing, listen, creator) — 4 pages
- [x] x402 + Nanopayments flow
- [x] AI Listener Agent (autonomous)
- [x] Creator Dashboard (full CRUD + analytics + withdrawals)
- [x] Demo seeded with 4 tracks
- [x] Live demo deployed (Arc testnet verified)
- [x] Documentation (8 docs + audit report)
- [x] 16/16 smoke tests pass
- [x] Real on-chain settlements verified

---

## Credits

Built by **Oluyemi (donyemiight)** ([@DonYemiight](https://x.com/DonYemiight)) for the Lepton Agents Hackathon 2026.

Solo build, Termux (Android), 14 days.

Returning Canteen builder — previously shipped TradeMouth on the prior Canteen event.

---

## License

MIT — see [`LICENSE`](LICENSE).
