# PerStream — Live URLs

> Current production URLs for the PerStream demo. Updated: 2026-06-28.

## Current Live (verified working)

| Type | URL |
|---|---|
| **Static** | `https://9tu56nbtqjro.space.minimax.io` |
| **Live (Arc testnet)** | `https://label-musicians-addition-armed.trycloudflare.com` |

### Direct pages

| Page | Static | Live |
|---|---|---|
| Landing | `https://9tu56nbtqjro.space.minimax.io` | `https://label-musicians-addition-armed.trycloudflare.com` |
| Listen | `https://9tu56nbtqjro.space.minimax.io/listen.html` | `https://label-musicians-addition-armed.trycloudflare.com/listen.html` |
| Creator | `https://9tu56nbtqjro.space.minimax.io/creator.html` | `https://label-musicians-addition-armed.trycloudflare.com/creator.html` |
| LIVE_SETUP | `https://9tu56nbtqjro.space.minimax.io/LIVE_SETUP.html` | `https://label-musicians-addition-armed.trycloudflare.com/LIVE_SETUP.html` |

## GitHub

- **Repo:** https://github.com/Donyemiight/PerStream
- **Latest release:** https://github.com/Donyemiight/PerStream/releases/tag/v0.1.0-termux
- **Bundle:** https://github.com/Donyemiight/PerStream/releases/download/v0.1.0-termux/perstream-v96.tar.gz

## Arc testnet addresses (canonical)

| Role | Address |
|---|---|
| Seller wallet | `0xEb375940Cd0D85f06239d68C6e719c71907771f9` |
| Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Creator earnings | `0x9b198314420Ffc0f7a5e4895a2CFCc12D0b53493` |

View on Arcscan:
- https://testnet.arcscan.app/address/0xEb375940Cd0D85f06239d68C6e719c71907771f9
- https://testnet.arcscan.app/address/0x0077777d7EBA4688BDeF3E311b846F25870A19B9
- https://testnet.arcscan.app/address/0x9b198314420Ffc0f7a5e4895a2CFCc12D0b53493

## Tunnel restart

If the live tunnel dies:

```bash
pkill -9 cloudflared 2>/dev/null
[ -f /tmp/cloudflared ] || curl -L -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x /tmp/cloudflared
nohup /tmp/cloudflared tunnel --url http://localhost:3000 --no-autoupdate > /tmp/tunnel.log 2>&1 < /dev/null &
disown
sleep 14
URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" /tmp/tunnel.log | head -1)
echo "$URL"
```

After restart, update this file with the new URL.
