#!/usr/bin/env bash
# PerStream — bulletproof Termux bootstrap
#
# Downloads the bundle DIRECTLY from GitHub (no need to transfer files),
# extracts to ~/PerStream, runs diagnose. Single paste.

set -e

REPO="https://github.com/Donyemiight/PerStream"
BUNDLE_URL="https://github.com/Donyemiight/PerStream/releases/download/v0.1.0-termux/perstream.tar.gz"
TARGET="$HOME/PerStream"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   PerStream bootstrap (Termux)      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# 1. Make sure we have the tools
if ! command -v curl >/dev/null 2>&1; then
  echo "→ Installing curl..."
  pkg install -y curl
fi
if ! command -v node >/dev/null 2>&1; then
  echo "→ Installing nodejs..."
  pkg install -y nodejs
fi
if ! command -v tar >/dev/null 2>&1; then
  pkg install -y tar
fi

# 2. Set up storage permission (so we can write to ~/PerStream)
# This only matters the first time; harmless after
if [ ! -d "$HOME/storage" ]; then
  echo "→ Granting storage permission (you may see a popup)..."
  termux-setup-storage || true
fi

# 3. If there's an old install, move it aside (don't delete — you can recover)
if [ -d "$TARGET" ]; then
  echo "→ Backing up existing ~/PerStream → ~/PerStream.bak.$(date +%s)"
  mv "$TARGET" "$TARGET.bak.$(date +%s)"
fi

# 4. Create the target dir
mkdir -p "$TARGET"

# 5. Download the bundle from GitHub
echo "→ Downloading bundle from $BUNDLE_URL ..."
cd /tmp
if ! curl -sSL -o perstream.tar.gz "$BUNDLE_URL"; then
  echo "✗ Download failed. Check your internet connection."
  exit 1
fi

if [ ! -s perstream.tar.gz ]; then
  echo "✗ Downloaded file is empty."
  exit 1
fi

ls -la perstream.tar.gz
echo "→ Extracting..."
tar -xzf perstream.tar.gz -C "$TARGET"
cd "$TARGET"

# 6. Verify the extract worked
echo ""
echo "→ Verifying extraction..."
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
  echo "✗ Extraction didn't produce expected files"
  echo "  Files in $TARGET:"
  ls -la "$TARGET" | head -20
  exit 1
fi

echo "✓ Files extracted:"
ls -la "$TARGET" | head -20
echo ""

# 7. Run diagnose (which installs deps, seeds, smoke-tests)
echo "→ Running diagnose..."
echo ""
bash scripts/diagnose.sh