/**
 * Tunnel discovery — when the deployed tunnel URL changes (sandbox restart),
 * the frontend can probe known-good URLs and switch automatically.
 */
(function() {
  'use strict';
  
  const KNOWN_TUNNELS = [
    'https://welfare-match-katrina-awesome.trycloudflare.com',
    'https://label-musicians-addition-armed.trycloudflare.com',
    'https://boundaries-participation-mail-pets.trycloudflare.com',
  ];
  
  async function probe(baseUrl) {
    try {
      const r = await fetch(baseUrl + '/api/health', { method: 'GET', cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        return d.ok;
      }
    } catch {}
    return false;
  }
  
  async function discover() {
    // 1) Use the configured PERSTREAM_API first
    if (window.PERSTREAM_API) {
      const ok = await probe(window.PERSTREAM_API);
      if (ok) return window.PERSTREAM_API;
      console.warn('[tunnel-discovery] configured URL failed:', window.PERSTREAM_API);
    }
    
    // 2) Try last-known good tunnel from localStorage
    const lastKnown = localStorage.getItem('perstream_known_tunnel');
    if (lastKnown) {
      const ok = await probe(lastKnown);
      if (ok) {
        console.log('[tunnel-discovery] recovered via last-known tunnel:', lastKnown);
        return lastKnown;
      }
    }
    
    // 3) Probe known tunnels
    for (const url of KNOWN_TUNNELS) {
      const ok = await probe(url);
      if (ok) {
        console.log('[tunnel-discovery] found working tunnel:', url);
        return url;
      }
    }
    
    // 4) Last resort — return same-origin
    return window.location.origin;
  }
  
  // Run discovery on load if PERSTREAM_API is set or fails
  if (typeof window !== 'undefined') {
    window.discoverTunnel = discover;
    
    // Auto-recover: if PERSTREAM_API fails for any request, re-discover
    window.addEventListener('perstream:tunnel-broken', async (e) => {
      console.warn('[tunnel-discovery] tunnel-broken event — re-discovering');
      const newUrl = await discover();
      if (newUrl !== window.PERSTREAM_API) {
        window.PERSTREAM_API = newUrl;
        localStorage.setItem('perstream_known_tunnel', newUrl);
        // Reload to apply
        location.reload();
      }
    });
  }
})();
