# 🚀 Push PerStream to GitHub — One-Block Termux Script

> **Read this once. Then paste. The PAT never enters chat.**

---

## Step 1 — On your computer (this sandbox)

The project is already bundled at `/workspace/deliverables/perstream.tar.gz` (40KB).

If you want a fresh bundle, run:
```bash
bash /workspace/perstream/scripts/bundle.sh
```
→ produces `/tmp/perstream.tar.gz`

---

## Step 2 — Get the file onto your phone

Any way that works for you:
- Upload to Google Drive / Dropbox → download on phone
- AirDrop equivalent (Android: Nearby Share)
- Email it to yourself as attachment
- USB cable + file transfer
- Telegram "saved messages" → save the file

**Goal:** the file `perstream.tar.gz` lands in your phone's `Downloads` folder.

---

## Step 3 — In Termux, paste this ENTIRE block

Open Termux, then paste this whole block:

```bash
# ─── Setup (one-time per Termux install) ───
pkg update -y && pkg install -y nodejs git tar

# ─── Find and extract the bundle ───
# Adjust the path if your file landed somewhere other than Downloads
find ~/storage -name 'perstream.tar.gz' 2>/dev/null | head -1 | xargs -I{} tar -xzf {} -C ~/

# If the above doesn't find it, try one of these:
# cd ~/storage/downloads && tar -xzf perstream.tar.gz -C ~/
# cd /sdcard/Download && tar -xzf perstream.tar.gz -C ~/

cd ~/PerStream

# ─── Push to GitHub ───
bash scripts/push-to-github.sh
```

**What happens next:**

1. The script initializes the git repo, sets your identity (donYemiight)
2. Stages all 29 files
3. Creates the commit
4. Runs `git push -u origin main`
5. **Termux will prompt you:**
   ```
   Username for 'https://github.com': Donyemiight
   Password for 'https://github.com': <paste your PAT here — input is hidden>
   ```
6. Paste the PAT (it'll be invisible — that's correct)
7. Press Enter
8. Push completes in 5-10 seconds
9. Visit https://github.com/Donyemiight/PerStream — all 29 files are live

---

## Step 4 — Verify

```bash
# From Termux after the push
open https://github.com/Donyemiight/PerStream
```

You should see:
- README.md rendering with the PerStream branding
- 29 files across `backend/`, `frontend/`, `contracts/`, `docs/`, `scripts/`, `deploy/`
- LICENSE (MIT)
- A clean commit message: "PerStream: per-second USDC streaming paywall on Arc"

---

## Step 5 — Make it look alive

After pushing, do these on the GitHub website:

1. **Add a description:** "Per-second USDC streaming paywall for podcasts, built on Circle Nanopayments + Arc. Every second, paid."
2. **Add topics:** `circle`, `arc`, `nanopayments`, `x402`, `creator-economy`, `usdc`, `hackathon`, `lepton`
3. **Pin a release** (optional, looks pro): Settings → Releases → Create → tag `v0.1.0` → title "PerStream v0.1.0 — Lepton Hackathon MVP"
4. **Enable Issues** (default) — shows you want feedback

---

## 🆘 If something breaks

### "Permission denied" on tar
```bash
cd ~ && tar -xzf /path/to/perstream.tar.gz
ls ~/PerStream  # should show backend/ frontend/ etc.
```

### "git: command not found"
```bash
pkg install git
```

### "Repository not found"
- Make sure https://github.com/Donyemiight/PerStream exists (you may need to create it empty on github.com first)
- Then re-run the push script

### "Authentication failed"
- Your PAT may have expired or been revoked
- Generate a new one at https://github.com/settings/tokens
- Paste it when Termux prompts

### "Nothing to commit"
- That's fine, means everything was already pushed
- Check `git log` to see existing commits

### Still stuck?
Run the smoke test to verify the project works locally:
```bash
cd ~/PerStream
cd backend && npm install && cd ..
node scripts/seed.js
node scripts/smoke-test.js
```

You should see: `10 passed, 0 failed`

---

## 🔐 PAT security — important

**The PAT you shared in chat is compromised.** Anyone who saw it can read/write to anything in your GitHub account.

**Do this AFTER pushing:**
1. Go to https://github.com/settings/tokens
2. Click on the token you used
3. Click "Delete" / "Revoke"
4. If you want a long-lived token for future work, create a NEW one with:
   - Resource owner: Donyemiight (just you)
   - Repository access: "Only select repositories" → choose `PerStream`
   - Permissions: Repository permissions → Contents → Read + Write
   - That's it. Nothing else.
5. Save the new PAT in a password manager, not in chat.

---

## ✅ Done checklist

After the push, you should have:

- [ ] GitHub repo at https://github.com/Donyemiight/PerStream with 29 files
- [ ] README rendering nicely
- [ ] LICENSE visible
- [ ] Topics set
- [ ] Description set
- [ ] Old PAT revoked

**Then move to Day 2:** run `./scripts/demo.sh` to get a public cloudflared URL → record your 2-min demo video → submit.

---

_This is the safest way to push without typing your PAT in chat. The token only ever enters Termux's hidden password prompt, never a file, never a chat message._