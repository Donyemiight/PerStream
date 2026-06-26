# PerStream — Quick Start (Termux)

If `curl | bash` keeps failing, use this manual 3-step method.

## Step 1 — Save the bootstrap script to a file

Open Termux, then **type each line** (don't paste them all at once):

```bash
curl -o ~/bootstrap.sh https://raw.githubusercontent.com/Donyemiight/PerStream/master/scripts/bootstrap.sh
```

If `curl -o` also fails, try wget:

```bash
wget -O ~/bootstrap.sh https://raw.githubusercontent.com/Donyemiight/PerStream/master/scripts/bootstrap.sh
```

If both fail with "no such file" or "command not found", try:

```bash
pkg install -y curl wget
curl -o ~/bootstrap.sh https://raw.githubusercontent.com/Donyemiight/PerStream/master/scripts/bootstrap.sh
```

## Step 2 — Verify the file exists

```bash
ls -la ~/bootstrap.sh
```

You should see a file ~3.5KB. If it says "No such file", curl isn't working — try `ping github.com` to test connectivity.

## Step 3 — Run it

```bash
sh ~/bootstrap.sh
```

(Note: I'm using `sh` not `bash` — Termux sometimes has weirdness with bash. `sh` is always available.)

---

## What happens

The script will:
1. Check that `curl`, `nodejs`, `tar` are installed (installs if missing)
2. Download the 52KB bundle from GitHub
3. Extract to `~/PerStream`
4. Run `diagnose.sh` (installs deps, seeds, smoke-tests)

If anything fails, it prints exactly what's wrong.

---

## If STILL nothing works

Tell me **the EXACT line** you typed and **the EXACT error** (one screenshot works). Common cases:

| Error | Cause | Fix |
|---|---|---|
| `curl: command not found` | Termux missing curl | `pkg install -y curl` |
| `wget: command not found` | Termux missing wget | `pkg install -y wget` |
| `bootstrap.sh: not found` | curl saved to wrong dir | `ls -la ~` to find where it went |
| `Permission denied` on sh | File saved without execute | `sh ~/bootstrap.sh` (no chmod needed) |
| `bash: not found` | Termux didn't install bash | `pkg install -y bash` |
| `node: not found` | nodejs not installed | The script installs it automatically |
| `connection refused` | No internet | Toggle airplane mode |
| `SSL certificate problem` | Old ca-certificates | `pkg install -y ca-certificates` |

**Just paste the error and I'll fix it in one round-trip.**