#!/usr/bin/env bash
# PerStream — push to GitHub
#
# SAFE PATTERN: when git push asks for credentials, it prompts locally in your
# terminal. You paste the PAT into Termux's hidden prompt, NOT into chat.
# This script does NOT touch your token in any way.
#
# Usage:
#   1. From your machine (this sandbox), bundle the project:
#        bash scripts/bundle.sh > /tmp/perstream.tar.gz
#   2. Copy /tmp/perstream.tar.gz to your phone (any way you like)
#   3. In Termux:
#        pkg install git
#        cd ~
#        tar -xzf perstream.tar.gz
#        cd PerStream
#        bash scripts/push-to-github.sh
#   4. Termux will prompt for your GitHub username + PAT (hidden input)
#   5. Done. Push is complete.

set -e

echo "═══════════════════════════════════════"
echo "  PerStream — push to GitHub"
echo "═══════════════════════════════════════"

REPO_URL="https://github.com/Donyemiight/PerStream.git"

# Verify git is installed
command -v git >/dev/null 2>&1 || { echo "✗ git not installed. Run: pkg install git"; exit 1; }

# Check we're in the project root
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
  echo "✗ Run this from the PerStream project root"
  exit 1
fi

# Set git identity if not set
if [ -z "$(git config user.name)" ]; then
  echo "→ Setting git identity (one-time)"
  git config user.name "donYemiight"
  git config user.email "donYemiight@users.noreply.github.com"
fi

# Init if needed
if [ ! -d ".git" ]; then
  echo "→ Initializing repo"
  git init
  git branch -M main
  git remote add origin "$REPO_URL"
fi

# Add a .gitignore
if [ ! -f ".gitignore" ]; then
  cat > .gitignore <<'EOF'
node_modules/
data/
*.db
*.log
.env
.env.local
.DS_Store
*.placeholder.txt
EOF
fi

# Stage and commit
echo "→ Staging files..."
git add .

if git diff --cached --quiet; then
  echo "→ Nothing to commit (everything already committed)"
else
  echo "→ Creating commit..."
  git commit -m "PerStream: per-second USDC streaming paywall on Arc

Built for Lepton Agents Hackathon (Canteen × Circle, June 15-29, 2026).
- Smart contract: PerStreamPaymaster.sol
- Backend: Node.js + Express + SQLite + x402 + Circle Nanopayments (mock + live modes)
- Frontend: vanilla HTML/JS (no build step)
- 3 sample tracks seeded for demo
- Full SPEC, PITCH, DEMO, SUBMISSION docs

Built solo by @donYemiight on Termux (Android)."
fi

# Push
echo ""
echo "→ Pushing to $REPO_URL"
echo "  When prompted:"
echo "    Username: Donyemiight"
echo "    Password: <paste your PAT here — input is hidden>"
echo ""
git push -u origin main

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Pushed!"
echo "  https://github.com/Donyemiight/PerStream"
echo ""
echo "  After this:"
echo "   - Verify your PAT is fine-grained (only this repo, contents:write)"
echo "   - When the project is done, revoke the PAT at:"
echo "     https://github.com/settings/tokens"
echo "═══════════════════════════════════════"