#!/usr/bin/env bash
# PerStream — self-diagnosing setup for Termux
#
# This script:
#   1. Verifies Node + npm are installed
#   2. Cleans any partial install
#   3. Installs dependencies fresh (Termux-safe)
#   4. Runs the seed script
#   5. Runs the smoke test
#   6. Reports what's missing if anything fails
#
# Paste this whole block in Termux after extracting perstream.tar.gz.

set -e

cd "$(dirname "$0")/.."

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   PerStream — diagnose & setup      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. Check Node ───
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node not installed. Installing..."
  pkg install -y nodejs
fi
NODE_VERSION=$(node --version)
echo "✓ Node: $NODE_VERSION"

# ─── 2. Check we're in the right dir ───
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
  echo "✗ Not in PerStream directory"
  echo "  Run: cd ~/PerStream  (or wherever you extracted the bundle)"
  exit 1
fi
echo "✓ In PerStream directory: $(pwd)"

# ─── 3. Make sure backend/.env exists ───
cd backend
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✓ Created .env from .env.example"
  else
    echo "✗ No .env or .env.example found — bundle is broken"
    exit 1
  fi
fi

# ─── 4. Clean install ───
if [ -d node_modules ]; then
  echo "→ Removing old node_modules..."
  rm -rf node_modules package-lock.json
fi

echo "→ Installing dependencies (this may take 1-3 minutes)..."
echo ""
if ! npm install --no-audit --no-fund --omit=optional 2>&1 | tee /tmp/npm-install.log; then
  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✗ npm install FAILED"
  echo "═══════════════════════════════════════"
  echo ""
  echo "Last 30 lines of error:"
  tail -30 /tmp/npm-install.log
  echo ""
  echo "Common fixes:"
  echo "  pkg update && pkg upgrade"
  echo "  pkg install -y python make clang"
  echo "  rm -rf node_modules package-lock.json && npm install"
  exit 1
fi

# ─── 5. Verify critical modules ───
echo ""
echo "→ Verifying modules..."
MISSING=""
for mod in express cors dotenv sql.js multer nanoid; do
  if [ ! -d "node_modules/$mod" ]; then
    MISSING="$MISSING $mod"
  fi
done
if [ -n "$MISSING" ]; then
  echo "✗ Missing modules:$MISSING"
  echo "  Try: cd backend && npm install --no-audit --no-fund --omit=optional"
  exit 1
fi
echo "✓ All required modules installed"

# ─── 6. Seed ───
echo ""
echo "→ Seeding demo data..."
cd ..
if ! node scripts/seed.js 2>&1 | tee /tmp/seed.log; then
  echo ""
  echo "✗ seed.js failed. Output:"
  cat /tmp/seed.log
  exit 1
fi

# ─── 7. Smoke test ───
echo ""
echo "→ Running smoke test (10 endpoint checks)..."
echo ""
if ! node scripts/smoke-test.js 2>&1 | tee /tmp/smoke.log; then
  echo ""
  echo "✗ smoke-test failed. Output:"
  cat /tmp/smoke.log
  exit 1
fi

# ─── 8. Done ───
echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Everything works!"
echo "═══════════════════════════════════════"
echo ""
echo "Next:"
echo "  cd backend && node src/server.js     # start the backend"
echo "  cd .. && ./scripts/demo.sh            # start + cloudflared tunnel"
echo ""
echo "Login credentials (seeded):"
echo "  Creator:  demo-creator@perstream.fm"
echo "  Listener: demo-listener@perstream.fm  (pre-funded with \$5)"
echo ""