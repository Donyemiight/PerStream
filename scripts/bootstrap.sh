#!/usr/bin/env bash
# PerStream — bulletproof Termux bootstrap
#
# Tries multiple sources for the bundle, in order, until one works.
# Prints exactly what's wrong if everything fails.

set -e

REPO="https://github.com/Donyemiight/PerStream"
TARGET="$HOME/PerStream"

# Bundle sources, in priority order. Each must work without auth.
BUNDLE_URLS=(
  "https://github.com/Donyemiight/PerStream/releases/download/v0.1.0-termux/perstream.tar.gz"
  "https://github.com/Donyemiight/PerStream/raw/main/perstream.tar.gz"
  "https://raw.githubusercontent.com/Donyemiight/PerStream/main/perstream.tar.gz"
  "https://raw.githubusercontent.com/Donyemiight/PerStream/master/perstream.tar.gz"
)

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   PerStream bootstrap (Termux)      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. Make sure we have the tools ───
echo "→ Checking tools..."
if ! command -v curl >/dev/null 2>&1; then
  echo "  Installing curl..."
  pkg install -y curl
fi
if ! command -v node >/dev/null 2>&1; then
  echo "  Installing nodejs..."
  pkg install -y nodejs
fi
if ! command -v tar >/dev/null 2>&1; then
  echo "  Installing tar..."
  pkg install -y tar
fi
if ! command -v wget >/dev/null 2>&1; then
  pkg install -y wget 2>/dev/null || true
fi
echo "  ✓ curl:    $(curl --version 2>/dev/null | head -1)"
echo "  ✓ node:    $(node --version 2>/dev/null)"
echo "  ✓ tar:     $(tar --version 2>/dev/null | head -1)"

# ─── 2. Test connectivity to GitHub ───
echo ""
echo "→ Testing GitHub connectivity..."
GITHUB_OK=0
for url in "${BUNDLE_URLS[@]}"; do
  echo -n "  trying $url ... "
  if curl -sSL --max-time 15 -o /tmp/perstream-test.tar.gz "$url" 2>/dev/null; then
    if [ -s /tmp/perstream-test.tar.gz ] && [ "$(stat -c%s /tmp/perstream-test.tar.gz 2>/dev/null)" -gt 1000 ]; then
      echo "✓ OK ($(stat -c%s /tmp/perstream-test.tar.gz) bytes)"
      GITHUB_OK=1
      BUNDLE_URL=$url
      break
    else
      echo "✗ empty"
    fi
  else
    echo "✗ failed"
  fi
done

if [ "$GITHUB_OK" -eq 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  ✗ Could not download the bundle from any URL"
  echo "═══════════════════════════════════════════════"
  echo ""
  echo "Possible causes:"
  echo "  1. No internet access on this phone"
  echo "  2. GitHub is blocked by your ISP / network"
  echo "  3. DNS issues — try: ping github.com"
  echo "  4. TLS issues — try: curl -v https://github.com"
  echo ""
  echo "Workaround: download the bundle on your computer, then:"
  echo "  - Email it to yourself as attachment"
  echo "  - Upload to Google Drive / Dropbox, download on phone"
  echo "  - USB transfer"
  echo ""
  echo "Then run this in Termux:"
  echo "  tar -xzf /path/to/perstream.tar.gz -C ~/"
  echo "  cd ~/PerStream && bash scripts/diagnose.sh"
  exit 1
fi

# ─── 3. Move test bundle to final location ───
mv /tmp/perstream-test.tar.gz /tmp/perstream.tar.gz
echo ""
echo "✓ Bundle ready: $(stat -c%s /tmp/perstream.tar.gz) bytes"

# ─── 4. Back up old install if any ───
if [ -d "$TARGET" ]; then
  BK="$TARGET.bak.$(date +%s)"
  echo "→ Backing up old install to $BK"
  mv "$TARGET" "$BK"
fi

# ─── 5. Extract ───
mkdir -p "$TARGET"
echo "→ Extracting to $TARGET ..."
tar -xzf /tmp/perstream.tar.gz -C "$TARGET"
cd "$TARGET"

# Verify
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
  echo "✗ Extraction failed"
  echo "  Files in $TARGET:"
  ls -la "$TARGET" | head -20
  exit 1
fi

echo ""
echo "✓ Extracted $(ls -1 "$TARGET" | wc -l) top-level entries"
ls -la "$TARGET" | head -20

# ─── 6. Run diagnose ───
echo ""
echo "→ Running diagnose..."
echo ""
bash scripts/diagnose.sh