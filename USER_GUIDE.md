# PerStream — How to Use It (Step by Step)

> _Complete walkthrough. Read this once, you'll know everything._

---

## 🌐 Where to start

| What you want to do | Where to go |
|---|---|
| Try the demo in your browser (no setup) | **https://ffi8utziybe6.space.minimax.io** |
| Run it locally on your computer | Clone the repo + follow `INSTALLATION.md` |
| Use the real backend with USDC | Set up live mode (see end of doc) |

This guide uses the **live demo URL** since it works for everyone in 30 seconds.

---

## 👂 PART 1 — How to USE PerStream as a Listener

This is what a regular user does. Takes 60 seconds.

### Step 1 — Open the demo

In your browser, go to: **https://ffi8utziybe6.space.minimax.io**

You'll see the PerStream landing page with a prism logo and "Every second, paid."

### Step 2 — Click "Try the demo"

Big purple button at the top.

### Step 3 — Sign in

You'll see **"Sign in with email"**. The browser pops up a prompt asking for your email.

**Any email works.** Type anything like:
- `you@example.com`
- `demo-listener@perstream.fm` (pre-seeded)

Click OK. **No password needed.** PerStream creates a USDC wallet for you automatically.

**What happens behind the scenes:**
- Your email becomes your account ID
- A USDC wallet address is generated for you (looks like `0xabc...`)
- The address is stored in your browser's localStorage so you stay signed in

### Step 4 — Browse tracks

You'll see 3 tracks in the demo:
1. **PerStream Theme — Welcome to paid seconds** (30s, 0.0003 USDC/sec)
2. **The Cold-Start Cliff — PerStream pitch audio** (60s, 0.0005 USDC/sec)
3. **Demo Loop — looping tone for testing** (15s, 0.0001 USDC/sec)

Each shows:
- Title
- Duration
- Plays count
- Price per second

### Step 5 — Click a track

Click any track to open the player.

**First time you'll see this:**

```
⚠️ HTTP 402 Payment Required

X-PerStream-Price: 300 (micro-USDC per second)
X-PerStream-Price-Usd: 0.0003
X-PerStream-Creator: 0x...
X-PerStream-Track-Id: trk_...
```

This is the **x402 paywall in action**. The server is saying: "Hey, this content costs money. Deposit USDC first."

### Step 6 — Add USDC to your wallet

Click **"+ Add 1 USDC"** (or + Add 5 USDC for more listening time).

This simulates a USDC deposit. In production, this would be a real Circle Nanopayment to your wallet.

### Step 7 — Press Play

Click the **▶ Play** button on the audio player.

**Watch what happens in real time:**
- The audio starts playing
- The USDC counter starts ticking up (every second)
- The "Seconds played" counter increases
- The "Balance" counter decreases

**Example after 10 seconds:**
- USDC this session: 0.003000 (3 thousandths of a dollar)
- Seconds played: 10
- Balance: 0.997000

### Step 8 — Pause or stop

- **Pause**: USDC counter freezes. You're not charged while paused.
- **Stop**: Session ends, creator gets paid.

### Step 9 — Rate the experience (NEW!)

Scroll to the bottom of the page. You'll see a feedback widget:

1. **Click 1-5 stars** to rate
2. **Type an optional comment** ("Love it!", "Audio didn't load", etc.)
3. **Enter email if you want a follow-up** (optional)
4. **Click "Submit feedback"**

You'll see "✓ Thanks!" when it goes through. Your rating is saved and shown to the creator.

### Step 10 — (Optional) Request early access for your podcast

If you have a podcast or content, scroll a bit further. There's an **early access** form:

1. Enter your email
2. Select what you are (podcaster/creator/developer/agent/other)
3. Click **"Get early access"**

You'll see "✓ You're on the list."

---

## 🎤 PART 2 — How to USE PerStream as a Creator

Want to monetize your podcast? Takes 2 minutes.

