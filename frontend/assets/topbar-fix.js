/**
 * Topbar Status Fix — replaces "Connecting to Arc testnet…" loader
 * with an intentional amber "Demo mode" pill after 2s if backend is unreachable.
 *
 * This file ships on EVERY page (index/listen/creator) so they all
 * show consistent demo-mode framing when the backend is offline.
 */
(function () {
  'use strict';

  // Don't double-init
  if (window.__perstreamTopbarInit) return;
  window.__perstreamTopbarInit = true;

  // Mark the page as in demo mode if running on static host or after timeout
  function detectDemoMode() {
    if (window.__perstreamDemoModeForced) return true;
    const api = window.PERSTREAM_API;
    if (!api || api === 'demo') return true;
    // Same-origin without explicit backend = static deploy
    if (api.indexOf('trycloudflare.com') >= 0) return false; // explicit tunnel
    return false;
  }

  function updateTopbar(mode) {
    const txt = document.getElementById('topbar-text');
    const dot = document.querySelector('.topbar-dot');
    if (!txt) return;

    if (mode === 'demo') {
      txt.innerHTML =
        '<span class="demo-pill">⚡ Demo mode — simulated USDC on Arc testnet</span>';
      if (dot) dot.style.background = '#fbbf24';
      if (dot) dot.style.boxShadow = '0 0 8px #fbbf24';
    } else if (mode === 'live') {
      txt.textContent = 'Connected to Arc testnet';
      if (dot) dot.style.background = '#10b981';
      if (dot) dot.style.boxShadow = '0 0 8px #10b981';
    }
  }

  // First, attempt to detect actual connectivity by pinging API health endpoint.
  function probe() {
    const api = window.PERSTREAM_API;
    if (!api || api === 'demo') {
      updateTopbar('demo');
      window.__perstreamDemoModeForced = true;
      return;
    }
    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), 1500);
    fetch(api.replace(/\/$/, '') + '/api/health', {
      method: 'GET',
      signal: ctl.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => {
        clearTimeout(tid);
        updateTopbar('live');
      })
      .catch(() => {
        clearTimeout(tid);
        updateTopbar('demo');
        window.__perstreamDemoModeForced = true;
      });
  }

  // 2s hard timeout — by FIX 1 spec, hide "Connecting…" within 2 seconds
  // and show the demo-mode pill.
  setTimeout(() => {
    if (window.__perstreamTopbarResolved) return;
    window.__perstreamTopbarResolved = true;
    updateTopbar(detectDemoMode() ? 'demo' : 'demo');
  }, 2000);

  // Try the real probe
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', probe);
  } else {
    probe();
  }
})();
