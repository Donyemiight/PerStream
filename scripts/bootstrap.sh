#!/usr/bin/env bash
# PerStream — bulletproof Termux bootstrap
#
# Tries multiple sources for the bundle, writes to $HOME (not /tmp —
# /tmp doesn't exist on some Android devices), gives detailed errors.

set -e

REPO="https://github.com/Donyemiight/PerStream"
TARGET="$HOME/PerStream"
TMPDIR="$HOME/.perstream-tmp"

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

# ─── 1. Tools ───
echo "→ Checking tools..."
if ! command -v curl >/dev/null 2>&1; then pkg install -y curl; fi
if ! command -v node >/dev/null 2>&1; then pkg install -y nodejs; fi
if ! command -v tar >/dev/null 2>&1; then pkg install -y tar; fi
echo "  ✓ curl: $(curl --version 2>/dev/null | head -1)"
echo "  ✓ node: $(node --version 2>/dev/null)"
echo "  ✓ tar:  $(tar --version 2>/dev/null | head -1)"

# ─── 2. Use a writable scratch dir (NOT /tmp — Termux quirk) ───
mkdir -p "$TMPDIR"
echo ""
echo "→ Scratch dir: $TMPDIR (writable: $([ -w "$TMPDIR" ] && echo ✓ || echo ✗))"

# Check disk space (need at least 100MB for node_modules)
FREE_MB=$(df -m "$HOME" 2>/dev/null | tail -1 | awk '{print $4}')
if [ -n "$FREE_MB" ] && [ "$FREE_MB" -lt 100 ]; then
  echo "⚠ Only ${FREE_MB}MB free in $HOME. Need ~100MB for node_modules."
  echo "  Clean up some files first: rm -rf ~/PerStream.old ~/PerStream.bak.*"
fi

# ─── 3. Try each URL until one works ───
echo ""
echo "→ Trying bundle URLs..."
BUNDLE_OK=0
WORKING_URL=""
for url in "${BUNDLE_URLS[@]}"; do
  echo -n "  $url ... "
  OUT="$TMPDIR/perstream-$(date +%s).tar.gz"
  if curl -sSL --max-time 30 -o "$OUT" "$url" 2>/dev/null; then
    SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 1000 ]; then
      echo "✓ ($SIZE bytes)"
      WORKING_URL="$url"
      BUNDLE_OK=1
      FINAL_BUNDLE="$OUT"
      break
    else
      echo "✗ too small ($SIZE bytes)"
      rm -f "$OUT"
    fi
  else
    EXIT=$?
    echo "✗ curl exit $EXIT"
    rm -f "$OUT"
  fi
done

if [ "$BUNDLE_OK" -eq 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  ✗ All URLs failed"
  echo "═══════════════════════════════════════════════"
  echo ""
  echo "Quick connectivity test:"
  curl -sSL --max-time 10 -o /dev/null -w "  github.com → %{http_code}\n" "https://github.com" 2>&1
  curl -sSL --max-time 10 -o /dev/null -w "  raw.githubusercontent.com → %{http_code}\n" "https://raw.githubusercontent.com" 2>&1
  echo ""
  echo "If both return 000 → no internet. Try:"
  echo "  - Toggle airplane mode off and on"
  echo "  - Switch wifi ↔ mobile data"
  echo "  - Move closer to router"
  echo ""
  echo "If they return 200/301/302 → something else is wrong. Tell me the output."
  exit 1
fi

echo ""
echo "✓ Got bundle from: $WORKING_URL"
echo "  Size: $(stat -c%s "$FINAL_BUNDLE" 2>/dev/null || stat -f%z "$FINAL_BUNDLE") bytes"

# ─── 4. Back up old install if exists ───
if [ -d "$TARGET" ]; then
  BK="$TARGET.bak.$(date +%s)"
  echo "→ Backing up old install to $BK"
  mv "$TARGET" "$BK"
fi

# ─── 5. Extract ───
mkdir -p "$TARGET"
echo "→ Extracting to $TARGET ..."
tar -xzf "$FINAL_BUNDLE" -C "$TARGET"
cd "$TARGET"

if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
  echo "✗ Extraction failed"
  ls -la "$TARGET" | head -20
  exit 1
fi

echo ""
echo "✓ Extracted. Top-level entries:"
ls -la "$TARGET" | head -15

# ─── 6. Run diagnose ───
echo ""
echo "→ Running diagnose (install + seed + smoke test)..."
echo ""
bash scripts/diagnose.sh