### Step 1 — Go to the Creator dashboard

From the landing page, click **"Become a creator"** (button next to "Try the demo").

URL: **https://ffi8utziybe6.space.minimax.io/creator.html**

### Step 2 — Sign in

Same as listener — any email. Use a different email from your listener account to see both perspectives.

### Step 3 — See your dashboard

After signing in, you'll see:
- **Live earnings** card (starts at $0.000000)
- **Upload form**
- **Your tracks** section (empty initially)
- **User feedback & signups** card (NEW — shows ratings + leads)

### Step 4 — Upload a track

In the upload form:

| Field | What to enter |
|---|---|
| **Title** | Your episode title, e.g. "Episode 1 — How I built this" |
| **Description** | One-line description (optional) |
| **Price per second (USDC)** | Suggested: 0.0003 (= $1.08/hr). Range: 0.000001 to 0.01 |
| **Duration (sec)** | Length in seconds (0 = unknown) |
| **Audio file** | MP3, M4A, or WAV — up to 50MB |

Click **"Upload track"**.

**Behind the scenes:**
- Audio file saved to the server
- Track metadata stored in database with your creator ID
- Public URL generated: `https://perstream.fm/track/<id>`
- Your earnings dashboard updates

### Step 5 — Share your track

Your track now appears in the public list. Anyone can find it and pay per second to listen.

In production, you'd share the URL on social media, in your podcast feed, etc.

### Step 6 — Track earnings

Every time a listener plays your track, USDC flows to your wallet. The dashboard shows:
- **Live earnings**: USDC accumulated (withdrawable)
- **Per-track earnings**: how much each episode made
- **Active sessions**: how many listeners are currently playing
- **Feedback**: user ratings + comments on your tracks
- **Signups**: how many creators/listeners joined via your early-access form

### Step 7 — Withdraw

Click **"Withdraw all"** in the earnings card. USDC moves from PerStream to your external wallet.

In production, this triggers a Circle Gateway cross-chain transfer.

---

## 🤖 PART 3 — How to USE PerStream as an AI Agent

PerStream has built-in AI listener agents. Here's how to trigger one.

### Option A — Single track with a budget

```bash
curl -X POST https://ffi8utziybe6.space.minimax.io/api/agent/listen \
  -H "Content-Type: application/json" \
  -d '{
    "trackId": "trk-loop",
    "budgetUsd": 0.01,
    "maxSeconds": 30
  }'
```

What happens:
1. An AI agent is provisioned (gets its own USDC wallet)
2. It's funded with $0.01 USDC
3. It opens a session on `trk-loop`
4. It pays 0.0001 USDC per second (up to 30 seconds)
5. When budget runs out, it stops
6. Returns a consumption log

Response:
```json
{
  "ok": true,
  "agent": { "wallet": "0x..." },
  "trackId": "trk-loop",
  "secondsPlayed": 30,
  "totalPaidUsd": "0.003000",
  "remainingBalanceUsd": "0.007000",
  "log": [
    "[2026-...] Created agent wallet: 0x...",
    "[2026-...] Deposited budget: $0.01 USDC",
    "[2026-...] 🎧 Started listening...",
    "[2026-...]    Price: 0.0001 USDC/sec",
    "[2026-...] ✅ Session complete: 30s, $0.003 paid, $0.007 remaining"
  ]
}
```

### Option B — Autonomous multi-track discovery

```bash
curl -X POST https://ffi8utziybe6.space.minimax.io/api/agent/auto \
  -H "Content-Type: application/json" \
  -d '{
    "budgetUsd": 5,
    "maxTracks": 3
  }'
```

What happens:
1. Agent provisioned with $5 budget
2. Discovers all tracks on PerStream
3. Picks the cheapest one (smart strategy)
4. Listens for 5 seconds (default), then moves on
5. Picks next, listens, etc.
6. Stops when budget runs out or 3 tracks consumed

