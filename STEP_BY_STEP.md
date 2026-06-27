# PerStream — STEP-BY-STEP install for Termux

> _Type each line separately. Hit Enter after each. Read what to expect BEFORE running it._

---

## STEP 1 — Open Termux

You should see a black screen with a blinking cursor. Path should show `~ $`.

**If your prompt looks weird** (not starting with `~`), type:
```bash
cd ~
```

---

## STEP 2 — Download the bundle

```bash
curl -L -o bundle.tar.gz https://github.com/Donyemiight/PerStream/releases/download/v0.1.0-termux/perstream.tar.gz
```

**Expected:** Scrolling download progress. Ends with:
```
100 ... bundle.tar.gz saved [50151/50151]
```

**If you see "command not found"** → run `pkg install -y curl` first, then retry.

---

## STEP 3 — Verify the file is there

```bash
ls -la bundle.tar.gz
```

**Expected:** Shows a file around 50,000 bytes (50KB). The size number in the output should match.

**If size is 0 or file doesn't exist** → the download in step 2 failed. Try it again.

---

## STEP 4 — Make a clean folder and extract

```bash
mkdir -p ~/ps
```

**Expected:** No output. (mkdir only complains if there's an error.)

```bash
cd ~/ps
```

**Expected:** No output. (cd is silent when successful.)

```bash
tar -xzf ~/bundle.tar.gz
```

**Expected:** No output. (tar is silent unless there's an error.)

---

## STEP 5 — Verify files are extracted

```bash
ls
```

**Expected:** You should see files like:
```
HANDOFF.md   contracts   frontend   scripts
LICENSE      deploy      docs       bundle.tar.gz
README.md
```

---

## STEP 6 — Go into the project

```bash
cd ~/ps
```

(The bundle extracts directly into the current dir, so `~/ps` IS the project.)

---

## STEP 7 — Install Node.js dependencies

```bash
cd backend
```

```bash
npm install --no-audit --no-fund --omit=optional
```

**Expected:** Downloads packages for 30-90 seconds. Ends with:
```
added 92 packages in 47s
```

**If you see "gyp ERR!" or "better-sqlite3" errors** → you're using an old bundle. Re-do STEP 2.

**If it hangs forever** → check WiFi/mobile data. Run `ping github.com` to test.

---

## STEP 8 — Seed the demo data

```bash
cd ~/ps
```

```bash
node scripts/seed.js
```

**Expected:** Output ending with:
```
[seed] done!
Tracks: 3
```

**If it says "Cannot find module"** → go back to STEP 7, make sure `cd backend && npm install` finished.

---

## STEP 9 — Run the smoke test

```bash
node scripts/smoke-test.js
```

**Expected:** 10 ✅ marks, ending with:
```
[test] 10 passed, 0 failed
```

**If any test fails** → copy the last 10 lines of output and tell me.

---

## STEP 10 — Start the backend

```bash
cd backend
```

```bash
node src/server.js
```

**Expected:**
```
╔════════════════════════════════════╗
║   PerStream backend · running      ║
║   http://localhost:3030             ║
║   mode: mock                        ║
╚════════════════════════════════════╝
```

**DO NOT CLOSE THIS TERMINAL.** The backend is now running.

---

## STEP 11 — Test in browser

On the SAME phone, open Chrome (or any browser). Type in the URL bar:

```
http://localhost:3000
```

Wait — port 3000, not 3030. (The smoke test used 3099, the default is 3000.) If you want to match STEP 10's port, just use whatever the screen said. Let me re-check — STEP 10 used the default port 3000 because I didn't set PORT.

Actually re-running STEP 10 — it should print `http://localhost:3000`. If not, look at what it printed and use that.

**Expected:** You see the PerStream landing page.

---

## STEP 12 — Stop the backend

Press `Ctrl + C` in Termux to stop the backend.

You'll see:
```
^C
[meter] shutting down, stopping all sessions...
$ 
```

---

## Done!

You've installed PerStream. Next steps (when ready):
1. Get a public URL via `cloudflared` tunnel (run `sh scripts/demo.sh`)
2. Record demo video
3. Submit to Lepton

---

## If ANY step fails

**Screenshot the EXACT line where it stops + the 5 lines BEFORE that line.** That's all I need.

Common ones I can fix in one message:
- "Permission denied" → missing chmod or wrong path
- "Cannot find module" → npm install didn't finish
- "EADDRINUSE" → another process using the port
- "gyp ERR!" → old bundle, re-download
- "no such file" → you might be in wrong directory, run `pwd`

---

## Cheat sheet — what's running where

| Where you are | What to type |
|---|---|
| Anywhere, want to start over | `cd ~ && rm -rf ps bundle.tar.gz && mkdir ps && cd ps && tar -xzf ~/bundle.tar.gz` |
| Want to restart the backend | `cd ~/ps/backend && node src/server.js` |
| Want to run the demo with public URL | `cd ~/ps && sh scripts/demo.sh` (requires cloudflared) |
| Want to seed again from scratch | `cd ~/ps && rm -rf backend/data/*.db* && node scripts/seed.js` |
| Want to run smoke test anytime | `cd ~/ps && node scripts/smoke-test.js` |