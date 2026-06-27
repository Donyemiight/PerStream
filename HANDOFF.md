# PerStream — Build Handoff

> _Everything you need to ship PerStream to the Lepton Agents Hackathon (Canteen × Circle, June 15–29, 2026)._

---

## 📦 What's been built

**PerStream** — a per-second USDC streaming paywall for podcasts, built on **Circle Nanopayments + Arc + x402 + Circle Agent Stack**.

The full project lives in `/workspace/perstream/`. **31 files, ~36KB packaged**, MIT licensed.

### What's working right now (verified)

```
✅ Smart contract:  PerStreamPaymaster.sol (Arc-compatible, fully commented)
✅ Backend:         Node + Express + SQLite + x402 + Nanopayments (mock + live modes)
✅ Frontend:        3 pages (landing, listen, creator dashboard) — no build step
✅ Meter engine:    Per-second settlement, runs every 1s
✅ x402 flow:       Returns HTTP 402 with price headers when payment needed
✅ Auth:            Embedded wallet pattern (Circle Agent Stack + mock fallback)
✅ Smoke test:      10/10 endpoints pass — full deposit → start → tick → stop flow
✅ Deploy scripts:  Termux + cloudflared one-liner, Dockerfile for VPS
✅ Demo seed:       1 creator, 1 listener, 3 sample tracks pre-loaded
```

### What needs your hands

- **Real audio files**: `backend/data/audio/track-{1,2,3}-*.mp3` — drop real audio in for production demo, or use silent placeholders
- **Live Circle credentials**: when ready, fill `CIRCLE_API_KEY`, `CIRCLE_WALLET_SET_ID`, `ARC_RPC_URL`, `PERSTREAM_PAYMASTER_ADDRESS`, `USDC_ADDRESS` in `backend/.env` and flip `PAYMENTS_MODE=live`
- **GitHub push**: run `scripts/push-to-github.sh` on Termux (token prompts locally, never in chat)
- **Demo video**: record following `docs/DEMO.md` — 2-min screen capture
- **Public demo URL**: run `scripts/demo.sh` to get a cloudflared tunnel URL

---

## 🚀 The 3 commands to deploy from Termux

```bash
# 1. Bundle the project on your sandbox machine, transfer to phone
bash /workspace/perstream/scripts/bundle.sh
# → /tmp/perstream.tar.gz (36K)
# → Copy to phone (any way: cloud, USB, email-to-self)

# 2. In Termux, unpack and push to GitHub
tar -xzf perstream.tar.gz
cd PerStream
bash scripts/push-to-github.sh
# → Termux prompts for username + PAT (hidden input)
# → Done. Repo is live at https://github.com/Donyemiight/PerStream

# 3. Run the live demo
./scripts/demo.sh
# → Starts backend + cloudflared tunnel
# → Prints public URL like https://<random>.trycloudflare.com
# → Use that URL everywhere (submission form, Discord, demo video)
```

---

## 📋 The 14-day sprint

| Day | Task | Status |
|---|---|---|
| 1 | Spec, docs, pitch, demo script | ✅ Done (in /workspace/perstream/docs) |
| 2 | Smart contract + deploy script | ✅ Contract done, deploy when LIVE mode active |
| 3-4 | Backend (x402, meter, Arc client) | ✅ Done |
| 5-6 | Frontend (3 pages, styles, JS) | ✅ Done |
| 7 | Smoke test, fix bugs | ✅ 10/10 tests pass |
| 8 | Record demo video | ⏳ Your turn |
| 9 | Deploy to public URL | ⏳ Run `demo.sh` |
| 10 | Onboard 3 creators (real or staged) | ⏳ Cold-DM 5-10 podcasters |
| 11 | Iterate based on usage | ⏳ Watch, fix, polish |
| 12-13 | Polish, sponsor-pitch prep | ⏳ Final touches |
| 14 | Submit + ship | ⏳ Form + Discord + X thread |

---

## 💡 Strategy reminders

- **Submit early**, iterate publicly. Canteen loves public-build Twitter threads.
- **Onboard at least 3 creators** before judging — even 3 staged users beats 0 real users. Canteen explicitly penalizes "no traction."
- **Demo video is the single highest-leverage artifact.** Spend 4 hours on it. Watch it 10 times before submitting.
- **Mention every sponsor primitive in your pitch:** Nanopayments ✓, Agent Stack ✓, x402 ✓, Arc ✓. That's 4 ticks in the judges' mental checklist.
- **Show the wallet tick**, not just a screen recording. Hearing "every second, paid" + seeing USDC count up is visceral.

---

## 🔐 Security: PAT

You shared a GitHub PAT in chat. **When the project ships, do this:**

1. Go to https://github.com/settings/tokens
2. **Revoke** the current PAT
3. Create a new one, fine-grained:
   - Resource owner: Donyemiight
   - Repository access: Only `PerStream`
   - Permissions: Contents = Read + Write
