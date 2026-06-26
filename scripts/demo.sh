#!/usr/bin/env bash
# PerStream — one-shot demo runner
#
# Starts backend, opens a cloudflared tunnel, prints the public URL.
# Designed for Termux — works on any Linux/macOS too.

set -e

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════"
echo "  PerStream — demo runner"
echo "═══════════════════════════════════════"

# Check deps
command -v node >/dev/null 2>&1 || { echo "✗ node not installed. Run: pkg install nodejs"; exit 1; }
command -v cloudflared >/dev/null 2>&1 || {
  echo "⚠ cloudflared not installed. Backend will run on localhost only."
  echo "  Install: pkg install cloudflared (Termux) or https://github.com/cloudflare/cloudflared"
}

# Setup env
cd backend
if [ ! -f .env ]; then
  echo "→ Creating .env from .env.example"
  cp .env.example .env
fi

# Install deps
if [ ! -d node_modules ]; then
  echo "→ Installing backend deps..."
  npm install
fi

# Seed
echo "→ Seeding sample data..."
cd ..
node scripts/seed.js

# Start backend
echo ""
echo "→ Starting backend on :3000..."
cd backend
npm run dev &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for boot
sleep 3

# Open tunnel
if command -v cloudflared >/dev/null 2>&1; then
  echo ""
  echo "→ Opening cloudflared tunnel..."
  cloudflared tunnel --url http://localhost:3000 2>&1 | tee /tmp/perstream-tunnel.log &
  TUNNEL_PID=$!
  sleep 5

  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/perstream-tunnel.log | head -1)
  if [ -n "$PUBLIC_URL" ]; then
    echo ""
    echo "═══════════════════════════════════════"
    echo "  ✅ PerStream is live!"
    echo "  Public URL: $PUBLIC_URL"
    echo ""
    echo "  Test:"
    echo "    curl $PUBLIC_URL/api/health"
    echo "    open $PUBLIC_URL/listen.html"
    echo "    open $PUBLIC_URL/creator.html"
    echo "═══════════════════════════════════════"
  fi
fi

# Keep running
trap "kill $BACKEND_PID 2>/dev/null" EXIT
wait $BACKEND_PID