### Option C — Use the regular listener API (you're coding an agent)

```bash
# 1. Login (creates wallet)
curl -X POST https://ffi8utziybe6.space.minimax.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"my-bot@company.com"}'

# 2. Deposit USDC (in mock mode this just credits your account)
curl -X POST https://ffi8utziybe6.space.minimax.io/api/listen/deposit \
  -H "Content-Type: application/json" \
  -H "X-User-Id: usr_xxx" \
  -d '{"amountUsd": 100}'

# 3. Discover tracks
curl https://ffi8utziybe6.space.minimax.io/api/tracks

# 4. Start session
curl -X POST https://ffi8utziybe6.space.minimax.io/api/listen/start \
  -H "Content-Type: application/json" \
  -H "X-User-Id: usr_xxx" \
  -d '{"trackId": "trk_xxx"}'

# 5. Poll for state
curl "https://ffi8utziybe6.space.minimax.io/api/listen/poll?sessionId=ses_xxx"

# 6. Stop
curl -X POST https://ffi8utziybe6.space.minimax.io/api/listen/stop \
  -H "Content-Type: application/json" \
  -H "X-User-Id: usr_xxx" \
  -d '{"sessionId": "ses_xxx"}'
```

### Agent capabilities manifest

```bash
curl https://ffi8utziybe6.space.minimax.io/api/agent/info
```

Returns:
```json
{
  "name": "PerStream AI Listener Agent",
  "description": "An autonomous agent that pays per-second for audio on Arc",
  "capabilities": [
    "Provisions its own USDC wallet (Circle Agent Stack)",
    "Sets a daily listening budget",
    "Discovers tracks on PerStream",
    "Pays per-second via x402 + Circle Nanopayments",
    "Stops when budget exhausted",
    "Logs every transaction for transparency"
  ],
  "endpoints": {
    "POST /api/agent/listen": "Listen to one track with budget",
    "POST /api/agent/auto": "Run autonomous multi-track discovery"
  }
}
```

---

## 💰 PART 4 — How the Money Flows (the part you asked about)

