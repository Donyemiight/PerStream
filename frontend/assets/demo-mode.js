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

  // Override the API base to use the local simulation
  window.PERSTREAM_API = 'demo';

  const DEMO_USERS = [
    { id: 'demo-creator', handle: 'perstream-demo', email: 'demo-creator@perstream.fm', wallet: '0x9b198314420ffc0f7a5e4895a2cfcc12d0b53493', role: 'creator' },
    { id: 'demo-listener', handle: 'demo-listener', email: 'demo-listener@perstream.fm', wallet: '0xe6737b1cb6cdbc484fd11d658e664835a7673e46', role: 'listener' },
  ];

  const DEMO_TRACKS = [
    { id: 'trk-welcome', creator_id: 'demo-creator', title: 'PerStream Theme — Welcome to paid seconds', description: 'A 30-second welcome message. Use this to feel the per-second tick.', audio_url: '', duration_sec: 30, price_per_sec: 300, plays: 142, earnings_total: 4260000 },
    { id: 'trk-pitch', creator_id: 'demo-creator', title: 'The Cold-Start Cliff — PerStream pitch audio', description: '60-second pitch explaining why per-second beats subscriptions.', audio_url: '', duration_sec: 60, price_per_sec: 500, plays: 89, earnings_total: 8910000 },
    { id: 'trk-loop', creator_id: 'demo-creator', title: 'Demo Loop — looping tone for testing', description: 'A short test track. Loop it to see continuous per-second tick.', audio_url: '', duration_sec: 15, price_per_sec: 100, plays: 256, earnings_total: 1280000 },
  ];

  const state = {
    currentUser: null,
    balance: 0,                    // listener's USDC deposit (micro-USDC)
    creatorEarnings: 0,            // creator's accumulated earnings (micro-USDC)
    activeSession: null,
    meterInterval: null,
    listenerInterval: null,
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
        audioUrl: '',  // No real audio in demo mode
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