#!/usr/bin/env bash
# PerStream — bundle the project for transfer to Termux (or anywhere)
#
# Excludes node_modules, .git, .env, data files.
# Output: a single .tar.gz you can scp/copy to your phone, then untar.

set -e

cd "$(dirname "$0")/.."

OUT="/tmp/perstream.tar.gz"

echo "→ Bundling PerStream..."

tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='data/*.db' \
    --exclude='data/audio/*' \
    --exclude='*.log' \
    --exclude='*.placeholder.txt' \
    -czf "$OUT" \
    backend/src backend/package.json backend/.env.example backend/.env \
    frontend \
    contracts \
    deploy \
    docs \
    scripts \
    README.md LICENSE PUSH_NOW.md TERMUX_TROUBLESHOOTING.md

echo "✅ Done: $OUT"
echo "   Size: $(du -h "$OUT" | cut -f1)"
echo ""
echo "Next:"
echo "   - Copy $OUT to your phone (cloud storage, USB, scp, etc.)"
echo "   - In Termux: tar -xzf perstream.tar.gz && cd PerStream && bash scripts/push-to-github.sh"