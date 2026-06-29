/**
 * PerStream Demo Mode — simulated backend for the public preview
 *
 * Real backend uses Circle Nanopayments on Arc.
 * This file fakes the same API surface so the public landing page
 * (https://bjj5995jq178.space.minimax.io) is fully interactive.
 *
 * No external services called, no real money, no real auth.
 * Just enough to show what per-second paid listening feels like.
 */

(function() {
  'use strict';

  // Demo mode is opt-in. If the host has a real backend, the user can still
  // force demo mode by setting `?demo=1` in the URL, or by setting
  // `window.PERSTREAM_API_MODE = 'demo'` before this script loads.
  // Otherwise we leave window.PERSTREAM_API unset so app.js auto-detects
  // the real backend on the same host.
  const wantsDemo = window.PERSTREAM_API_MODE === 'demo'
    || new URLSearchParams(window.location.search).get('demo') === '1';

  // Heuristic: if the host is a known static preview (no backend), force demo mode
  const host = window.location.hostname;
  const isStaticPreview = host.endsWith('.space.minimax.io')
    || host.endsWith('.minimax.io')
    || host === 'localhost' && !window.location.port; // localhost without :3000

  if (wantsDemo || isStaticPreview) {
    window.PERSTREAM_API = 'demo';
    console.log('[demo-mode] enabled (simulated backend)');
    // Add a small visible indicator so user knows they're in demo mode
    window.addEventListener('DOMContentLoaded', () => {
      const badge = document.createElement('div');
      badge.textContent = '⚡ DEMO MODE (no live backend)';
      badge.style.cssText = 'position:fixed; bottom:12px; left:12px; background:#fbbf24; color:#0a0a0f; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:700; z-index:9998; font-family:system-ui; box-shadow:0 2px 8px rgba(0,0,0,0.3); cursor:pointer;';
      badge.title = 'Click to switch to LIVE mode';
      badge.onclick = () => { window.location.href = 'https://seas-ing-served-amy.trycloudflare.com' + window.location.pathname; };
      document.body.appendChild(badge);
    });
  } else {
    // Real backend detected — don't intercept fetch, just exit
    console.log('[demo-mode] disabled (real backend on ' + host + ')');
    return;
  }

  const DEMO_USERS = [
    { id: 'demo-creator', handle: 'perstream-demo', email: 'demo-creator@perstream.fm', wallet: '0x9b198314420ffc0f7a5e4895a2cfcc12d0b53493', role: 'creator' },
    { id: 'demo-listener', handle: 'demo-listener', email: 'demo-listener@perstream.fm', wallet: '0xe6737b1cb6cdbc484fd11d658e664835a7673e46', role: 'listener' },
  ];

  const DEMO_TRACKS = [
    { id: 'trk-podcast', creator_id: 'demo-creator', title: 'Ep. 1: The Cold-Start Cliff — why per-second beats subscriptions', description: 'A full 4-minute 16-second podcast episode. How subscription media kills 90% of new shows, and how a per-second model flips the economics. Press play and let the meter run.', audioUrl: 'assets/podcast-full.mp3', duration_sec: 256, price_per_sec: 100, plays: 89, earnings_total: 2278400 },
    { id: 'trk-welcome', creator_id: 'demo-creator', title: 'PerStream Theme — 26-second welcome', description: 'A short welcome message. Use this to feel the per-second tick without committing time.', audioUrl: 'assets/welcome.mp3', duration_sec: 26, price_per_sec: 300, plays: 142, earnings_total: 4260000 },
    { id: 'trk-pitch', creator_id: 'demo-creator', title: 'Pitch: why pay per second?', description: 'A 25-second pitch explaining why your balance should only tick while audio plays.', audioUrl: 'assets/pitch.mp3', duration_sec: 25, price_per_sec: 500, plays: 89, earnings_total: 8910000 },
    { id: 'trk-loop', creator_id: 'demo-creator', title: 'Demo Loop — 17-second spoken test track', description: 'Press play, watch the meter tick, pause to stop. The whole point of PerStream in 17 seconds.', audioUrl: 'assets/loop.mp3', duration_sec: 17, price_per_sec: 100, plays: 256, earnings_total: 1280000 },
  ];

  const state = {
    currentUser: null,
    balance: 0,                    // listener's USDC deposit (micro-USDC)
    creatorEarnings: 0,            // creator's accumulated earnings (micro-USDC)
    activeSession: null,
    meterInterval: null,
    listenerInterval: null,
    feedback: [],                   // user ratings + comments (in-memory only)
    leads: [],                     // early-access signups
    tickLedger: [],                // per-second payment audit trail (in-memory)
    txCounter: 0,                  // for mock tx hash generation
  };

  function usd(amount) { return (amount || 0) / 1_000_000; }
  function micro(amount) { return Math.floor((amount || 0) * 1_000_000); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ──────────────────────────────────────────────
  // Route handler — used by both fetch and XHR interceptors
  // ──────────────────────────────────────────────
  function handleApiRequest(method, rawPath, rawBody) {
    // Parse body (JSON or urlencoded; multipart handled by query string fallback)
    let body = {};
    if (rawBody && typeof rawBody === 'string') {
      try { body = JSON.parse(rawBody); } catch (e) { body = {}; }
    } else if (rawBody && typeof rawBody === 'object' && !(rawBody instanceof FormData)) {
      body = rawBody;
    }
    // Extract query string from path
    let path = rawPath;
    let queryString = '';
    if (rawPath.includes('?')) {
      const qIdx = rawPath.indexOf('?');
      queryString = rawPath.slice(qIdx + 1);
      path = rawPath.slice(0, qIdx);
    }
    const qs = new URLSearchParams(queryString);


    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      const email = body.email || '';
      const user = DEMO_USERS.find(u => u.email === email) || DEMO_USERS[1];
      state.currentUser = { ...user };
      return { body: { user: state.currentUser, wallet: { address: user.wallet, mode: 'demo' } } };;
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      return { body: { user: state.currentUser } };;
    }

    // GET /api/tracks
    if (method === 'GET' && path === '/api/tracks') {
      return { body: { tracks: DEMO_TRACKS } };;
    }

    // GET /api/tracks/:id
    if (method === 'GET' && path.match(/^\/api\/tracks\/[^/]+$/)) {
      const id = path.split('/').pop();
      const track = DEMO_TRACKS.find(t => t.id === id);
      if (!track) return { body: { error: 'not_found' }, status: 404 };;
      const creator = DEMO_USERS.find(u => u.id === track.creator_id);
      return { body: { track: { ...track, creator } } };;
    }

    // GET /api/tracks/:id/stream
    if (method === 'GET' && path.match(/^\/api\/tracks\/[^/]+\/stream$/)) {
      const id = path.split('/')[3];
      const track = DEMO_TRACKS.find(t => t.id === id);
      if (!track) return { body: { error: 'not_found' }, status: 404 };;
      // Simulate x402: if no balance, return 402
      if (state.balance < track.price_per_sec) {
        return {
        status: 402,
        body: {
          error: 'payment_required',
          pricePerSec: track.price_per_sec,
          pricePerSecUsd: usd(track.price_per_sec),
          creator: track.creator_id,
          trackId: track.id,
        },
        headers: {
          'X-PerStream-Price': String(track.price_per_sec),
          'X-PerStream-Price-Usd': String(usd(track.price_per_sec)),
          'X-PerStream-Creator': track.creator_id,
          'X-PerStream-Track-Id': track.id,
        },
      };
      }
      return { body: {
        ok: true,
        trackId: track.id,
        audioUrl: track.audioUrl || 'assets/loop.mp3',  // real demo audio
        pricePerSec: track.price_per_sec,
        durationSec: track.duration_sec,
        balanceMicroUsdc: state.balance,
      } };;
    }

    // POST /api/listen/deposit
    if (method === 'POST' && path === '/api/listen/deposit') {
      const amount = micro(parseFloat(body.amountUsd || 0));
      state.balance += amount;
      return { body: { ok: true, balance: state.balance } };;
    }

    // POST /api/listen/start
    if (method === 'POST' && path === '/api/listen/start') {
      const track = DEMO_TRACKS.find(t => t.id === body.trackId);
      if (!track) return { body: { error: 'not_found' }, status: 404 };;
      state.activeSession = {
        sessionId: 'demo-' + Date.now(),
        trackId: track.id,
        pricePerSec: track.price_per_sec,
        secondsPlayed: 0,
        amountPaid: 0,
      };
      startMeter(track);
      return { body: {
        sessionId: state.activeSession.sessionId,
        trackId: track.id,
        pricePerSec: track.price_per_sec,
        pricePerSecUsd: usd(track.price_per_sec),
      } };;
    }

    // POST /api/listen/stop
    if (method === 'POST' && path === '/api/listen/stop') {
      stopMeter();
      return { body: {
        session: state.activeSession,
        totalPaidUsd: usd(state.activeSession?.amountPaid || 0),
      } };;
    }

    // GET /api/listen/poll
    if (method === 'GET' && path.startsWith('/api/listen/poll')) {
      return { body: {
        tick: !!state.activeSession,
        secondsPlayed: state.activeSession?.secondsPlayed || 0,
        amountPaid: state.activeSession?.amountPaid || 0,
        balance: state.balance,
      } };;
    }

    // GET /api/creator/dashboard
    // POST /api/creator/tracks — create track
    if (method === 'POST' && path === '/api/creator/tracks') {
      const newTrack = {
        id: 'trk_demo_' + Date.now(),
        creator_id: state.currentUser ? state.currentUser.id : 'demo-creator',
        title: body.title || 'New Track',
        description: body.description || '',
        audio_url: body.audioUrl || '/assets/loop.mp3',
        duration_sec: parseInt(body.durationSec, 10) || 60,
        price_per_sec: parseInt(body.pricePerSec, 10) || 100,
        cover_url: body.coverUrl || '',
        category: body.category || 'general',
        status: body.status || 'published',
        created_at: Date.now(),
        plays: 0,
        earnings_total: 0,
      };
      DEMO_TRACKS.unshift(newTrack);
      return { body: { track: newTrack } };;
    }
    // PUT /api/creator/tracks/:id — update track
    if (method === 'PUT' && path.match(/^\/api\/creator\/tracks\/[^/]+$/)) {
      const id = path.split('/').pop();
      const t = DEMO_TRACKS.find(x => x.id === id);
      if (!t) return { body: { error: 'not_found' }, status: 404 };;
      Object.assign(t, body);
      return { body: { track: t } };;
    }
    // DELETE /api/creator/tracks/:id — delete track
    if (method === 'DELETE' && path.match(/^\/api\/creator\/tracks\/[^/]+$/)) {
      const id = path.split('/').pop();
      const idx = DEMO_TRACKS.findIndex(x => x.id === id);
      if (idx === -1) return { body: { error: 'not_found' }, status: 404 };;
      DEMO_TRACKS.splice(idx, 1);
      return { body: { ok: true } };;
    }
    // POST /api/creator/tracks/:id/status — publish/unpublish
    if (method === 'POST' && path.match(/^\/api\/creator\/tracks\/[^/]+\/status$/)) {
      const id = path.split('/')[4];
      const t = DEMO_TRACKS.find(x => x.id === id);
      if (!t) return { body: { error: 'not_found' }, status: 404 };;
      t.status = body.status || 'published';
      return { body: { track: t } };;
    }
    // GET /api/creator/profile
    if (method === 'GET' && path === '/api/creator/profile') {
      return { body: { profile: { id: 'demo', handle: 'demo', display_name: 'Demo Creator', bio: 'Demo mode', avatar_url: '', social_links: {} } } };;
    }
    // PUT /api/creator/profile
    if (method === 'PUT' && path === '/api/creator/profile') {
      return { body: { profile: { id: 'demo', handle: 'demo', ...body } } };;
    }
    // GET /api/creator/notifications
    if (method === 'GET' && path === '/api/creator/notifications') {
      return { body: { notifications: state.notifications || [], unreadCount: 0 } };;
    }
    // POST /api/creator/notifications/:id/read
    if (method === 'POST' && path.match(/^\/api\/creator\/notifications\/[^/]+\/read$/)) {
      return { body: { ok: true } };;
    }
    // GET /api/creator/withdrawals
    if (method === 'GET' && path === '/api/creator/withdrawals') {
      return { body: { withdrawals: state.withdrawals || [] } };;
    }
    if (method === 'GET' && path === '/api/creator/dashboard') {
      return { body: {
        creator: state.currentUser,
        earningsLive: usd(state.creatorEarnings),
        earningsRecorded: usd(state.creatorEarnings),
        tracks: DEMO_TRACKS,
        feedback: {
          total: state.feedback.length,
          average: state.feedback.length
            ? Math.round(state.feedback.reduce((s, f) => s + f.rating, 0) / state.feedback.length * 10) / 10
            : 0,
          recent: state.feedback.slice(-10).reverse(),
        },
        leads: { count: state.leads.length },
      } };;
    }

    // POST /api/feedback
    if (method === 'POST' && path === '/api/feedback') {
      const rating = parseInt(body.rating, 10);
      if (!rating || rating < 1 || rating > 5) {
        return { body: { error: 'rating must be 1-5' }, status: 400 };;
      }
      const entry = {
        id: state.feedback.length + 1,
        user_email: body.userEmail || null,
        user_handle: body.userHandle || null,
        track_id: body.trackId || null,
        rating,
        comment: String(body.comment || '').slice(0, 2000),
        page: body.page || '',
        created_at: Date.now(),
      };
      state.feedback.push(entry);
      return { body: { ok: true, id: entry.id } };;
    }

    // GET /api/feedback/stats
    if (method === 'GET' && path === '/api/feedback/stats') {
      const total = state.feedback.length;
      const avg = total ? Math.round(state.feedback.reduce((s, f) => s + f.rating, 0) / total * 10) / 10 : 0;
      const distribution = {};
      for (let i = 1; i <= 5; i++) distribution[i] = state.feedback.filter(f => f.rating === i).length;
      return { body: { total, average: avg, distribution, recent: state.feedback.slice(-10).reverse() } };;
    }

    // GET /api/feedback
    if (method === 'GET' && path === '/api/feedback') {
      return { body: { feedback: state.feedback.slice(-parseInt(qs.get('limit') || '50', 10)).reverse() } };;
    }

    // POST /api/lead
    if (method === 'POST' && path === '/api/lead') {
      if (!body.email || !body.email.includes('@')) {
        return { body: { error: 'valid email required' }, status: 400 };;
      }
      const lead = {
        id: state.leads.length + 1,
        email: body.email.toLowerCase().trim(),
        role: body.role || null,
        useCase: body.useCase || null,
        source: body.source || null,
        created_at: Date.now(),
      };
      state.leads.push(lead);
      return { body: { ok: true } };;
    }

    // GET /api/lead/count
    if (method === 'GET' && path === '/api/lead/count') {
      return { body: { count: state.leads.length } };;
    }

    // GET /api/audit/ticks
    if (method === 'GET' && path.startsWith('/api/audit/ticks')) {
      const limit = Math.min(parseInt((path.split('?')[1] || '').match(/limit=(\d+)/)?.[1] || '50', 10), 500);
      const ticks = state.tickLedger.slice(-limit).reverse();
      const totalMicro = state.tickLedger.reduce((sum, e) => sum + (e.amountMicro || 0), 0);
      const stats = {
        totalTicks: state.tickLedger.length,
        totalAmountMicro: totalMicro,
        totalAmountUsd: totalMicro / 1_000_000,
        uniqueListeners: new Set(state.tickLedger.map(e => e.listener)).size,
        uniqueCreators: new Set(state.tickLedger.map(e => e.creator)).size,
        oldestTick: state.tickLedger.length > 0 ? state.tickLedger[0].ts : null,
        newestTick: state.tickLedger.length > 0 ? state.tickLedger[state.tickLedger.length - 1].ts : null,
      };
      return { body: { mode: 'mock', stats, ticks } };;
    }

    // GET /api/audit/stats
    if (method === 'GET' && path === '/api/audit/stats') {
      const totalMicro = state.tickLedger.reduce((sum, e) => sum + (e.amountMicro || 0), 0);
      return { body: {
        mode: 'mock',
        sellerAddress: '0xe6737b1cb6cdbc484fd11d658e664835a7673e46',
        arcscanBaseUrl: 'https://testnet.arcscan.app',
        totalTicks: state.tickLedger.length,
        totalAmountMicro: totalMicro,
        totalAmountUsd: totalMicro / 1_000_000,
        uniqueListeners: new Set(state.tickLedger.map(e => e.listener)).size,
        uniqueCreators: new Set(state.tickLedger.map(e => e.creator)).size,
        oldestTick: state.tickLedger.length > 0 ? state.tickLedger[0].ts : null,
        newestTick: state.tickLedger.length > 0 ? state.tickLedger[state.tickLedger.length - 1].ts : null,
      } };;
    }

    // Default 200
    return { body: { error: 'not_handled', method, path } };
  }

  // ──────────────────────────────────────────────
  // Response helper
  // ──────────────────────────────────────────────
  function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  // ──────────────────────────────────────────────
  // Override fetch
  // ──────────────────────────────────────────────
  const realFetch = window.fetch.bind(window);
  window.fetch = async function(url, opts = {}) {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (!urlStr.includes('/api/')) return realFetch(url, opts);
    const path = urlStr.replace(/^https?:\/\/[^/]+/, '').replace(/^demo/, '');
    const method = (opts.method || 'GET').toUpperCase();
    const result = handleApiRequest(method, path, opts.body);
    return json(result.body, result.status, result.headers);
  };

  // ──────────────────────────────────────────────
  // Override XMLHttpRequest — needed for multipart uploads
  // ──────────────────────────────────────────────
  const RealXHR = window.XMLHttpRequest;
  function FakeXHR() {
    const xhr = new RealXHR();
    let _method, _url, _body;
    const origOpen = xhr.open.bind(xhr);
    xhr.open = function(method, url) {
      _method = method;
      _url = url;
      return origOpen(method, url);
    };
    const origSend = xhr.send.bind(xhr);
    xhr.send = function(body) {
      _body = body;
      const urlStr = String(_url);
      if (!urlStr.includes('/api/')) return origSend(body);
      const path = urlStr.replace(/^https?:\/\/[^/]+/, '').replace(/^demo/, '');
      const result = handleApiRequest((_method || 'GET').toUpperCase(), path, body);
      const headers = result.headers || {};
      Object.defineProperty(xhr, 'status', { value: result.status || 200, configurable: true });
      Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(result.body), configurable: true });
      Object.defineProperty(xhr, 'response', { value: JSON.stringify(result.body), configurable: true });
      Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
      xhr.getResponseHeader = function(name) {
        if (headers[name]) return headers[name];
        if (headers[name.toLowerCase()]) return headers[name.toLowerCase()];
        return null;
      };
      xhr.getAllResponseHeaders = function() {
        let h = '';
        for (const k of Object.keys(headers)) h += k + ': ' + headers[k] + '\r\n';
        return h;
      };
      setTimeout(() => {
        if (xhr.onload) xhr.onload();
        if (xhr.onreadystatechange) xhr.onreadystatechange();
      }, 0);
    };
    return xhr;
  }
  FakeXHR.prototype = RealXHR.prototype;
  window.XMLHttpRequest = FakeXHR;
})();
