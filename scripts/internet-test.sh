#!/usr/bin/env bash
# PerStream — internet connectivity diagnostic
#
# Tells you EXACTLY what's wrong if Termux can't reach the bundle.

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   PerStream — connectivity test     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Test 1: DNS
echo "→ Test 1: DNS resolution"
echo -n "  github.com → "
if ping -c 1 -W 3 github.com >/dev/null 2>&1; then
  echo "✓ resolves ($(ping -c 1 github.com 2>&1 | grep -oE 'time=[0-9.]+' | head -1))"
else
  echo "✗ FAILED to ping"
  echo "  → Your network may block ICMP, this is OK if HTTPS works"
fi

# Test 2: HTTPS to GitHub
echo ""
echo "→ Test 2: HTTPS to github.com"
echo -n "  curl https://github.com ... "
RESULT=$(curl -sSL --max-time 10 -o /dev/null -w "%{http_code}" "https://github.com" 2>&1)
if [ "$RESULT" = "200" ] || [ "$RESULT" = "301" ] || [ "$RESULT" = "302" ]; then
  echo "✓ OK ($RESULT)"
else
  echo "✗ FAILED ($RESULT)"
fi

# Test 3: HTTPS to GitHub Releases (the actual asset URL)
echo ""
echo "→ Test 3: HTTPS to bundle URL"
URL="https://github.com/Donyemiight/PerStream/releases/download/v0.1.0-termux/perstream.tar.gz"
echo "  URL: $URL"
echo -n "  curl $URL ... "
RESULT=$(curl -sSL --max-time 30 -o /tmp/test-bundle.tar.gz -w "%{http_code} %{size_download}" "$URL" 2>&1)
echo "($RESULT)"

# Test 4: Try DNS-over-HTTPS if regular DNS fails
echo ""
echo "→ Test 4: Alternative endpoints"
for alt in "https://cloudflare.com" "https://google.com" "https://wikipedia.org"; do
  echo -n "  $alt ... "
  R=$(curl -sSL --max-time 5 -o /dev/null -w "%{http_code}" "$alt" 2>&1)
  if [ "$R" = "200" ] || [ "$R" = "301" ]; then
    echo "✓ OK"
  else
    echo "✗ ($R)"
  fi
done

echo ""
echo "→ Test 5: Check Termux network config"
echo "  Current network state:"
ifconfig 2>/dev/null | grep -E "inet |UP" | head -10 || ip addr show 2>/dev/null | grep "inet " | head -10
echo ""
echo "  DNS servers in /etc/resolv.conf:"
cat /etc/resolv.conf 2>/dev/null | grep nameserver | head -3

echo ""
echo "═══════════════════════════════════════════════"
echo "  Verdict"
echo "═══════════════════════════════════════════════"

# Summary
if curl -sSL --max-time 10 -o /dev/null -w "%{http_code}" "https://github.com" | grep -qE "200|301|302"; then
  echo "  ✓ GitHub is reachable"
  echo "  → The bootstrap script SHOULD work"
  echo "  → If it still fails, run it again — sometimes DNS takes a moment"
else
  echo "  ✗ GitHub is NOT reachable from this Termux"
  echo ""
  echo "  Possible fixes:"
  echo "    1. Toggle airplane mode, then off"
  echo "    2. Switch wifi ↔ mobile data"
  echo "    3. Some public wifi (hotels, cafes) block GitHub — try mobile data"
  echo "    4. Some ISPs in Nigeria block GitHub — use a VPN or mobile data"
  echo "    5. Try: pkg install -y dnsutils && ping github.com"
  echo ""
  echo "  Workaround — get the bundle another way:"
  echo "    A. On a computer with internet, download from:"
  echo "       https://github.com/Donyemiight/PerStream/releases/download/v0.1.0-termux/perstream.tar.gz"
  echo "    B. Email it to yourself, download attachment on phone"
  echo "    C. Upload to Google Drive, download on phone"
  echo "    D. In Termux: tar -xzf /path/to/perstream.tar.gz -C ~/"
  echo "       cd ~/PerStream && bash scripts/diagnose.sh"
fi

echo ""