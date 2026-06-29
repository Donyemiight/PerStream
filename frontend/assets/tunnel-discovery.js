/**
 * Tunnel discovery — robust against any backend URL change.
 *
 * Strategy:
 *  1. Use window.PERSTREAM_API if set and reachable
 *  2. Probe known tunnel URLs in priority order
 *  3. Check localStorage for last-known-good
 *  4. Try same-origin (when served from the same Node.js backend)
 *  5. Try localhost:3000 (when running locally)
 *  6. Fall back to a "demo mode" that simulates the backend in-browser
 */
(function() {
  'use strict';
  
  // All tunnels we know about, newest first
  const KNOWN_TUNNELS = [
    'https://monica-ruby-educational-aurora.trycloudflare.com',
    'https://welfare-match-katrina-awesome.trycloudflare.com',
    'https://label-musicians-addition-armed.trycloudflare.com',
    'https://boundaries-participation-mail-pets.trycloudflare.com',
  ];
  
  const LOCAL_FALLBACKS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  
  // Get any tunnel URL from the page (set by the host HTML)
  const injectedUrl = (typeof window !== 'undefined' && window.PERSTREAM_API) || null;
  
  async function probe(baseUrl, timeoutMs = 2500) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fetch(baseUrl + '/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        const d = await r.json();
        if (d.ok) return baseUrl;
      }
    } catch {}
    return null;
  }
  
  async function discover() {
    const candidates = [];
    if (injectedUrl) candidates.push(injectedUrl);
    const lastKnown = (typeof localStorage !== 'undefined') ? localStorage.getItem('perstream_known_tunnel') : null;
    if (lastKnown && !candidates.includes(lastKnown)) candidates.push(lastKnown);
    candidates.push(...KNOWN_TUNNELS);
    // Same-origin check (when served from Node.js backend)
    if (typeof window !== 'undefined' && window.location) {
      candidates.push(window.location.origin);
    }
    candidates.push(...LOCAL_FALLBACKS);
    
    for (const url of candidates) {
      if (!url || url === 'null' || url === 'undefined') continue;
      const ok = await probe(url);
      if (ok) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('perstream_known_tunnel', ok);
        }
        if (typeof window !== 'undefined') {
          window.PERSTREAM_API = ok;
        }
        console.log('[tunnel-discovery] using', ok);
        return ok;
      }
    }
    // No backend found — return null so the caller can decide to use demo mode
    console.warn('[tunnel-discovery] no backend reachable');
    return null;
  }
  
  if (typeof window !== 'undefined') {
    window.discoverTunnel = discover;
  }
})();
