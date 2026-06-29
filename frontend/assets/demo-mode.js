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

  // Track catalog — SINGLE SOURCE OF TRUTH shared by index.html (static), listen.html,
  // creator.html, and any demo-mode API responses. TITLES + PRICES + PLAY COUNTS must be IDENTICAL across pages.
  const SEED_TRACKS = [
    { id: 'trk-podcast', creator_id: 'demo-creator', title: 'Cold-Start Cliff — full episode', description: "The story behind how Circle's Arc testnet hit 1M txns in a week.", audioUrl: 'assets/podcast-full.mp3', duration_sec: 256, price_per_sec: 100, plays: 261, earnings_total: 6681600 },
    { id: 'trk-welcome', creator_id: 'demo-creator', title: 'PerStream Theme — welcome', description: 'A 26-second welcome message. Shortest possible listen.', audioUrl: 'assets/welcome.mp3', duration_sec: 26, price_per_sec: 300, plays: 142, earnings_total: 1107600 },
    { id: 'trk-pitch', creator_id: 'demo-creator', title: 'Pitch: why pay per second?', description: 'Why your balance should only tick while audio plays.', audioUrl: 'assets/pitch.mp3', duration_sec: 25, price_per_sec: 500, plays: 89, earnings_total: 1112500 },
    { id: 'trk-loop', creator_id: 'demo-creator', title: 'Demo Loop — spoken test', description: 'The whole point of PerStream in 17 seconds.', audioUrl: 'assets/loop.mp3', duration_sec: 17, price_per_sec: 100, plays: 256, earnings_total: 435200 },
  ];
  // Expose to other scripts so static HTML can mirror EXACT same data
  window.PERSTREAM_DEMO_TRACKS = SEED_TRACKS;

  // Persistence helpers — uploaded tracks + withdrawals survive page refresh
  const STORAGE_KEY = 'perstream_demo_state';
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tracks: DEMO_TRACKS,
        creatorEarnings: state.creatorEarnings,
        creatorWithdrawn: state.creatorWithdrawn,
        withdrawals: state.withdrawals,
        feedback: state.feedback,
        leads: state.leads,
        tickLedger: state.tickLedger.slice(-500),  // last 500 ticks
        txCounter: state.txCounter,
      }));
    } catch (e) {}
  }
  // Reset to fresh seed state
  function resetState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  }
  // Initialize DEMO_TRACKS — restore from localStorage if available, else seed
  const stored = loadState();
  const DEMO_TRACKS = (stored && stored.tracks) ? stored.tracks : SEED_TRACKS.slice();

  const state = {
    currentUser: null,
    balance: 0,                    // listener's USDC deposit (micro-USDC)
    creatorEarnings: (stored && stored.creatorEarnings) || 0,  // creator's accumulated earnings (micro-USDC)
    creatorWithdrawn: (stored && stored.creatorWithdrawn) || 0, // cumulative withdrawn (micro-USDC)
    activeSession: null,
    meterInterval: null,
    listenerInterval: null,
    feedback: (stored && stored.feedback) || [],  // user ratings + comments
    leads: (stored && stored.leads) || [],         // early-access signups
    tickLedger: (stored && stored.tickLedger) || [], // per-second payment audit trail
    txCounter: (stored && stored.txCounter) || 0,  // mock tx hash counter
    notifications: [],
    withdrawals: (stored && stored.withdrawals) || [],  // withdrawal history
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
      // Also handle url-encoded form data: "title=Foo&pricePerSec=200"
      if (Object.keys(body).length === 0 && rawBody.includes('=')) {
        try {
          const params = new URLSearchParams(rawBody);
          for (const [k, v] of params.entries()) body[k] = v;
        } catch (e) { /* ignore */ }
      }
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

    // GET /api/tracks — public listing, only published tracks (drafts hidden)
    if (method === 'GET' && path === '/api/tracks') {
      const publishedTracks = DEMO_TRACKS.filter(t => !t.status || t.status === 'published');
      return { body: { tracks: publishedTracks } };;
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
      saveState();
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
      const session = state.activeSession;
      stopMeter();
      state.activeSession = null;
      return { body: {
        session,
        totalPaidUsd: usd(session?.amountPaid || 0),
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
        status: qs.get('status') || body.status || 'published',
        created_at: Date.now(),
        plays: 0,
        earnings_total: 0,
      };
      DEMO_TRACKS.unshift(newTrack);
      saveState();
      return { body: { track: newTrack } };;
    }
    // PUT /api/creator/tracks/:id — update track
    if (method === 'PUT' && path.match(/^\/api\/creator\/tracks\/[^/]+$/)) {
      const id = path.split('/').pop();
      const t = DEMO_TRACKS.find(x => x.id === id);
      if (!t) return { body: { error: 'not_found' }, status: 404 };;
      Object.assign(t, body);
      saveState();
      return { body: { track: t } };;
    }
    // DELETE /api/creator/tracks/:id — delete track
    if (method === 'DELETE' && path.match(/^\/api\/creator\/tracks\/[^/]+$/)) {
      const id = path.split('/').pop();
      const idx = DEMO_TRACKS.findIndex(x => x.id === id);
      if (idx === -1) return { body: { error: 'not_found' }, status: 404 };;
      DEMO_TRACKS.splice(idx, 1);
      saveState();
      return { body: { ok: true } };;
    }
    // POST /api/creator/tracks/:id/status — publish/unpublish
    if (method === 'POST' && path.match(/^\/api\/creator\/tracks\/[^/]+\/status$/)) {
      const id = path.split('/')[4];
      const t = DEMO_TRACKS.find(x => x.id === id);
      if (!t) return { body: { error: 'not_found' }, status: 404 };;
      t.status = body.status || 'published';
      saveState();
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

    // POST /api/creator/withdraw — withdraw available earnings
    if (method === 'POST' && path === '/api/creator/withdraw') {
      const requested = parseFloat(body.amountUsd || 0);
      const available = usd(state.creatorEarnings);
      const amount = Math.min(requested, available);
      if (amount <= 0) {
        return { body: { error: 'insufficient_balance', available: available }, status: 400 };
      }
      const amountMicro = micro(amount);
      state.creatorEarnings -= amountMicro;
      state.creatorWithdrawn = (state.creatorWithdrawn || 0) + amountMicro;
      const withdrawal = {
        id: 'wd_' + Date.now(),
        amountUsd: amount,
        // Properly formatted 66-char hex tx hash (0x + 64 hex chars)
        txHash: '0x' + ('wd' + Date.now().toString(16) + (++state.txCounter).toString(16)).padEnd(64, '0').slice(0, 64),
        status: 'confirmed',
        created_at: Date.now(),
      };
      state.withdrawals = state.withdrawals || [];
      state.withdrawals.unshift(withdrawal);
      saveState();
      // Mock mode: no on-chain settlement, so point to the seller's real
      // Arcscan address (which is verifiable). Live mode would use the
      // actual mint tx hash.
      const sellerArcscan = 'https://testnet.arcscan.app/address/0xEb375940Cd0D85f06239d68C6e719c71907771f9';
      return {
        body: {
          ok: true,
          withdrawal,
          balance: usd(state.creatorEarnings),
          mode: 'mock',
          arcscanUrl: sellerArcscan,
          sellerAddress: '0xEb375940Cd0D85f06239d68C6e719c71907771f9',
          note: 'Mock mode — payment recorded in audit ledger; verify the seller wallet on Arcscan for on-chain settlement.',
        }
      };
    }
    if (method === 'GET' && path === '/api/creator/dashboard') {
      const myTracks = DEMO_TRACKS.filter(t => t.creator_id === (state.currentUser?.id || 'demo-creator'));
      return { body: {
        creator: state.currentUser,
        earningsLive: usd(state.creatorEarnings),
        earningsRecorded: usd(state.creatorEarnings),
        available: usd(state.creatorEarnings),
        withdrawn: usd(state.creatorWithdrawn || 0),
        tracks: myTracks,
        withdrawals: state.withdrawals || [],
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

  // ──────────────────────────────────────────────
  // Meter simulation (per-second tick)
  // ──────────────────────────────────────────────
  function startMeter(track) {
    stopMeter();
    state.meterInterval = setInterval(() => {
      if (!state.activeSession) return;
      const s = state.activeSession;
      if (state.balance < s.pricePerSec) {
        stopMeter();
        return;
      }
      state.balance -= s.pricePerSec;
      s.secondsPlayed += 1;
      s.amountPaid += s.pricePerSec;
      state.creatorEarnings += s.pricePerSec;
      // Update per-track stats — Issue 3 fix
      const track = DEMO_TRACKS.find(t => t.id === s.trackId);
      if (track) {
        track.plays = (track.plays || 0) + 1;
        track.earnings_total = (track.earnings_total || 0) + s.pricePerSec;
      }
      // Record in tick ledger
      state.txCounter += 1;
      state.tickLedger.push({
        ts: Date.now(),
        trackId: s.trackId,
        listener: state.currentUser?.id || 'demo-listener',
        creator: track?.creator_id || 'demo-creator',
        amountMicro: s.pricePerSec,
        txHash: '0x' + state.txCounter.toString(16).padStart(64, '0'),
      });
      // Persist after each tick so refresh doesn't lose data
      saveState();
    }, 1000);
  }

  function stopMeter() {
    if (state.meterInterval) {
      clearInterval(state.meterInterval);
      state.meterInterval = null;
    }
    // Don't null out activeSession — let the caller decide (it may want to read the final values)
  }

  console.log('[demo mode] PerStream public preview — simulated backend active');
  console.log('[demo mode] try logging in with demo-listener@perstream.fm');
})();
