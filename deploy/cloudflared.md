# Deploying PerStream

## Option A — Termux + cloudflared tunnel (zero-cost, instant)

Perfect for the hackathon demo. Run everything on your phone.

```bash
# In Termux
pkg update && pkg install nodejs cloudflared
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream
chmod +x scripts/demo.sh
./scripts/demo.sh
```

The script will print a public `https://<random>.trycloudflare.com` URL. Use that everywhere — in the submission form, in the Discord, in your demo video.

The tunnel is **free** and works as long as the script is running.

## Option B — Cheap VPS (production)

A $5/month VPS (DigitalOcean, Hetzner, Vultr) handles PerStream easily.

```bash
# On the VPS
git clone https://github.com/Donyemiight/PerStream.git
cd PerStream

# Option 1: Docker
docker build -f deploy/Dockerfile -t perstream .
docker run -d -p 80:3000 \
  -e PAYMENTS_MODE=live \
  -e ARC_RPC_URL=https://rpc.testnet.arc.io \
  -e PERSTREAM_PAYMASTER_ADDRESS=0x... \
  -e USDC_ADDRESS=0x... \
  -e CIRCLE_API_KEY=... \
  -e SETTLEMENT_PRIVATE_KEY=... \
  --name perstream \
  --restart unless-stopped \
  perstream

# Option 2: Bare metal (Node)
cd backend && npm install && cd ..
node scripts/seed.js
cd backend && npm start
```

Add nginx in front for HTTPS:
```nginx
server {
    listen 443 ssl;
    server_name perstream.fm;

    ssl_certificate     /etc/letsencrypt/live/perstream.fm/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/perstream.fm/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Option C — Platform (Railway / Render / Fly.io)

`deploy/Dockerfile` works on all of them. Set env vars in their dashboard.

## Recommended production setup (post-hackathon)

| Component | Recommendation |
|---|---|
| Frontend | `perstream.fm` on Cloudflare Pages (free, CDN, instant deploys from GitHub) |
| Backend | Railway or Fly.io (free tier works for hackathon, $5/mo for prod) |
| Database | Turso (libSQL, SQLite-compatible, free tier) — replaces SQLite with no code change |
| Audio storage | Cloudflare R2 (free egress, S3-compatible) — replace AUDIO_DIR |
| Wallet | Circle Agent Stack (production credentials) |
| Domain | Cloudflare Registrar ($10/yr for `.fm`) |

See `docs/HOSTING.md` (TODO) for step-by-step production deployment.