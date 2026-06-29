# PerStream — 2-Minute Demo Script

> **Goal:** Show live per-second USDC settlement on Arc. Judges should be unable to look away.
>
> **Format:** Screen recording, narrated, cuts every 10–15 seconds. Music: quiet lo-fi. No jumpy edits — judges need to follow.

---

## Setup (1 min before you hit record)

- [ ] Open `https://perstream-demo.live` (or your latest deployed URL — the cloudflared URL printed by `scripts/demo.sh`)
- [ ] Have one tab on `creator.html` (your dashboard, logged in)
- [ ] Have one tab on `listen.html` (the public URL you're demoing)
- [ ] Have Arc testnet explorer open in a third tab
- [ ] Have a Circle wallet UI visible (so listeners can see the spend)
- [ ] Audio: narrator headset, no background noise
- [ ] Time the script once before recording

---

## The script

### Beat 1 — The hook (0:00–0:10)
> **On screen:** black screen, then PerStream logo animates in. Audio: a single tick sound.
> **You say:** "PerStream. Every second, paid."

### Beat 2 — The problem (0:10–0:30)
> **On screen:** cold, plain text on black, one line at a time.
>
> - "Creators can't monetize from listener #1."
> - "Subscriptions need 1,000 subs."
> - "Ads need 5,000 downloads."
> - "By then, most creators have quit."
>
> **You say (voiceover):** "The cold-start cliff. Every creator hits it. Most never climb over."

### Beat 3 — The fix (0:30–0:50)
> **On screen:** PerStream logo, then split-screen — left: a waveform breaking into seconds; right: USDC counter ticking.
>
> **You say:** "What if listeners paid per second of audio actually played? No subscriptions. No ads. No minimum audience. From listener #1, the creator earns."

### Beat 4 — Live demo: creator side (0:50–1:10)
> **On screen:** switch to `creator.html`. Click **Upload Track**. Drag in an MP3. Set price: `0.0003 USDC/sec`.
>
> **You say:** "Creator uploads a track, sets a price — three-tenths of a cent per second — and gets a public link."
>
> **On screen:** copy the link, paste in chat (just for show).

### Beat 5 — Live demo: listener side (1:10–1:40)
> **On screen:** switch to `listen.html`. Paste the URL. Authenticate with email (one-click). Hit **Play**.
>
> **You say:** "Listener opens the link, signs in with one click — no MetaMask popup, no seed phrase — and presses play."
>
> **On screen:** audio plays, USDC counter ticks up every second: `0.0003 ... 0.0006 ... 0.0009 ...`
>
> **You say:** "Every second, a gasless USDC micro-payment settles on Arc. Watch the wallet."
>
> **On screen:** switch to creator dashboard — earnings tick up in real time.
>
> **You say:** "The creator's dashboard shows earnings live. From listener one."

### Beat 6 — Live demo: pause (1:40–1:50)
> **On screen:** click pause. Counter freezes.
>
> **You say:** "Pause. Payments stop. No phantom charges."

### Beat 7 — The infrastructure flex (1:50–2:05)
> **On screen:** overlay with logos: Circle Nanopayments · Arc · Agent Stack · x402.
>
> **You say:** "Built on Circle Nanopayments — gasless USDC as small as one millionth of a dollar. Arc for the chain. Agent Stack for the wallet. x402 for the paywall."

### Beat 8 — The closer (2:05–2:15)
> **On screen:** PerStream logo + URL + GitHub link.
>
> **You say:** "PerStream. Every second, paid. github.com/Donyemiight/PerStream."

---

## What to do AFTER the recording

1. Trim to 2:00 exactly.
2. Upload to YouTube (unlisted is fine for hackathon).
3. Pin the link in the submission form + Discord `#lepton-hackers` + your X thread.
4. Mirror on `youtube.com/shorts/<id>` (optional, expands reach).

---

## Recording tips from real hackathon wins

- **Narrate as you click** — don't record silence + voiceover later, judges read body language of the screen.
- **Show the wallet UI** — hearing "gasless USDC" is meh, watching the number tick is visceral.
- **One demo, not ten** — resist showing RSS import, analytics, etc. Tight demo > feature tour.
- **Cut mistakes, not breath** — natural pace feels honest; jumpy cuts feel fake.
- **End on the URL** — judges should screenshot it without scrolling.

---

## Failure modes to avoid

| Failure | Why it kills the demo | Fix |
|---|---|---|
| Wallet popup blocks the flow | Judges see MetaMask, think "crypto project" | Use embedded wallet, never MetaMask |
| Slow RPC makes tick laggy | Looks broken | Pre-cache, show recent settlement not live one |
| Audio cuts out | Embarrassing | Have a backup MP3 loaded |
| You read the script robotically | Judges tune out | Practice 3x, then record |
| Demo > 2 minutes | Judges' attention breaks | Time it. Cut filler. |