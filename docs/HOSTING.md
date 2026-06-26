# PerStream — Hosting & Domain Recommendation

> _What to buy, where to put it, in what order. Pre-hackathon (today) vs post-hackathon (after win)._

---

## TL;DR — recommended setup

| Component | Pick | Cost | Why |
|---|---|---|---|
| **Domain** | `perstream.fm` via Cloudflare Registrar | **$10/yr** | `.fm` = audio perfect fit, Cloudflare = free WHOIS privacy + cheapest reg |
| **Backend** | Fly.io (free tier) | **$0–5/mo** | Generous free tier, runs Docker, fast global |
| **Frontend** | Cloudflare Pages | **Free** | Free CDN, GitHub-deploy, instant |
| **DB** | Turso (libSQL) | **Free** | SQLite-compatible, replaces local file with one line change |
| **Audio storage** | Cloudflare R2 | **Free tier** | 10GB free, no egress fees (game-changer for audio) |
| **Tunnel (today)** | cloudflared | **Free** | Public URL from Termux in 30 seconds |

**Total cost for hackathon demo:** $0
**Total cost for production-ready after win:** ~$15/year + ~$5/month

---

## Buy the domain NOW (before hackathon starts)

**`perstream.fm`** is the play.

Why `.fm`:
- The `.fm` TLD has always been used for radio/audio products (last.fm, Audio.fm, etc.)
- Search engines + judges + users read `.fm` as "audio" — instant brand fit
- Available at most registrars, cheap ($10–20/yr)

**Where to buy:** Cloudflare Registrar
- https://dash.cloudflare.com → Domain Registration → Search `perstream.fm`
- $10/yr wholesale price (no markup like Namecheap/GoDaddy)
- Free WHOIS privacy
- Free DNS that any backend can point to
- If `perstream.fm` is taken, fallbacks: `perstream.audio`, `perstream.stream`, `getperstream.fm`

**Set up DNS:**
```
perstream.fm         A     192.0.2.1   (placeholder; point to backend later)
www.perstream.fm    CNAME   perstream.fm
```

You don't need to point DNS at anything yet — having the domain in your control matters more than having it live during the hackathon.

---

## Today (hackathon demo) — zero-cost setup

Run on Termux + cloudflared tunnel. Free, works in 5 minutes.

```bash
# Already in scripts/demo.sh
cd PerStream
./scripts/demo.sh
```

Output: `https://<random>.trycloudflare.com` URL — paste that everywhere.

**Pros:** $0, instant, no setup, perfect for the 14-day sprint.
**Cons:** URL is ugly, tunnel closes when Termux closes, no analytics.

---

## Post-hackathon (production-ready) — if you win or get adopted

### Option A: All-Cloudflare stack (recommended)

**Why:** Cloudflare ecosystem is the cleanest for this — Pages (frontend), Workers (backend), R2 (audio), DNS, Registrar — all one account, all cheap, all fast globally.

```
Frontend  → Cloudflare Pages    (free, CDN, deploy from GitHub)
Backend   → Cloudflare Workers  (free tier: 100k req/day)
Audio     → Cloudflare R2       (10GB free, no egress)
DB        → Turso / D1          (free tier)
Domain    → Cloudflare Registrar ($10/yr)
SSL       → Automatic via Cloudflare
```

This is what I'd ship if PerStream got acquired by Canteen or Circle. Total monthly cost at low traffic: **$0–5**.

### Option B: $5 VPS (if you want full Node)

For when you outgrow Workers or want to run a real Node server with WebSocket etc.

- **DigitalOcean** $4/mo: 1 vCPU, 1GB RAM, 25GB SSD → enough for PerStream for years
- **Hetzner** €4/mo: better hardware, EU-based, more privacy-respecting
- **Vultr** $5/mo: 1 vCPU, 1GB RAM, global locations

Setup with the provided `deploy/Dockerfile`:
```bash
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream
docker build -f deploy/Dockerfile -t perstream .
docker run -d -p 80:3000 \
  -e PAYMENTS_MODE=live \
  -e ARC_RPC_URL=https://rpc.testnet.arc.io \
  -e PERSTREAM_PAYMASTER_ADDRESS=0x... \
  --name perstream --restart unless-stopped \
  perstream
```

---

## What to NOT spend money on

| Thing | Why skip |
|---|---|
| Vercel Pro | You don't need their bandwidth; Cloudflare Pages is free + faster |
| AWS | Overkill, surprise billing, bad DX |
| Fancy landing page builder | You have a working app; that's your landing page |
| Premium Tailwind/Figma | The CSS in this repo is already clean and brand-consistent |

---

## Decision matrix: when to upgrade from each tier

| Trigger | Move to |
|---|---|
| Cloudflared tunnel cuts out before judging | Railway / Fly.io free tier (1-line deploy) |
| First paying user | $4 DigitalOcean + Docker (5-min setup) |
| 100 listeners | Cloudflare R2 for audio, Workers for backend |
| 10k listeners | Talk to Circle about sponsorship / acquisition |
| 100k listeners | You're hired. Call me. |

---

## If you're in a rush (3 minutes to deploy)

1. Buy `perstream.fm` on Cloudflare Registrar → 3 minutes
2. `cd PerStream && ./scripts/demo.sh` → 2 minutes  
3. Copy the cloudflared URL into the submission form → 30 seconds
4. Demo video → record later

Total cost: $10.
Total time: under 10 minutes.

That's all you need for the hackathon. Upgrade to production only if you win.