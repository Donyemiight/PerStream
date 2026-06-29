/**
 * PerStream Frontend — shared client logic
 *
 * API base URL is auto-detected: same host as the page, port 3000 by default.
 * In production, set window.PERSTREAM_API to override.
 */

const PerStream = (() => {
  // API_BASE is mutable so we can recover from a dead tunnel URL.
  // window.PERSTREAM_API is injected by every deployed HTML page; for
  // localhost the user can hit the backend directly.
  let API_BASE = window.PERSTREAM_API ||
    (window.location.hostname === 'localhost' || window.location.port
      ? 'http://localhost:3000'
      : `${window.location.protocol}//${window.location.host}`);

  // Allow tunnel-discovery to swap the base URL at runtime.
  if (typeof window !== 'undefined') {
    window.__perstream_setApiBase = (newBase) => {
      API_BASE = newBase;
      window.PERSTREAM_API = newBase;
      localStorage.setItem('perstream_known_tunnel', newBase);
    };
  }

  const STORAGE_KEY = 'perstream_user';

  // ─── Toast helper (defined at top so all functions can use it) ───
  // ── Button loading helper (disable + spinner + auto-re-enable) ──
  function setLoading(btn, isLoading, originalText) {
    if (!btn) return () => {};
    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = originalText || btn.textContent;
      btn.classList.add('btn-loading');
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.originalText || originalText || btn.textContent;
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
    return () => setLoading(btn, false);
  }

  function showToast(message, type) {
    let toast = document.getElementById('perstream-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'perstream-toast';
      toast.style.cssText = 'position:fixed; top:80px; left:50%; transform:translateX(-50%); padding:12px 20px; border-radius:8px; font-weight:600; z-index:9999; max-width:90%; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.3s; font-family: system-ui, -apple-system, sans-serif;';
      document.body.appendChild(toast);
    }
    const colors = { info: '#3b82f6', success: '#10b981', error: '#ef4444' };
    toast.style.background = colors[type] || colors.info;
    toast.style.color = '#fff';
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, type === 'error' ? 5000 : 3000);
  }

  // ─── State ───
  let currentUser = null;

  function loadUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) currentUser = JSON.parse(raw);
    } catch {}
  }

  function saveUser(user) {
    currentUser = user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function clearUser() {
    currentUser = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── Auth ───

  async function login(email) {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'login_failed');
    const data = await r.json();
    saveUser(data.user);
    return data.user;
  }

  function logout() {
    clearUser();
    location.reload();
  }

  function authedFetch(path, opts = {}) {
    if (!currentUser) throw new Error('not_authenticated');
    return fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        'Content-Type': 'application/json',
        'X-User-Id': currentUser.id,
      },
    });
  }

  // ─── Listen page ───

  let _initListenPageRan = false;
  async function initListenPage() {
    // Guard against double-init when DOMContentLoaded and setTimeout(0) both fire
    if (_initListenPageRan) return;
    _initListenPageRan = true;
    loadUser();
    setupAuthBar('listen');
    // Wire up deposit buttons IMMEDIATELY so users can deposit before selecting a track
    const btnDep = document.getElementById('btn-deposit');
    const btnDepBig = document.getElementById('btn-deposit-big');
    if (btnDep) btnDep.onclick = (e) => deposit(1, e.currentTarget);
    if (btnDepBig) btnDepBig.onclick = (e) => deposit(5, e.currentTarget);
    if (currentUser) {
      await refreshBalance();
    }
    await loadTracks();
  }

  // Always fetch fresh balance from server (single source of truth).
  // Called on page load and after every deposit.
  async function refreshBalance() {
    try {
      const r = await authedFetch('/api/listen/balance');
      if (r.ok) {
        const data = await r.json();
        document.getElementById('stat-balance').textContent = formatUsdc(data.balance);
      }
    } catch {}
  }

  async function loadTracks() {
    const list = document.getElementById('tracks-list');
    let r;
    try {
      r = await fetch(`${API_BASE}/api/tracks`);
    } catch (err) {
      // Tunnel might be down — try to recover via tunnel-discovery
      console.warn('[loadTracks] fetch failed, attempting tunnel recovery:', err.message);
      if (window.discoverTunnel) {
        const newBase = await window.discoverTunnel();
        if (newBase !== window.PERSTREAM_API) {
          window.__perstream_setApiBase(newBase);
          // Retry once with new base
          try {
            r = await fetch(`${newBase}/api/tracks`);
          } catch (err2) {
            list.innerHTML = `<div class="error">Failed to load tracks: ${err2.message}<br><small>Backend unreachable. Try refreshing the page.</small></div>`;
            return;
          }
        } else {
          list.innerHTML = `<div class="error">Failed to load tracks: ${err.message}<br><small>Backend unreachable. Try refreshing the page.</small></div>`;
          return;
        }
      } else {
        list.innerHTML = `<div class="error">Failed to load tracks: ${err.message}</div>`;
        return;
      }
    }
    try {
      const { tracks } = await r.json();

      if (!tracks.length) {
        list.innerHTML = '<div class="loading">No tracks yet. Sign in as creator and upload one.</div>';
        return;
      }

      list.innerHTML = tracks.map(t => `
        <div class="track-item" data-track-id="${t.id}">
          <div class="track-info">
            <div class="track-title">${escapeHtml(t.title)}</div>
            <div class="track-meta">${formatDuration(t.duration_sec)} · ${t.plays} plays</div>
          </div>
          <div class="track-price">${formatUsdc(t.price_per_sec)} / sec</div>
        </div>
      `).join('');

      list.querySelectorAll('.track-item').forEach(el => {
        el.addEventListener('click', () => selectTrack(el.dataset.trackId));
      });
    } catch (err) {
      list.innerHTML = `<div class="error">Failed to load tracks: ${err.message}</div>`;
    }
  }

  async function selectTrack(trackId) {
    if (!currentUser) {
      promptLogin();
      return;
    }

    const playerSection = document.getElementById('player-section');
    playerSection.style.display = 'block';
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Fetch track details
    const r = await fetch(`${API_BASE}/api/tracks/${trackId}`);
    if (!r.ok) {
      showError('Track not found');
      return;
    }
    const { track } = await r.json();
    currentTrack = track;

    document.getElementById('player-title').textContent = track.title;
    document.getElementById('player-creator').textContent = track.creator ? `@${track.creator.handle}` : 'Unknown';
    document.getElementById('player-price').textContent = `${formatUsdc(track.price_per_sec)}/sec`;
    document.getElementById('tick-value').textContent = '0.000000';
    document.getElementById('stat-seconds').textContent = '0';
    document.getElementById('stat-status').textContent = 'Loading…';

    // Try x402 flow
    const stream = await fetch(`${API_BASE}/api/tracks/${trackId}/stream`, {
      headers: { 'X-User-Id': currentUser.id },
    });

    let streamData = null;
    if (stream.status === 402) {
      const info = await stream.json();
      showX402Info(info);
      document.getElementById('stat-status').textContent = '402 — deposit to listen';
    } else if (!stream.ok) {
      showError('Failed to load stream');
      return;
    } else {
      streamData = await stream.json();
      hideX402Info();
    }

    // Wire up player handlers — always, including when 402 was returned,
    // so the deposit buttons work even before the user has paid.
    setupPlayerHandlers(track, streamData);
  }

  let activeSession = null;
  let tickPollInterval = null;
  let currentTrack = null;

  function setupPlayerHandlers(track, streamData) {
    const audio = document.getElementById('audio');

    // Set the audio src, but DISABLE the native controls and pause it
    // so it can't play unless the user explicitly starts streaming
    // (i.e. the per-second paywall is enforced)
    audio.controls = false;
    audio.pause();
    audio.removeAttribute('autoplay');
    if (streamData && streamData.audioUrl) {
      audio.src = streamData.audioUrl;
      const balance = streamData.balanceMicroUsdc ?? 0;
      document.getElementById('stat-balance').textContent = formatUsdc(balance);
      document.getElementById('stat-status').textContent = 'Deposit to listen — or press Start Streaming';
    } else {
      audio.src = track.audioUrl || 'assets/loop.mp3';
    }

    // Log audio load issues so the user can see them in the player-error overlay.
    audio.addEventListener('error', () => {
      const err = audio.error;
      const codeMap = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
      };
      const msg = `Audio failed to load: ${err ? codeMap[err.code] || 'unknown' : 'unknown'}`;
      console.error('[perstream]', msg, 'src:', audio.src);
      const errEl = document.getElementById('player-error');
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    });
    audio.addEventListener('canplay', () => {
      console.log('[perstream] audio can play, duration:', audio.duration, 'src:', audio.src);
    });
    audio.addEventListener('playing', () => {
      console.log('[perstream] audio playing');
    });
    audio.load();

    // === SIMPLIFIED METER (demo) ===
    // The meter runs as a local setInterval and updates the UI directly.
    // No dependency on the audio element's play event — which can be flaky on mobile.
    // We also call the backend to register the session, but if that fails, the meter keeps going.

    let meterSeconds = 0;
    let meterRunning = false;
    let meterInterval = null;
    let meterSessionId = null;

    const startMeter = async () => {
      if (meterRunning) return;

      // PAYMENT GATE — refuse to start unless the user has funded the session.
      // Reads the displayed balance (which we keep in sync with /api/listen/balance
      // via refreshBalance()). Anything <= 0 means no deposit yet.
      const balanceText = document.getElementById('stat-balance')?.textContent || '0';
      const balanceMicro = parseFloat(balanceText) || 0;
      if (balanceMicro <= 0) {
        showToast('Deposit USDC before starting playback', 'error');
        showError('Deposit at least $0.01 USDC before pressing Start Streaming.');
        // Visually nudge the deposit buttons
        const dep = document.getElementById('btn-deposit');
        const depBig = document.getElementById('btn-deposit-big');
        if (dep) dep.classList.add('btn-pulse');
        if (depBig) depBig.classList.add('btn-pulse');
        setTimeout(() => {
          if (dep) dep.classList.remove('btn-pulse');
          if (depBig) depBig.classList.remove('btn-pulse');
        }, 3000);
        return;
      }

      meterRunning = true;
      document.getElementById('stat-status').textContent = 'Streaming — paying per second';

      // CRITICAL: Call audio.play() IMMEDIATELY in the user-gesture context
      // before any awaits — iOS Safari loses the user-gesture flag after
      // the first async boundary, which silently blocks audio playback.
      try {
        const playPromise = audio.play();
        if (playPromise && playPromise.then) {
          playPromise.then(() => {
            console.log('[perstream] audio.play() resolved, currentTime=', audio.currentTime);
          }).catch((err) => {
            console.warn('[perstream] audio.play() rejected:', err.message, 'src:', audio.src);
            showToast('Tap the play icon to enable audio', 'info');
          });
        }
      } catch (e) {
        console.warn('[perstream] audio.play() threw:', e.message);
      }

      // Now do the backend call (after audio.play has fired)
      try {
        const r = await authedFetch('/api/listen/start', {
          method: 'POST',
          body: JSON.stringify({ trackId: track.id }),
        });
        if (r.ok) {
          const data = await r.json();
          meterSessionId = data.sessionId;
          // Pull authoritative balance immediately
          if (typeof data.balanceMicroUsdc === 'number') {
            document.getElementById('stat-balance').textContent = formatUsdc(data.balanceMicroUsdc);
          }
        }
      } catch {}

      // Drive UI from server-authoritative polls (1100ms) so balance is always exact.
      // Stop the local-math setInterval and let the poll be the only writer.
      meterInterval = setInterval(async () => {
        try {
          const r = await authedFetch(`/api/listen/poll?sessionId=${meterSessionId}`);
          if (r.ok) {
            const data = await r.json();
            if (data.tick) {
              meterSeconds = data.secondsPlayed || meterSeconds + 1;
              document.getElementById('stat-seconds').textContent = meterSeconds;
              document.getElementById('tick-value').textContent = formatUsdc(data.amountPaid);
              document.getElementById('stat-balance').textContent = formatUsdc(data.balance);
              if (data.balance <= 0) {
                stopMeter();
                document.getElementById('stat-status').textContent = 'Balance empty — deposit to continue';
              }
            }
          }
        } catch {}
      }, 1100);

      // Audio already started at top of startMeter (must be in user-gesture context)
    };

    // Local tick is now handled via server poll above; legacy local-math removed.

    const stopMeter = async () => {
      if (!meterRunning) return;
      meterRunning = false;
      clearInterval(meterInterval);
      meterInterval = null;
      document.getElementById('stat-status').textContent = 'Paused';
      audio.pause();
      // Best-effort backend stop
      try {
        if (meterSessionId) {
          await authedFetch('/api/listen/stop', {
            method: 'POST',
            body: JSON.stringify({ sessionId: meterSessionId }),
          });
        }
      } catch {}
    };

    // Deposit buttons — always wired
    const btnDep = document.getElementById('btn-deposit');
    const btnDepBig = document.getElementById('btn-deposit-big');
    if (btnDep) btnDep.onclick = (e) => deposit(1, e.currentTarget);
    if (btnDepBig) btnDepBig.onclick = (e) => deposit(5, e.currentTarget);

    // Single, reliable Start/Stop button
    const btnStart = document.getElementById('btn-start-stream');
    if (btnStart) {
      btnStart.textContent = meterRunning ? '⏸ Pause' : '▶ Start Streaming';
      btnStart.onclick = () => {
        if (meterRunning) {
          stopMeter();
          btnStart.textContent = '▶ Start Streaming';
        } else {
          startMeter();
          btnStart.textContent = '⏸ Pause';
        }
      };
    }
  }

  async function deposit(amountUsd, btn) {
    try {
      if (!currentUser) {
        promptLogin();
        return;
      }
      const stopLoading = setLoading(btn, true, '⏳ Adding…');
      showToast(`Depositing $${amountUsd} USDC…`, 'info');
      const r = await authedFetch('/api/listen/deposit', {
        method: 'POST',
        body: JSON.stringify({ amountUsd }),
      });
      const data = await r.json();
      stopLoading();
      if (!data.ok) {
        showToast(`Deposit failed: ${data.reason || 'unknown error'}`, 'error');
        showError(data.reason || 'deposit_failed');
        return;
      }
      const balanceMicro = data.balance;
      document.getElementById('stat-balance').textContent = formatUsdc(balanceMicro);
      // Also re-fetch to guarantee server-authoritative balance
      refreshBalance();
      // Flash success
      const status = document.getElementById('stat-status');
      const prev = status.textContent;
      status.textContent = `✓ +$${amountUsd} USDC added`;
      setTimeout(() => {
        if (status.textContent.startsWith('✓')) status.textContent = prev;
      }, 3000);
      // If we were stuck at 402, change status to "ready" so the user can press start
      if (prev && prev.includes('402')) {
        setTimeout(() => {
          status.textContent = 'Ready — press Start Streaming';
        }, 800);
      }
    } catch (err) {
      showError(`Deposit failed: ${err.message}`);
    }
  }

  function startPolling(sessionId) {
    stopPolling();
    tickPollInterval = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/listen/poll?sessionId=${sessionId}`);
        if (r.ok) {
          const data = await r.json();
          if (data.tick) {
            document.getElementById('tick-value').textContent = formatUsdc(data.amountPaid);
            document.getElementById('stat-seconds').textContent = data.secondsPlayed;
            document.getElementById('stat-balance').textContent = formatUsdc(data.balance);
          }
        }
      } catch {}
    }, 1100);
  }

  function stopPolling() {
    if (tickPollInterval) {
      clearInterval(tickPollInterval);
      tickPollInterval = null;
    }
  }

  function showX402Info(info) {
    const el = document.getElementById('x402-info');
    const pre = document.getElementById('x402-info-json');
    pre.textContent = JSON.stringify({
      status: 402,
      'X-PerStream-Price': String(info.pricePerSec) + ' (micro-USDC)',
      'X-PerStream-Price-Usd': '$' + info.pricePerSecUsd,
      'X-PerStream-Creator': info.creator,
      'X-PerStream-Track-Id': info.trackId,
      message: info.message,
    }, null, 2);
    el.style.display = 'block';
  }

  function hideX402Info() {
    document.getElementById('x402-info').style.display = 'none';
  }

  function showError(msg) {
    const el = document.getElementById('player-error');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  // ─── Creator page ───

  async function initCreatorPage() {
    loadUser();
    setupAuthBar('creator');
    if (currentUser) {
      await loadDashboard();
    }
  }

  async function loadDashboard() {
    document.getElementById('upload-section').style.display = 'block';
    document.getElementById('tracks-section').style.display = 'block';
    document.getElementById('earnings-section').style.display = 'flex';

    try {
      const r = await authedFetch('/api/creator/dashboard');
      const data = await r.json();
      document.getElementById('earnings-value').textContent = formatUsdc(Math.floor(data.earningsLive * 1_000_000));

      const list = document.getElementById('tracks-list');
      if (!data.tracks.length) {
        list.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">No episodes yet</div>
          <div class="empty-state-message">Be the first creator — upload an MP3 and set a per-second price.</div>
          <a href="creator.html" class="btn btn-primary">Become a creator →</a>
        </div>`;
      } else {
        list.innerHTML = data.tracks.map(t => `
          <div class="track-item">
            <div class="track-info">
              <div class="track-title">${escapeHtml(t.title)}</div>
              <div class="track-meta">${formatDuration(t.duration_sec)} · ${formatUsdc(t.price_per_sec)}/sec</div>
              <div class="track-stat-row">
                <span>Plays: <strong>${t.plays}</strong></span>
                <span>Earned: <strong>${formatUsdc(t.earnings_total || 0)}</strong></span>
                <span>Live: <strong>${t.sessionsActive || 0}</strong></span>
              </div>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error(err);
    }

    // Upload form
    const form = document.getElementById('upload-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const r = await authedFetch('/api/tracks', {
          method: 'POST',
          body: fd,
          headers: {},  // let browser set Content-Type for FormData
        });
        if (!r.ok) {
          const err = await r.json();
          alert('Upload failed: ' + (err.error || 'unknown'));
          return;
        }
        form.reset();
        await loadDashboard();
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    };

    // Withdraw
    const btnWithdrawAll = document.getElementById('btn-withdraw-all');
    if (btnWithdrawAll) btnWithdrawAll.onclick = async () => {
      try {
        const r = await authedFetch('/api/creator/withdraw', {
          method: 'POST',
          body: JSON.stringify({ amountUsd: parseFloat(document.getElementById('earnings-value').textContent) || 0 }),
        });
        const data = await r.json();
        if (data.ok) {
          alert(`Withdrew ${formatUsdc(data.withdrawn)} USDC`);
          await loadDashboard();
        } else {
          alert('Withdraw failed: ' + (data.reason || 'unknown'));
        }
      } catch (err) {
        alert('Withdraw error: ' + err.message);
      }
    };

    // Feedback + leads stats
    document.getElementById('feedback-summary').style.display = 'block';
    const avgEl = document.getElementById('fs-avg-rating');
    const countEl = document.getElementById('fs-rating-count');
    const leadsEl = document.getElementById('fs-leads');
    const reviewsList = document.getElementById('reviews-list');
    if (data.feedback) {
      avgEl.textContent = data.feedback.total > 0 ? `${data.feedback.average}/5` : '—';
      countEl.textContent = data.feedback.total;
    }
    if (data.leads) {
      leadsEl.textContent = data.leads.count;
    }
    reviewsList.innerHTML = '';
    if (data.feedback && data.feedback.recent.length > 0) {
      data.feedback.recent.forEach(r => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const date = new Date(r.created_at).toLocaleDateString();
        const item = document.createElement('div');
        item.className = 'review-item';
        item.innerHTML = `
          <div class="review-stars">${stars}</div>
          <div class="review-comment">${escapeHtml(r.comment || '(no comment)')}</div>
          <div class="review-meta">${r.user_email ? escapeHtml(r.user_email) + ' · ' : ''}${date} · ${escapeHtml(r.page || '')}</div>
        `;
        reviewsList.appendChild(item);
      });
    } else {
      reviewsList.innerHTML = '<p class="muted" style="color: var(--text-dim); font-size: 0.9rem;">No ratings yet. Share the demo URL to get them.</p>';
    }

    // Audit trail (on-chain verification)
    const auditSection = document.getElementById('audit-section');
    if (auditSection) {
      auditSection.style.display = 'block';
      try {
        const ar = await fetch('demo/api/audit/ticks?limit=20');
        if (ar.ok) {
          const audit = await ar.json();
          document.getElementById('audit-tick-count').textContent = audit.stats.totalTicks;
          document.getElementById('audit-total').textContent = audit.stats.totalAmountUsd.toFixed(6);
          document.getElementById('audit-mode').textContent = audit.mode;
          const list = document.getElementById('audit-ticks-list');
          list.innerHTML = '';
          if (audit.ticks.length === 0) {
            list.innerHTML = '<p class="muted">No ticks yet. Play a track to start the audit trail.</p>';
          } else {
            audit.ticks.forEach(t => {
              const row = document.createElement('div');
              row.className = 'audit-row';
              const time = new Date(t.ts).toLocaleTimeString();
              const arcscanLink = t.arcscanUrl
                ? `<a href="${t.arcscanUrl}" target="_blank" rel="noopener" class="arcscan-link">${t.txHash.slice(0, 10)}…${t.txHash.slice(-6)} ↗</a>`
                : `<code>${t.txHash.slice(0, 10)}…</code>`;
              row.innerHTML = `
                <span class="audit-time">${time}</span>
                <span class="audit-amount">$${t.amountUsd.toFixed(6)}</span>
                <span class="audit-tx">${arcscanLink}</span>
              `;
              list.appendChild(row);
            });
          }
        }
      } catch {}
    }
  }

  // ─── Auth bar (shared) ───

  function setupAuthBar(page) {
    const signedOut = document.getElementById('auth-signed-out');
    const signedIn = document.getElementById('auth-signed-in');

    if (currentUser) {
      signedOut.style.display = 'none';
      signedIn.style.display = 'flex';
      document.getElementById('auth-handle').textContent = `@${currentUser.handle}`;
      const walletEl = document.getElementById('auth-wallet');
      if (walletEl) walletEl.textContent = shortenAddr(currentUser.wallet);
    } else {
      signedOut.style.display = 'flex';
      signedIn.style.display = 'none';
    }

    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');

    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = await showLoginModal(page);
        if (!email) return;
        try {
          loginBtn.disabled = true;
          loginBtn.textContent = '⏳ Signing in…';
          await login(email.trim().toLowerCase());
          location.reload();
        } catch (err) {
          showToast('Login failed: ' + err.message, 'error');
          loginBtn.disabled = false;
          loginBtn.textContent = page === 'creator' ? 'Sign in' : 'Sign in with email';
        }
      };
    }

    if (logoutBtn) logoutBtn.onclick = logout;
  }

  // ─── Utilities ───

  function formatUsdc(microAmount) {
    const usd = (microAmount || 0) / 1_000_000;
    return usd.toFixed(6);
  }

  function parseUsdc(usdString) {
    // Convert "1.000000" back to micro-USDC (1000000)
    const usd = parseFloat(usdString || '0');
    return Math.floor(usd * 1_000_000);
  }

  function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
  }

  function shortenAddr(addr) {
    if (!addr) return '0x…';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ─── Login modal (mobile-friendly, no native prompt()) ───
  function showLoginModal(page) {
    return new Promise((resolve) => {
      // Remove any existing modal
      const existing = document.getElementById('perstream-login-modal');
      if (existing) existing.remove();

      const isCreator = page === 'creator';
      const modal = document.createElement('div');
      modal.id = 'perstream-login-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease;';
      modal.innerHTML = `
        <div style="background:var(--bg-elev,#16161f);border:1px solid var(--border,#25252f);border-radius:20px;padding:32px;max-width:400px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,0.7);">
          <div style="font-size:1.4em;font-weight:800;margin-bottom:8px;">${isCreator ? 'Sign in as creator' : 'Sign in to listen'}</div>
          <div style="color:var(--text-dim,#8b8b9a);font-size:0.9em;margin-bottom:20px;">Any email works. We'll create your Arc wallet instantly.</div>
          <form id="login-form" style="display:flex;flex-direction:column;gap:12px;">
            <input type="email" id="login-email" placeholder="you@example.com" required autocomplete="email" style="background:var(--bg-card,#16161f);border:1px solid var(--border,#25252f);border-radius:10px;padding:14px 16px;color:var(--text,#e8e8ee);font-size:16px;outline:none;width:100%;box-sizing:border-box;font-family:inherit;" />
            <button type="submit" id="login-submit" style="background:linear-gradient(135deg,#00d4ff,#ff00aa);color:#0a0a0f;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer;font-family:inherit;">Sign in</button>
            <button type="button" id="login-cancel" style="background:transparent;color:var(--text-dim,#8b8b9a);border:1px solid var(--border,#25252f);padding:12px;border-radius:10px;font-weight:500;cursor:pointer;font-family:inherit;">Cancel</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = modal.querySelector('#login-form');
      const input = modal.querySelector('#login-email');
      const cancelBtn = modal.querySelector('#login-cancel');

      // Auto-focus the input on mobile (iOS may need explicit click too)
      setTimeout(() => { try { input.focus(); } catch {} }, 100);

      form.onsubmit = (e) => {
        e.preventDefault();
        const email = input.value.trim();
        if (!email) return;
        modal.remove();
        resolve(email);
      };
      cancelBtn.onclick = () => { modal.remove(); resolve(null); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
      // ESC to cancel
      const escHandler = (e) => { if (e.key === 'Escape') { modal.remove(); resolve(null); document.removeEventListener('keydown', escHandler); } };
      document.addEventListener('keydown', escHandler);
    });
  }

  function promptLogin() {
    alert('Sign in first (button at top of page)');
  }

  return {
    initListenPage,
    initCreatorPage,
  };
})();