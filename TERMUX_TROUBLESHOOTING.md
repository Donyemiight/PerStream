# PerStream — Termux Troubleshooting

> _Common errors + their fixes, gathered from real Termux runs._

---

## Error 1: `gyp ERR! find Python` / `better-sqlite3` build fails

```
npm error gyp ERR! find Python
npm error gyp ERR! stack Error: `gyp` failed with exit code: 1
```

**Cause:** `better-sqlite3` is a native module that requires Python + NDK + node-gyp. Termux doesn't have them by default.

**Fix:** PerStream now uses `sql.js` (pure JavaScript SQLite, no native build). If you somehow still get this error, run:

```bash
cd backend
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --omit=optional
```

The `--omit=optional` flag skips any deps that try to compile.

---

## Error 2: `ERR_AMBIGUOUS_MODULE_SYNTAX` on Node v24

```
ReferenceError: Cannot determine intended module format
because both 'require' and top-level await are present.
```

**Cause:** Node v24's ESM loader is stricter about mixing CommonJS `require()` with top-level `await`.

**Fix:** PerStream's seed.js now wraps all logic in an `async function main()`. If you have your own scripts that mix the two, wrap them similarly:

```js
// ❌ breaks on Node v24
const dep = require('dep');
const data = await fetchData();

// ✅ works
async function main() {
  const dep = require('dep');
  const data = await fetchData();
}
main();
```

---

## Error 3: `Cannot find module 'dotenv'` when running seed.js

**Cause:** `seed.js` lives in `scripts/` but `node_modules/` is in `backend/`. Node doesn't search there.

**Fix:** Already handled — `seed.js` now adds `backend/node_modules` to its search paths:

```js
require.main.paths.unshift(path.join(__dirname, '..', 'backend', 'node_modules'));
```

If you still hit it, your `node_modules` is corrupt. Delete and reinstall:

```bash
cd backend
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --omit=optional
```

---

## Error 4: `Error: UNIQUE constraint failed: users.wallet`

**Cause:** Two demo users got the same wallet (only happens if `wallet.provisionWallet()` is called without `await`).

**Fix:** Already patched — `seed.js` uses `await wallet.provisionWallet(...)`.

If you see this in your own code, just `await` the function call.

---

## Error 5: `EADDRINUSE` when starting backend

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause:** Another process (or a previous backend run) is using port 3000.

**Fix:**
```bash
# Find and kill the process
lsof -i :3000   # or: netstat -tlnp | grep 3000
kill <PID>

# Or just use a different port
PORT=3001 node src/server.js
```

---

## Error 6: `Cannot find module '../backend/src/db'` after extracting tarball

**Cause:** Tarball didn't extract properly, or you're running from the wrong directory.

**Fix:**
```bash
cd ~/PerStream   # not ~/perstream or ~/Downloads/PerStream
ls backend/      # should show src/, node_modules/, package.json
```

---

## Error 7: `better-sqlite3` shows up in `package.json` after upgrade

**Cause:** Old bundle from before the fix.

**Fix:** Re-download the latest bundle (it should be 44KB, not 40KB). The current bundle has sql.js, not better-sqlite3.

```bash
cd backend
grep -i better-sqlite3 package.json   # should return nothing
grep -i sql.js package.json           # should return sql.js
```

---

## Error 8: `Cannot find module 'multer'` / similar at runtime

**Cause:** `npm install` was killed mid-run.

**Fix:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --omit=optional
# If it fails on multer specifically, install just that:
npm install multer
```

---

## General debugging recipe

```bash
# 1. Verify the bundle
ls -la perstream.tar.gz    # should be ~44KB
mkdir perstream-test && tar -xzf perstream.tar.gz -C perstream-test
ls perstream-test/

# 2. Install fresh
cd perstream-test/backend
npm install --no-audit --no-fund --omit=optional

# 3. Seed
cd ..
node scripts/seed.js

# 4. Smoke test
node scripts/smoke-test.js
# Expected output: 10 passed, 0 failed

# 5. Start backend
cd backend && node src/server.js
# Expected output: ║   PerStream backend · running      ║
```

If step 4 prints `10 passed, 0 failed`, your install is healthy. Anything less, scroll up in the terminal output for the actual error.

---

## Still stuck?

1. Run `node scripts/smoke-test.js` and paste the output
2. Run `cd backend && node src/server.js` and paste the output
3. Tell me the exact error line

I'll be able to fix it in one round-trip.