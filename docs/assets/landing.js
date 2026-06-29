/**
 * PerStream Landing Page — live ticker animation + dynamic stats + topbar
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
    // Update topbar on every page
    const txt = document.getElementById('topbar-text');
    if (txt) {
      txt.textContent = '🟡 Demo mode · loading live stats…';
    }
    const apiBase = (typeof window !== 'undefined' && window.PERSTREAM_API) || '';
    try {
      const r = await fetch(apiBase + '/api/audit/stats');
      if (!r.ok) throw new Error('not ok');
      const d = await r.json();
      if (txt) {
        if (d.mode === 'live') {
          txt.innerHTML = '🟢 LIVE on Arc testnet · <a href="https://testnet.arcscan.app/address/' + d.sellerAddress + '" target="_blank" rel="noopener">view seller on Arcscan ↗</a>';
        } else {
          txt.innerHTML = '🟡 Demo mode · <a href="LIVE_SETUP.html">Switch to live Arc testnet</a>';
        }
      }
      // Update stats if elements exist (landing page hero)
      const ticksEl = document.getElementById('stat-ticks');
      const paidEl = document.getElementById('stat-paid');
      const txEl = document.getElementById('stat-tx');
      const tracksEl = document.getElementById('stat-tracks');
      if (ticksEl) ticksEl.textContent = (d.totalTicks || 0).toLocaleString();
      if (paidEl) paidEl.textContent = '$' + (parseFloat(d.totalAmountUsd) || 0).toFixed(4);
      // Also fetch tx count and published track count
      try {
        const [txr, trk] = await Promise.all([
          fetch(apiBase + '/api/audit/ticks?limit=1000').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(apiBase + '/api/tracks').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (txEl && txr && Array.isArray(txr.ticks)) txEl.textContent = txr.ticks.length.toLocaleString();
        if (tracksEl && trk && Array.isArray(trk.tracks)) tracksEl.textContent = trk.tracks.length.toLocaleString();
      } catch {}
    } catch (e) {
      if (txt) txt.innerHTML = '🟡 Demo mode · <a href="LIVE_SETUP.html">Switch to live Arc testnet</a>';
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
