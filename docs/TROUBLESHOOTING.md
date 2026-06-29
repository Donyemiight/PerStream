# PerStream — Chrome ERR_CONNECTION_REFUSED fix

The backend is running on port 3000 (you saw the banner), but Chrome says "refused to connect".

**Why:** On Android, Chrome's network sandbox is sometimes isolated from Termux's. `localhost` in Chrome might point to Chrome's loopback, not Termux's.

## The fixes (try in order)

### Fix 1 — Use the phone's actual IP (most common fix)

In **Termux** (the terminal running the backend):

```bash
hostname -I
```

That prints the phone's IP on the local network, like `192.168.1.42`. Copy it.

In **Chrome**, go to:

```
http://192.168.1.42:3000
```

(Replace with your actual IP.)

If you see the PerStream landing page — that's the fix. The cloudflared tunnel will work fine too because it goes through the phone's IP from outside.

### Fix 2 — Use 127.0.0.1 instead of localhost

Sometimes Chrome treats `localhost` differently from `127.0.0.1`. Try:

```
http://127.0.0.1:3000
```

### Fix 3 — Use 10.0.2.2 (Android emulator) or check Termux networking

```bash
# Check what IP Termux is actually listening on
ss -tlnp 2>/dev/null | grep :3000 || netstat -tlnp 2>/dev/null | grep :3000
```

If it shows `0.0.0.0:3000` or `:::3000` → it's listening on all interfaces, Chrome should be able to reach it.

If it shows `127.0.0.1:3000` only → it only accepts local connections. Restart the server with HOST=0.0.0.0:

```bash
# Stop the server (Ctrl+C), then:
cd ~/ps/backend
HOST=0.0.0.0 PORT=3000 node src/server.js
```

### Fix 4 — Use a Termux tool to bridge

If none of the above work, your Android version is being very strict about networking. Use Termux's networking helpers:

```bash
# Make Termux network accessible from browser
termux-setup-storage   # may need to re-grant
```

Or skip Chrome and use Termux's built-in browser:

```bash
pkg install w3m
w3m http://localhost:3000
```

This is a text-mode browser — it works even when Chrome can't reach the server.

### Fix 5 — Get a public URL with cloudflared anyway

This is the real fix. Even if Chrome can't reach the local backend, cloudflared creates a tunnel that anyone (including judges) can reach from anywhere:

```bash
# In a new Termux session, while backend still runs in the original
curl -L -o ~/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
chmod +x ~/cloudflared
~/cloudflared tunnel --url http://localhost:3000
```

The cloudflared URL works from any browser, anywhere. Use that in the Lepton form.

### Fix 6 — Verify backend is actually listening

```bash
# From the same Termux session:
curl http://localhost:3000/api/health
```

Should print JSON like `{"ok":true,"service":"perstream-backend",...}`. If it does, the backend IS running. The Chrome issue is just browser-side.

If `curl` fails too, then the backend isn't actually running. Restart it:

```bash
cd ~/ps/backend
node src/server.js
```

## The real solution

For the Lepton submission, you need a public URL anyway. So skip the Chrome-local-debugging and just:

1. Start the backend
2. Run cloudflared
3. Copy the public URL
4. Test the public URL in Chrome (works from anywhere)
5. Submit that URL to the Lepton form

That's the path that actually matters. Local Chrome testing is nice but optional.

---

## Quick diagnostic block

Run this all at once in Termux:

```bash
echo "=== Backend health check ==="
curl -s http://localhost:3000/api/health

echo ""
echo "=== Listening ports ==="
ss -tlnp 2>/dev/null | head -10 || netstat -tlnp 2>/dev/null | head -10

echo ""
echo "=== Phone IPs ==="
hostname -I

echo ""
echo "=== Backend process ==="
ps aux 2>/dev/null | grep "node src" | grep -v grep | head -3
```

Send me the output and I'll tell you what's wrong.