# PerStream

> **Per-second USDC streaming paywall for podcasts and long-form audio, built on Circle Nanopayments + Arc.**
>
> _Lepton Agents Hackathon · Canteen × Circle · June 15–29, 2026_

**Tagline:** _Every second, paid._

---

## What is this?

PerStream lets creators monetize audio from listener #1 by charging USDC for every second of audio actually played.

No subscriptions. No ads. No audience minimum. Press play, USDC ticks every second, creator earns.

It uses **Circle Nanopayments** (gasless USDC as small as $0.000001) + **x402** (HTTP 402 paywall pattern) + **Circle Agent Stack** (embedded wallets) + **Arc** (stablecoin-native L1).

---

## Try the demo

```
https://perstream-demo.live
```

(or the latest deployed URL — see [Releases](https://github.com/Donyemiight/PerStream/releases))

1. Open the URL → sign in with email (one click, no MetaMask)
2. Press play on any track
3. Watch the USDC counter tick every second
4. Switch to the creator tab to see earnings update live

---

## Run it yourself

You need Node.js ≥ 18 and (optionally) a Circle developer account for live settlement. The mock mode runs without any API keys.

```bash
# Clone
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream

# Backend
cd backend
npm install
cp .env.example .env
npm run seed     # adds 3 sample tracks
npm run dev      # starts on http://localhost:3000

# Frontend
cd ../frontend
# open index.html in any browser, or:
python3 -m http.server 8000
```

Then visit `http://localhost:8000` for the player and `http://localhost:8000/creator.html` for the dashboard.

---

## Architecture

```
listener (browser)  ── x402 / HTTP ──▶  PerStream backend  ── Nanopayments ──▶  Arc + PerStreamPaymaster.sol
        │                                       │
        │                                       │
        └── embedded wallet (Agent Stack) ◀─────┴── creator's session key
```

- **`/contracts/PerStreamPaymaster.sol`** — on-chain settlement, creator withdrawals
- **`/backend/src/`** — Express, SQLite, x402 middleware, Arc client, meter
- **`/frontend/`** — vanilla HTML/JS, no build step, works on any browser
- **`/deploy/`** — Dockerfile + cloudflared instructions
- **`/docs/`** — SPEC, pitch script, demo script, submission form

See [`docs/SPEC.md`](docs/SPEC.md) for the full specification.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Smart contract | Solidity 0.8.x | Standard on Arc, deployable in 5 min |
| Backend | Node.js + Express | Termux-friendly, fastest to ship |
| Database | SQLite | Zero-config, file-based, perfect for hackathon |
| Frontend | Vanilla HTML/JS/CSS | No build step, deploys anywhere, loads fast |
| Wallet | Circle Agent Stack | Embedded, no MetaMask popup |
| Payments | Circle Nanopayments | Gasless USDC, $0.000001 minimum |
| Paywall | x402 (HTTP 402) | Standard, sponsor-aligned |
| Chain | Arc testnet | Stablecoin-native, Circle's own L1 |

---

## Project status

- [x] Architecture designed
- [x] Backend skeleton
- [x] On-chain contract
- [x] Frontend (landing, listen, creator)
- [x] x402 + Nanopayments flow
- [x] Demo seeded with sample tracks
- [ ] Live demo deployed (in progress)
- [ ] 3 real podcasters onboarded (in progress)

---

## Hackathon deliverables

- 📄 [`docs/SPEC.md`](docs/SPEC.md) — full specification
- 🎤 [`docs/PITCH.md`](docs/PITCH.md) — sponsor pitch script
- 🎬 [`docs/DEMO.md`](docs/DEMO.md) — 2-minute demo script
- 📝 [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — submission form prefill

---

## About

Built by **Oluyemi (donyemiight)** ([@donYemiight](https://x.com/donYemiight)) for the Lepton Agents Hackathon 2026.

Solo build, Termux (Android), 14 days. Returning Canteen builder (previously shipped TradeMouth on the prior event).

MIT licensed.

---

## License

MIT — see [`LICENSE`](LICENSE).