/**
 * PerStream Landing Page — live ticker animation + dynamic stats
 *
 * The hero section has a live ticking meter that animates in real-time
 * even on static (demo mode) deploys. This is what makes the landing
 * page look alive instead of static screenshots.
 */
(function() {
  'use strict';

  function startTicker() {
    const amountEl = document.getElementById('ticker-amount');
    const tickEl = document.getElementById('ticker-tick');
    const balanceEl = document.getElementById('ticker-balance');
    const barEl = document.getElementById('ticker-bar');
    if (!amountEl) return;

    let amount = 0.0638;
    let tick = 213;
    let balance = 4.94;

    setInterval(() => {
      amount += 0.0001;
      tick += 1;
      balance = Math.max(0, balance - 0.0001);
      if (amountEl) amountEl.textContent = amount.toFixed(4) + ' USDC';
      if (tickEl) tickEl.textContent = tick;
      if (balanceEl) balanceEl.textContent = '$' + balance.toFixed(4);
      if (barEl) barEl.style.width = Math.min(100, (amount / 5) * 100) + '%';
    }, 1000);
  }

  async function fetchLiveStats() {
    try {
      const r = await fetch('api/audit/stats');
      if (!r.ok) return;
      const d = await r.json();
      const txt = document.getElementById('topbar-text');
      const ticksEl = document.getElementById('stat-ticks');
      const paidEl = document.getElementById('stat-paid');
      if (d.mode === 'live') {
        if (txt) txt.innerHTML = '🟢 LIVE on Arc testnet · <a href="https://testnet.arcscan.app/address/' + d.sellerAddress + '" target="_blank" rel="noopener">view seller on Arcscan ↗</a>';
        if (ticksEl) ticksEl.textContent = d.totalTicks || '0';
        if (paidEl) paidEl.textContent = '$' + parseFloat(d.totalAmountUsd || 0).toFixed(4);
      } else {
        if (txt) txt.innerHTML = '🟡 Demo mode · <a href="LIVE_SETUP.html">Switch to live Arc testnet</a>';
      }
    } catch (e) {
      // silent — demo mode
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startTicker();
      fetchLiveStats();
    });
  } else {
    startTicker();
    fetchLiveStats();
  }
})();