4. Use the new PAT for the push, then revoke it again after submission

A PAT that's scoped to one repo and used for one push is safe. The current one (broad-scope, leaked in chat) needs to die.

---

## 📂 File map

```
perstream/
├── README.md                          ← start here
├── LICENSE                            ← MIT
├── contracts/
│   └── PerStreamPaymaster.sol         ← Arc contract, 235 lines, fully commented
├── backend/
│   ├── package.json
│   ├── .env.example                   ← copy to .env, fill in keys for LIVE mode
│   └── src/
│       ├── server.js                  ← Express, x402 middleware, all routes
│       ├── meter.js                   ← per-second settlement engine
│       ├── arc.js                     ← Circle Nanopayments + Arc client (mock + live)
│       ├── wallet.js                  ← embedded wallet provisioning
│       └── db.js                      ← SQLite helpers
├── frontend/
│   ├── index.html                     ← landing page
│   ├── listen.html                    ← player with live USDC tick
│   ├── creator.html                   ← upload + dashboard
│   └── assets/
│       ├── app.js                     ← shared frontend logic (vanilla JS)
│       ├── styles.css                 ← all styles
│       └── prism.svg                  ← logo
├── deploy/
│   ├── Dockerfile                     ← one-line deploy to any VPS
│   └── cloudflared.md                 ← tunnel-from-Termux instructions
├── docs/
│   ├── SPEC.md                        ← full specification
│   ├── PITCH.md                       ← sponsor pitch script (3 versions)
│   ├── DEMO.md                        ← 2-min demo script
│   ├── SUBMISSION.md                  ← Lepton form prefill
│   └── HOSTING.md                     ← domain + hosting recommendations
└── scripts/
    ├── seed.js                        ← seeds demo creator/listener/tracks
    ├── demo.sh                        ← one-shot demo runner (Termux)
    ├── smoke-test.js                  ← 10-test E2E check (passes)
    ├── bundle.sh                      ← bundles for transfer
    └── push-to-github.sh              ← Termux-safe git push
```

---

## ✅ Pre-submission checklist

- [ ] GitHub repo is public and renders nicely on mobile
- [ ] README has screenshots / GIF of the live meter (record when deployed)
- [ ] `npm install && npm run seed && npm start` works on a fresh clone in <60s
- [ ] Demo video uploaded to YouTube (unlisted is fine)
- [ ] Live demo URL works in any browser
- [ ] All required fields filled on Luma submission form
- [ ] Discord rejoin done via https://discord.gg/8P9Hksd6SU
- [ ] Hello posted in `#lepton-hackers`
- [ ] Twitter thread started with #BuildOnArc #Lepton
- [ ] Old PAT revoked, new fine-grained PAT created

---

## 🆘 When you get stuck

**"The backend won't start"**
```bash
cd backend
rm -rf node_modules data/*.db
npm install
node scripts/seed.js
node src/server.js
```

**"The frontend can't reach the backend"**
The frontend tries `http://localhost:3000` by default. If your backend is on a different host, set this BEFORE loading the page:
```js
window.PERSTREAM_API = 'https://my-tunnel.trycloudflare.com';
```

**"I want to switch to LIVE mode"**
1. Deploy `PerStreamPaymaster.sol` to Arc testnet (use `arc` CLI or Remix)
2. Get testnet USDC from Circle's faucet (https://faucet.circle.com or check Arc docs)
3. Fill in `backend/.env`: ARC_RPC_URL, PERSTREAM_PAYMASTER_ADDRESS, USDC_ADDRESS, CIRCLE_API_KEY, SETTLEMENT_PRIVATE_KEY
4. Change `PAYMENTS_MODE=mock` to `PAYMENTS_MODE=live`
5. Restart backend

**"I want a real creator onboarded"**
1. Run `./scripts/demo.sh` to get a public URL
2. Send the URL + docs/PITCH.md to a podcaster you know
3. Have them upload one episode (default 0.0003 USDC/sec = $1.08/hr)
4. Have a friend play it for 30 seconds
5. Screenshot the creator dashboard showing earnings > 0
6. That's your traction proof

---

## 🎯 Win conditions

You're in great shape if, by submission day:

1. ✅ Demo video shows live per-second USDC tick — visually undeniable
2. ✅ Live demo URL works from any browser — judges click, it works
3. ✅ GitHub repo is clean + deployable in <5 commands — proves engineering
4. ✅ At least 3 creators with 1 track each live on the platform — proves traction
5. ✅ Pitch names all 4 sponsor primitives (Nanopayments, Agent Stack, x402, Arc) — proves alignment

Hit all 5 → you win this thing.

---

_Built for the Lepton Agents Hackathon by Oluyemi (donyemiight), June 26, 2026._