### The full flow, step by step, from "press play" to "USDC moves on Arc":

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Listener presses PLAY in the browser                  │
│   Browser sends: POST /api/listen/start { trackId }          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Backend opens a session in DB                        │
│   - Generates sessionId                                       │
│   - Records: listener, creator, pricePerSec, startedAt       │
│   - Returns sessionId to browser                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 3: Every second, the backend meter ticks                │
│   setInterval(() => { tick(sessionId) }, 1000)                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 4: The tick calls the on-chain contract                  │
│   paymaster.tick(sessionId, 1)                                │
│   - Reads pricePerSec from session (e.g., 300 = 0.0003 USDC)  │
│   - Debits listener's deposit:  -300 micro-USDC                │
│   - Credits creator's earnings: +300 micro-USDC               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 5: Circle Nanopayments handles settlement                │
│   - Gasless USDC transfer on Arc                              │
│   - No ETH needed (Arc is stablecoin-native)                  │
│   - Sub-second finality                                       │
│   - Sub-cent minimum ($0.000001)                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 6: Frontend polls for updates                            │
│   Every 1.1 seconds: GET /api/listen/poll?sessionId=...      │
│   Returns: { secondsPlayed, amountPaid, balance }            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 7: User sees the live counter                            │
│   - USDC this session: 0.0012 → 0.0015 → 0.0018...           │
│   - Balance: 0.9985 → 0.9982 → 0.9979...                      │
│   - The numbers match reality (auditable on Arc)              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 8: Listener pauses or track ends → session closes        │
│   POST /api/listen/stop { sessionId }                         │
│   Backend closes session in DB                                │
│   Creator's balance now withdrawable                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 9: Creator withdraws (any time)                          │
│   POST /api/creator/withdraw { amountUsd }                    │
│   USDC moves from PerStreamPaymaster contract                 │
│   To creator's external wallet (any chain via Gateway)       │
└──────────────────────────────────────────────────────────────┘
```

### Key numbers

| Item | Value | What it means |
|---|---|---|
| 1 second of playback | 0.0003 USDC | $0.0003 (less than 1/30th of a cent) |
| 1 minute of playback | 0.018 USDC | ~2 cents |
| 1 hour of playback | 1.08 USDC | ~$1 |
| Transaction fee (Arc) | ~$0.01 | Per withdraw, not per tick |
| PerStream fee | $0 | We don't take a cut |

### What makes sub-cent pricing possible

**Circle Nanopayments on Arc** solves three problems that made this impossible before:

1. **Gasless**: traditional blockchains charge $0.50–$5 per transaction in ETH gas. Arc uses USDC for fees. No separate gas token.

2. **Sub-cent minimum**: most chains have a "dust threshold" below which transactions fail. Circle Nanopayments supports as low as $0.000001.

3. **Batched settlement**: if a creator's session settles 60 micropayments in a minute, PerStream batches them into one on-chain tx. You only pay the $0.01 fee once, not 60 times.

---

## 🔧 PART 5 — Switching to REAL USDC (not mock)

Right now the demo uses mock mode (no real USDC moves). To use real USDC:

### Step 1 — Get Arc testnet USDC
- Visit: https://faucet.circle.com
- Connect your wallet
- Request Arc testnet USDC (free, ~5 USDC per request)

### Step 2 — Get Circle API key
- Sign up: https://console.circle.com
- Create an API key with Agent Stack + Wallets scopes
- Create a Wallet Set

### Step 3 — Deploy the smart contract
- Open https://remix.ethereum.org
- Paste `contracts/PerStreamPaymaster.sol`
- Compile with Solidity 0.8.20
- Deploy to Arc testnet (MetaMask → add Arc RPC → deploy)
- Copy the contract address

### Step 4 — Configure backend
Edit `backend/.env`:
```bash
PAYMENTS_MODE=live
ARC_RPC_URL=https://rpc.testnet.arc.io
PERSTREAM_PAYMASTER_ADDRESS=0xYourContractAddress
USDC_ADDRESS=0xArcTestnetUSDC
CIRCLE_API_KEY=your_key
CIRCLE_WALLET_SET_ID=your_set_id
SETTLEMENT_PRIVATE_KEY=0xYourBackendKey
```

### Step 5 — Restart backend
```bash
cd backend
node src/server.js
```

You should see `mode: live` in the banner. Now real USDC moves on Arc.

---

## 🆘 Troubleshooting

**Q: I clicked Play but nothing happens.**
A: You need to deposit USDC first. Click "+ Add 1 USDC" then try again.

**Q: The audio doesn't play.**
A: The demo uses placeholder audio files. In production, real audio files would be uploaded.

**Q: I can't find my old session.**
A: Sessions close after pause/stop. To start fresh, click a track again.

**Q: My USDC balance is gone.**
A: Pause + stop the session. Balance updates are real-time but require the tick to fire.

**Q: I get "403" or "401" error.**
A: Sign in again. Sessions expire.

**Q: How do I delete my account?**
A: Email donYemiight with your wallet address. We'll remove it from the demo DB.

---

## 📚 Where to learn more

- **Live demo**: https://ffi8utziybe6.space.minimax.io
- **GitHub repo**: https://github.com/Donyemiight/PerStream
- **How payments work (deep dive)**: `docs/HOW_PAYMENTS_WORK.md` (in the repo)
- **Pitch script for sponsors**: `docs/PITCH.md`
- **Spec for judges**: `docs/SPEC.md`
- **Submission form prefill**: `docs/SUBMISSION.md`
- **Install from scratch**: `INSTALLATION.md`

---

**Built by Oluyemi (donyemiight) for the Lepton Agents Hackathon 2026.**