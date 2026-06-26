#!/usr/bin/env sh
# PerStream — manual install steps (one-line each)
# Run each line separately if anything fails.

# Step 1: extract
mkdir -p ~/PerStream && tar -xzf ~/bundle.tar.gz -C ~/PerStream

# Step 2: copy .env
cp ~/PerStream/backend/.env.example ~/PerStream/backend/.env

# Step 3: install deps (no native build, no NDK)
cd ~/PerStream/backend
npm install --no-audit --no-fund --omit=optional

# Step 4: seed data
cd ~/PerStream
node scripts/seed.js

# Step 5: smoke test
node scripts/smoke-test.js

# Step 6: start backend
echo ""
echo "✅ Install complete!"
echo ""
echo "To start the backend:"
echo "  cd ~/PerStream/backend && node src/server.js"
echo ""
echo "Login credentials:"
echo "  Creator:  demo-creator@perstream.fm"
echo "  Listener: demo-listener@perstream.fm"