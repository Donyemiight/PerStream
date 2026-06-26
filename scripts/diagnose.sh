#!/usr/bin/env sh
# PerStream — self-diagnosing setup for Termux
#
# Compatible with /bin/sh (dash, ash) and bash. No bash-specific features.
#
# 1. Verifies Node + npm are installed
# 2. Cleans any partial install
# 3. Installs dependencies fresh (Termux-safe)
# 4. Runs the seed script
# 5. Runs the smoke test
# 6. Reports what's missing if anything fails

cd "$(dirname "$0")/.." 2>/dev/null || cd "$(dirname "$0")"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   PerStream — diagnose & setup      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. Check Node ───
if ! command -v node >/dev/null 2>&1; then
  echo "Node not installed. Installing..."
  pkg install -y nodejs
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not installed. Installing..."
  pkg install -y nodejs
fi
NODE_VERSION=$(node --version 2>/dev/null || echo "missing")
NPM_VERSION=$(npm --version 2>/dev/null || echo "missing")
echo "Node: $NODE_VERSION"
echo "npm:  $NPM_VERSION"

# ─── 2. Check we're in the right dir ───
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
  echo ""
  echo "Not in PerStream directory"
  echo "  Run: cd ~/PerStream  (or wherever you extracted the bundle)"
  echo "  Current dir: $(pwd)"
  echo ""
  ls -la
  exit 1
fi
echo "In PerStream directory: $(pwd)"

# ─── 3. Make sure backend/.env exists ───
cd backend
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    echo "No .env or .env.example found — bundle is broken"
    ls -la
    exit 1
  fi
fi

# ─── 4. Clean install ───
if [ -d "node_modules" ]; then
  echo "Removing old node_modules..."
  rm -rf node_modules package-lock.json
fi

echo "Installing dependencies (this may take 1-3 minutes)..."
echo ""
if ! npm install --no-audit --no-fund --omit=optional > /tmp/npm-install.log 2>&1; then
  echo ""
  echo "═══════════════════════════════════════"
  echo "  npm install FAILED"
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
echo ""
echo "npm install complete"

# ─── 5. Verify critical modules ───
echo ""
echo "Verifying modules..."
MISSING=""
for mod in express cors dotenv sql.js multer nanoid; do
  if [ ! -d "node_modules/$mod" ]; then
    MISSING="$MISSING $mod"
  fi
done
if [ -n "$MISSING" ]; then
  echo "Missing modules:$MISSING"
  echo "  Try: cd backend && npm install --no-audit --no-fund --omit=optional"
  exit 1
fi
echo "All required modules installed"

# ─── 6. Seed ───
echo ""
echo "Seeding demo data..."
cd ..
if ! node scripts/seed.js > /tmp/seed.log 2>&1; then
  echo ""
  echo "seed.js failed. Output:"
  cat /tmp/seed.log
  exit 1
fi

# ─── 7. Smoke test ───
echo ""
echo "Running smoke test (10 endpoint checks)..."
echo ""
if ! node scripts/smoke-test.js 2>&1; then
  echo ""
  echo "smoke-test.js failed. See output above."
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
echo "  cd .. && sh scripts/demo.sh           # start + cloudflared tunnel"
echo ""
echo "Login credentials (seeded):"
echo "  Creator:  demo-creator@perstream.fm"
echo "  Listener: demo-listener@perstream.fm  (pre-funded with \$5)"
echo ""