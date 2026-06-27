# PerStream Live URLs

## Current Live Demo
**https://providence-musician-civic-watt.trycloudflare.com**

Status: ACTIVE (since 2026-06-27 21:09 UTC)

## Tunnel Info
The live demo runs on a Cloudflare Quick Tunnel. If the URL changes, check
the latest commit in this repo — the homepage URL is updated automatically.

If you see "Error 1033", the tunnel may have died. Restart it with:

```bash
pkill -9 cloudflared 2>/dev/null
[ -f /tmp/cloudflared ] || curl -L -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x /tmp/cloudflared
nohup /tmp/cloudflared tunnel --url http://localhost:3000 --no-autoupdate > /tmp/tunnel.log 2>&1 < /dev/null &
disown
sleep 14
URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" /tmp/tunnel.log | head -1)
echo "$URL"
```

## Static Hosted Version (read-only)
The frontend is also deployed at a stable static URL for read-only preview.

## Backup URLs (this session)
| URL | Active |
|-----|--------|
| providence-musician-civic-watt.trycloudflare.com | YES |
| invision-specified-caribbean-occupational.trycloudflare.com | DEAD |
| jerry-newport-textbooks-importantly.trycloudflare.com | DEAD |
| destination-hanging-boating-months.trycloudflare.com | DEAD |
