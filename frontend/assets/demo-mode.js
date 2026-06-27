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
      badge.onclick = () => { window.location.href = 'https://providence-musician-civic-watt.trycloudflare.com' + window.location.pathname; };
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

  // Override fetch to intercept API calls
  const realFetch = window.fetch.bind(window);
  window.fetch = async function(url, opts = {}) {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (!urlStr.includes('/api/')) return realFetch(url, opts);

    const path = urlStr.replace(/^https?:\/\/[^/]+/, '').replace(/^demo/, '');
    const method = (opts.method || 'GET').toUpperCase();

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      const body = JSON.parse(opts.body || '{}');
      const email = body.email || '';
      const user = DEMO_USERS.find(u => u.email === email) || DEMO_USERS[1];
      state.currentUser = { ...user };
      return json({ user: state.currentUser, wallet: { address: user.wallet, mode: 'demo' } });
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      return json({ user: state.currentUser });
    }

    // GET /api/tracks
    if (method === 'GET' && path === '/api/tracks') {
      return json({ tracks: DEMO_TRACKS });
    }

    // GET /api/tracks/:id
    if (method === 'GET' && path.match(/^\/api\/tracks\/[^/]+$/)) {
      const id = path.split('/').pop();
      const track = DEMO_TRACKS.find(t => t.id === id);
      if (!track) return json({ error: 'not_found' }, 404);
      const creator = DEMO_USERS.find(u => u.id === track.creator_id);
      return json({ track: { ...track, creator } });
    }

    // GET /api/tracks/:id/stream
    if (method === 'GET' && path.match(/^\/api\/tracks\/[^/]+\/stream$/)) {
      const id = path.split('/')[3];
      const track = DEMO_TRACKS.find(t => t.id === id);
      if (!track) return json({ error: 'not_found' }, 404);
      // Simulate x402: if no balance, return 402
      if (state.balance < track.price_per_sec) {
        return new Response(JSON.stringify({
          error: 'payment_required',
          pricePerSec: track.price_per_sec,
          pricePerSecUsd: usd(track.price_per_sec),
          creator: track.creator_id,
          trackId: track.id,
        }), {
          status: 402,
          headers: {
            'X-PerStream-Price': String(track.price_per_sec),
            'X-PerStream-Price-Usd': String(usd(track.price_per_sec)),
            'X-PerStream-Creator': track.creator_id,
            'X-PerStream-Track-Id': track.id,
          },
        });
      }
      return json({
        ok: true,
        trackId: track.id,
        audioUrl: track.audioUrl || 'assets/loop.mp3',  // real demo audio
        pricePerSec: track.price_per_sec,
        durationSec: track.duration_sec,
        balanceMicroUsdc: state.balance,
      });
    }

    // POST /api/listen/deposit
    if (method === 'POST' && path === '/api/listen/deposit') {
      const body = JSON.parse(opts.body || '{}');
      const amount = micro(parseFloat(body.amountUsd || 0));
      state.balance += amount;
      return json({ ok: true, balance: state.balance });
    }

    // POST /api/listen/start
    if (method === 'POST' && path === '/api/listen/start') {
      const body = JSON.parse(opts.body || '{}');
      const track = DEMO_TRACKS.find(t => t.id === body.trackId);
      if (!track) return json({ error: 'not_found' }, 404);
      state.activeSession = {
        sessionId: 'demo-' + Date.now(),
        trackId: track.id,
        pricePerSec: track.price_per_sec,
        secondsPlayed: 0,
        amountPaid: 0,
      };
      startMeter(track);
      return json({
        sessionId: state.activeSession.sessionId,
        trackId: track.id,
        pricePerSec: track.price_per_sec,
        pricePerSecUsd: usd(track.price_per_sec),
      });
    }

    // POST /api/listen/stop
    if (method === 'POST' && path === '/api/listen/stop') {
      stopMeter();
      return json({
        session: state.activeSession,
        totalPaidUsd: usd(state.activeSession?.amountPaid || 0),
      });
    }

    // GET /api/listen/poll
    if (method === 'GET' && path.startsWith('/api/listen/poll')) {
      return json({
        tick: !!state.activeSession,
        secondsPlayed: state.activeSession?.secondsPlayed || 0,
        amountPaid: state.activeSession?.amountPaid || 0,
        balance: state.balance,
      });
    }

    // GET /api/creator/dashboard
    if (method === 'GET' && path === '/api/creator/dashboard') {
      return json({
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
      });
    }

    // POST /api/feedback
    if (method === 'POST' && path === '/api/feedback') {
      const body = JSON.parse(opts.body || '{}');
      const rating = parseInt(body.rating, 10);
      if (!rating || rating < 1 || rating > 5) {
        return json({ error: 'rating must be 1-5' }, 400);
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
      return json({ ok: true, id: entry.id });
    }

    // GET /api/feedback/stats
    if (method === 'GET' && path === '/api/feedback/stats') {
      const total = state.feedback.length;
      const avg = total ? Math.round(state.feedback.reduce((s, f) => s + f.rating, 0) / total * 10) / 10 : 0;
      const distribution = {};
      for (let i = 1; i <= 5; i++) distribution[i] = state.feedback.filter(f => f.rating === i).length;
      return json({ total, average: avg, distribution, recent: state.feedback.slice(-10).reverse() });
    }

    // GET /api/feedback
    if (method === 'GET' && path === '/api/feedback') {
      return json({ feedback: state.feedback.slice(-parseInt(req.query.limit || '50', 10)).reverse() });
    }

    // POST /api/lead
    if (method === 'POST' && path === '/api/lead') {
      const body = JSON.parse(opts.body || '{}');
      if (!body.email || !body.email.includes('@')) {
        return json({ error: 'valid email required' }, 400);
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
      return json({ ok: true });
    }

    // GET /api/lead/count
    if (method === 'GET' && path === '/api/lead/count') {
      return json({ count: state.leads.length });
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
      return json({ mode: 'mock', stats, ticks });
    }

    // GET /api/audit/stats
    if (method === 'GET' && path === '/api/audit/stats') {
      const totalMicro = state.tickLedger.reduce((sum, e) => sum + (e.amountMicro || 0), 0);
      return json({
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
      });
    }

    // Fallback: real fetch
    return realFetch(url, opts);
  };

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

      // Record in audit ledger
      state.txCounter += 1;
      const sid = s.sessionId.slice(0, 8);
      const stamp = Date.now().toString(16);
      const txHash = `0x${sid}${stamp}${state.txCounter.toString(16).padStart(4, '0')}`.padEnd(66, '0');
      state.tickLedger.push({
        ts: new Date().toISOString(),
        sessionId: s.sessionId,
        trackId: s.trackId,
        listener: state.currentUser ? state.currentUser.wallet : 'demo-listener-wallet',
        creator: track.creator_id || 'demo-creator',
        amountMicro: s.pricePerSec,
        amountUsd: s.pricePerSec / 1_000_000,
        txHash,
        arcscanUrl: `https://testnet.arcscan.app/tx/${txHash}`,
        mode: 'mock',
      });
      // Cap memory
      if (state.tickLedger.length > 1000) state.tickLedger.shift();
    }, 1000);
  }

  function stopMeter() {
    if (state.meterInterval) {
      clearInterval(state.meterInterval);
      state.meterInterval = null;
    }
    state.activeSession = null;
  }

  console.log('[demo mode] PerStream public preview — simulated backend active');
  console.log('[demo mode] try logging in with demo-listener@perstream.fm');
})();