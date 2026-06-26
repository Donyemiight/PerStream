# PerStream — Lepton Submission Form (prefilled)

> Submission form URL: `https://forms.gle/SMqLaw2pMGDe58LFA`
> Copy-paste each block into the matching field.

---

## Project name
**PerStream**

## One-line tagline
Per-second USDC streaming paywall for podcasts, built on Circle Nanopayments + Arc.

## Description (long form)
PerStream is a paid-audio streaming layer where creators monetize from listener #1 by charging USDC for every second of audio actually played.

A creator uploads an audio file, sets a per-second price (default 0.0003 USDC/sec ≈ $1.08/hr), and gets a public URL. A listener opens the URL, signs in with one click via Circle Agent Stack embedded wallet (no MetaMask popup, no seed phrase), and presses play. Each second of playback triggers an HTTP 402 (x402) challenge that resolves with a gasless USDC micro-payment on Arc via Circle Nanopayments. Pause stops the meter instantly. Resume restarts it.

It solves the cold-start cliff named in Canteen's distribution analysis: creators can't monetize from listener #1 today because subscriptions need ~1k subs and ads need ~5k downloads. Per-second pricing means even a single loyal fan produces real revenue.

PerStream showcases all four sponsor primitives end-to-end:
- **Circle Nanopayments** — gasless USDC as small as $0.000001
- **Circle Agent Stack** — embedded listener wallets
- **x402 protocol** — HTTP 402 paywall pattern
- **Arc** — stablecoin-native Layer 1 settlement

Adoption path: white-label the listen page for embed in canteen.fm, open API for any podcast host, AI-agent listeners with daily USDC budgets streaming autonomously on the same rail.

## Tech stack
- **Smart contract**: Solidity 0.8.x (PerStreamPaymaster.sol) on Arc testnet
- **Backend**: Node.js + Express (Termux-friendly, zero-config)
- **Frontend**: Vanilla HTML/JS/CSS — no build step, runs anywhere
- **Database**: SQLite (zero-config)
- **Wallet**: Circle Agent Stack embedded wallets
- **Payments**: Circle Nanopayments + x402 (HTTP 402)
- **Chain**: Arc testnet
- **Deployment**: cloudflared tunnel from Termux, or Docker on any $5 VPS

## Sponsor primitives used
- [x] Circle Nanopayments
- [x] Circle Agent Stack
- [x] x402 protocol
- [x] Arc L1
- [x] USDC
- [ ] CPN (Circle Payments Network)
- [ ] CCTP (Cross-Chain Transfer Protocol)

## GitHub
https://github.com/Donyemiight/PerStream

## Demo video
[YouTube link — replace after recording]

## Live demo
[Public cloudflared URL — replace after deploying]

## Track / category
Creator economy + AI agents (primary)
Nanomoney / micropayments (secondary)

## Team
Solo — Ademidun (donYemiight on X, yemiiight on Discord). Returning Lepton builder; previously shipped TradeMouth on Canteen.

## Anything else judges should know
- Built entirely on Termux (Android) — proof of zero-infra shipping
- MIT licensed, repo is deployable in 5 commands
- 3 sample tracks seeded for instant demo
- Public Twitter build thread + Discord activity throughout the 14 days
- Plan to keep building post-hackathon: RSS import, AI-agent listeners, white-label API

---

## Pre-submit checklist

- [ ] GitHub repo is public
- [ ] README is clean (renders nicely on mobile)
- [ ] Demo video uploaded to YouTube (unlisted is fine)
- [ ] Live demo URL works in any browser
- [ ] All required fields filled on Luma form
- [ ] Discord rejoin done via https://discord.gg/8P9Hksd6SU
- [ ] Hello posted in #lepton-hackers
- [ ] Twitter thread started with #BuildOnArc #Lepton