/**
 * PerStream Creator Dashboard
 *
 * Handles the full creator workflow:
 *  - Authentication
 *  - View dashboard analytics
 *  - Upload, edit, delete, publish/unpublish tracks
 *  - Search, filter, sort tracks
 *  - Withdraw earnings
 *  - Manage notifications
 *  - Edit profile
 */
(function() {
  'use strict';

  const API_BASE = window.PERSTREAM_API ||
    (window.location.hostname === 'localhost' || window.location.port
      ? 'http://localhost:3000'
      : `${window.location.protocol}//${window.location.host}`);

  const STORAGE_KEY = 'perstream_user';

  let currentUser = null;
  let dashboardData = null;
  let tracks = [];
  let filteredTracks = [];
  let editingTrackId = null;

  // ─── Toast helper ───
  function showToast(message, type) {
    let toast = document.getElementById('toast-container');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-container';
      toast.style.cssText = 'position:fixed; top:80px; right:20px; z-index:99999; display:flex; flex-direction:column; gap:8px; max-width:90%;';
      document.body.appendChild(toast);
    }
    const el = document.createElement('div');
    const colors = { info: '#3b82f6', success: '#10b981', error: '#ef4444' };
    el.style.cssText = `padding:14px 20px; border-radius:10px; font-weight:600; z-index:99999; box-shadow:0 4px 16px rgba(0,0,0,0.3); transition:all 0.3s; transform:translateX(120%); opacity:0; background:${colors[type]||colors.info}; color:#fff; font-size:0.95em;`;
    el.textContent = message;
    toast.appendChild(el);
    setTimeout(() => { el.style.transform = 'translateX(0)'; el.style.opacity = '1'; }, 50);
    setTimeout(() => {
      el.style.transform = 'translateX(120%)'; el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 5000 : 3000);
  }

  // ─── Helpers ───
  function formatUsdc(microAmount) {
    const usd = (microAmount || 0) / 1_000_000;
    return '$' + usd.toFixed(6);
  }
  function formatDuration(sec) {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  function shortenAddr(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function getCategoryEmoji(cat) {
    const map = { tech: '💻', crypto: '⛓️', music: '🎵', comedy: '😂', education: '📚', general: '🎙️' };
    return map[cat] || '🎙️';
  }

  // ─── Auth ───
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
  async function authedFetch(path, opts = {}) {
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

  // ─── Login modal ───
  function showLoginModal() {
    return new Promise((resolve) => {
      const existing = document.getElementById('perstream-login-modal');
      if (existing) existing.remove();
      const modal = document.createElement('div');
      modal.id = 'perstream-login-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
      modal.innerHTML = `
        <div style="background:#16161f;border:1px solid #25252f;border-radius:20px;padding:32px;max-width:400px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,0.7);">
          <div style="font-size:1.4em;font-weight:800;margin-bottom:8px;">Sign in as creator</div>
          <div style="color:#8b8b9a;font-size:0.9em;margin-bottom:20px;">Any email works. We'll create your Arc wallet instantly.</div>
          <form id="login-form" style="display:flex;flex-direction:column;gap:12px;">
            <input type="email" id="login-email" placeholder="you@example.com" required autocomplete="email" style="background:#12121a;border:1px solid #25252f;border-radius:10px;padding:14px 16px;color:#e8e8ee;font-size:16px;outline:none;width:100%;box-sizing:border-box;font-family:inherit;" />
            <button type="submit" id="login-submit" style="background:linear-gradient(135deg,#00d4ff,#ff00aa);color:#0a0a0f;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer;font-family:inherit;">Sign in</button>
            <button type="button" id="login-cancel" style="background:transparent;color:#8b8b9a;border:1px solid #25252f;padding:12px;border-radius:10px;font-weight:500;cursor:pointer;font-family:inherit;">Cancel</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
      const form = modal.querySelector('#login-form');
      const input = modal.querySelector('#login-email');
      const cancelBtn = modal.querySelector('#login-cancel');
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
    });
  }

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

  function setupAuthBar() {
    const signedOut = document.getElementById('auth-signed-out');
    const signedIn = document.getElementById('auth-signed-in');
    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');
    if (currentUser) {
      signedOut.style.display = 'none';
      signedIn.style.display = 'flex';
      document.getElementById('auth-handle').textContent = `@${currentUser.handle}`;
      document.getElementById('auth-wallet').textContent = shortenAddr(currentUser.wallet);
    } else {
      signedOut.style.display = 'flex';
      signedIn.style.display = 'none';
    }
    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = await showLoginModal();
        if (!email) return;
        try {
          loginBtn.disabled = true;
          loginBtn.textContent = '⏳ Signing in…';
          await login(email.trim().toLowerCase());
          location.reload();
        } catch (err) {
          showToast('Login failed: ' + err.message, 'error');
          loginBtn.disabled = false;
          loginBtn.textContent = 'Sign in with email';
        }
      };
    }
    if (logoutBtn) {
      logoutBtn.onclick = () => { clearUser(); location.reload(); };
    }
  }

  // ─── Load dashboard ───
  async function loadDashboard() {
    try {
      const r = await authedFetch('/api/creator/dashboard');
      if (!r.ok) throw new Error('Failed to load dashboard');
      dashboardData = await r.json();
      tracks = dashboardData.tracks || [];
      filteredTracks = tracks;
      renderDashboard();
      renderTracks();
      renderMostStreamed();
      renderWithdrawals();
      renderNotifications();
      renderProfile();
    } catch (err) {
      console.error('Dashboard load failed:', err);
      showToast('Failed to load dashboard: ' + err.message, 'error');
    }
  }

  function renderDashboard() {
    if (!dashboardData) return;
    const profile = dashboardData.profile || {};
    const earnings = dashboardData.earnings || {};
    const analytics = dashboardData.analytics || {};

    // Show mock-mode banner so the user knows this is a demo
    const mode = dashboardData.mode || 'unknown';
    const banner = document.getElementById('mode-banner');
    if (banner) {
      if (mode === 'mock') {
        banner.innerHTML = '🧪 <strong>Demo mode</strong> · Withdrawals are simulated (no real USDC moves on-chain). All other flows run end-to-end against the same backend a live deployment uses.';
        banner.className = 'mode-banner mode-mock';
        banner.style.display = 'block';
      } else if (mode === 'live') {
        banner.innerHTML = '🟢 <strong>Live mode</strong> · Withdrawals settle real USDC on Arc testnet. <a href="' + (dashboardData.arcscanBase || 'https://testnet.arcscan.app') + '" target="_blank" rel="noopener">View on Arcscan</a>';
        banner.className = 'mode-banner mode-live';
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
    }
    function safeUsd(v) {
      // earnings.* are numbers (e.g. 0.0146). Format as USD string safely.
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
      return Number.isFinite(n) ? '$' + n.toFixed(6) : '$0.000000';
    }

    document.getElementById('kpi-total-earned').textContent = safeUsd(earnings.total);
    document.getElementById('kpi-available').textContent = safeUsd(earnings.total);
    document.getElementById('kpi-streams').textContent = (analytics.totalStreams || 0).toLocaleString();
    document.getElementById('kpi-active').textContent = analytics.activeListeners || 0;
    document.getElementById('kpi-revenue-today').textContent = safeUsd(earnings.today);
    document.getElementById('kpi-revenue-week').textContent = safeUsd(earnings.thisWeek);
    document.getElementById('kpi-revenue-month').textContent = safeUsd(earnings.thisMonth);
    document.getElementById('kpi-lifetime').textContent = safeUsd(earnings.total);

    document.getElementById('earnings-available').textContent = safeUsd(earnings.total);
    document.getElementById('earnings-pending').textContent = '$0.000000';
    document.getElementById('earnings-lifetime').textContent = safeUsd(earnings.total);
    document.getElementById('withdraw-available').textContent = safeUsd(earnings.total);

    // Update wallet address in profile form
    const walletInput = document.getElementById('profile-wallet');
    if (walletInput && currentUser) walletInput.value = currentUser.wallet;
    const withdrawWallet = document.getElementById('withdraw-wallet');
    if (withdrawWallet && currentUser) withdrawWallet.value = currentUser.wallet;

    // Update topbar
    const topbar = document.getElementById('topbar-text');
    if (topbar) {
      const sellerAddr = dashboardData.profile?.wallet_address || dashboardData.creator?.wallet;
      topbar.innerHTML = `🟢 LIVE on Arc testnet · <a href="https://testnet.arcscan.app/address/${sellerAddr}" target="_blank" style="color:#00d4ff;">view earnings on Arcscan ↗</a>`;
    }

    // Notification badge
    const badge = document.getElementById('topbar-notifications');
    if (badge && dashboardData.unreadCount) {
      badge.innerHTML = `<span class="notif-badge">${dashboardData.unreadCount}</span>`;
      badge.onclick = () => document.getElementById('notifications').scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ─── Render tracks ───
  function renderTracks() {
    const list = document.getElementById('tracks-list');
    if (!filteredTracks.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No tracks yet</div>
        <div class="empty-state-message">Upload your first track to start earning per-second USDC.</div>
        <button class="btn btn-primary" onclick="document.getElementById('btn-show-upload').click()">Upload your first track →</button>
      </div>`;
      return;
    }
    list.innerHTML = filteredTracks.map(t => `
      <div class="creator-track-card glass-card" data-track-id="${escapeHtml(t.id)}">
        <div class="creator-track-cover">${getCategoryEmoji(t.category)}</div>
        <div class="creator-track-info">
          <div class="creator-track-title">${escapeHtml(t.title)}</div>
          <div class="creator-track-meta">
            ${formatDuration(t.duration_sec)} · ${t.plays || 0} plays · ${formatUsdc(t.price_per_sec)}/sec · ${escapeHtml(t.category || 'general')}
          </div>
          <div class="creator-track-desc">${escapeHtml(t.description || '')}</div>
        </div>
        <div class="creator-track-status status-${escapeHtml(t.status || 'published')}">${escapeHtml(t.status || 'published')}</div>
        <div class="creator-track-earnings">${formatUsdc(t.earnings_total || 0)}</div>
        <div class="creator-track-actions">
          ${(t.status === 'published')
            ? `<button class="btn btn-ghost btn-sm" onclick="CreatorDashboard.togglePublish('${escapeHtml(t.id)}', 'draft')">Unpublish</button>`
            : `<button class="btn btn-primary btn-sm" onclick="CreatorDashboard.togglePublish('${escapeHtml(t.id)}', 'published')">Publish</button>`
          }
          <button class="btn btn-ghost btn-sm" onclick="CreatorDashboard.deleteTrack('${escapeHtml(t.id)}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function renderMostStreamed() {
    const list = document.getElementById('most-streamed-list');
    if (!list) return;
    const top = (dashboardData?.analytics?.mostStreamed || []).slice(0, 5);
    if (!top.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No streams yet</div></div>`;
      return;
    }
    list.innerHTML = top.map((t, i) => `
      <div class="creator-track-card glass-card">
        <div class="creator-track-rank">#${i + 1}</div>
        <div class="creator-track-info">
          <div class="creator-track-title">${escapeHtml(t.title)}</div>
          <div class="creator-track-meta">${t.plays || 0} plays · ${formatUsdc(t.earnings_total || 0)} earned</div>
        </div>
      </div>
    `).join('');
  }

  function renderWithdrawals() {
    const list = document.getElementById('withdrawals-list');
    const withdrawals = dashboardData?.withdrawals || [];
    if (!withdrawals.length) return; // keep the empty state
    list.innerHTML = withdrawals.map(w => `
      <div class="withdrawal-card glass-card">
        <div class="withdrawal-amount">$${parseFloat(w.amount_usd).toFixed(6)}</div>
        <div class="withdrawal-meta">
          <span class="withdrawal-status status-${escapeHtml(w.status)}">${escapeHtml(w.status)}</span>
          <span>${new Date(w.created_at).toLocaleString()}</span>
          ${w.tx_hash ? `<a href="${w.tx_hash.startsWith('0xwd') ? 'https://testnet.arcscan.app/address/0xEb375940Cd0D85f06239d68C6e719c71907771f9' : 'https://testnet.arcscan.app/tx/' + w.tx_hash}" target="_blank" class="withdrawal-tx">View on Arcscan ↗</a>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderNotifications() {
    const list = document.getElementById('notifications-list');
    const notifications = dashboardData?.notifications || [];
    if (!notifications.length) return;
    list.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.is_read ? '' : 'unread'}">
        <div class="notification-icon">${n.kind === 'upload' ? '📤' : n.kind === 'withdrawal' ? '💸' : n.kind === 'payment' ? '💰' : '🔔'}</div>
        <div class="notification-body">
          <div class="notification-title">${escapeHtml(n.title)}</div>
          <div class="notification-text">${escapeHtml(n.body || '')}</div>
          <div class="notification-time">${new Date(n.created_at).toLocaleString()}</div>
        </div>
        ${!n.is_read ? `<button class="btn btn-ghost btn-sm" onclick="CreatorDashboard.markNotifRead('${n.id}')">Mark read</button>` : ''}
      </div>
    `).join('');
  }

  function renderProfile() {
    const profile = dashboardData?.profile || {};
    const form = document.getElementById('profile-form');
    if (!form) return;
    form.elements['displayName'].value = profile.display_name || '';
    form.elements['avatarUrl'].value = profile.avatar_url || '';
    form.elements['bio'].value = profile.bio || '';
    const links = profile.social_links || {};
    form.elements['twitter'].value = links.twitter || '';
    form.elements['github'].value = links.github || '';
    form.elements['website'].value = links.website || '';
  }

  // ─── Track actions ───
  function applyFilters() {
    const search = (document.getElementById('track-search').value || '').toLowerCase();
    const cat = document.getElementById('track-filter-category').value;
    const status = document.getElementById('track-filter-status').value;
    const sort = document.getElementById('track-sort').value;
    filteredTracks = tracks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search) && !(t.description || '').toLowerCase().includes(search)) return false;
      if (cat && t.category !== cat) return false;
      if (status && t.status !== status) return false;
      return true;
    });
    if (sort === 'newest') filteredTracks.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    else if (sort === 'earnings') filteredTracks.sort((a, b) => (b.earnings_total || 0) - (a.earnings_total || 0));
    else if (sort === 'popularity') filteredTracks.sort((a, b) => (b.plays || 0) - (a.plays || 0));
    else if (sort === 'title') filteredTracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    renderTracks();
  }

  async function togglePublish(trackId, newStatus) {
    try {
      const r = await authedFetch(`/api/creator/tracks/${trackId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error('Failed');
      showToast(`Track ${newStatus === 'published' ? 'published' : 'unpublished'}!`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  }

  async function deleteTrack(trackId) {
    if (!confirm('Delete this track? This cannot be undone.')) return;
    try {
      const r = await authedFetch(`/api/creator/tracks/${trackId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
      showToast('Track deleted', 'success');
      await loadDashboard();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  }

  async function markNotifRead(id) {
    try {
      await authedFetch(`/api/creator/notifications/${id}/read`, { method: 'POST' });
      await loadDashboard();
    } catch (err) {
      console.error(err);
    }
  }

  // ─── Upload ───
  function setupUploadForm() {
    const showBtn = document.getElementById('btn-show-upload');
    const cancelBtn = document.getElementById('btn-cancel-upload');
    const form = document.getElementById('upload-form');
    const formCard = document.getElementById('upload-form-card');
    const submitBtn = document.getElementById('btn-upload-submit');
    const draftBtn = document.getElementById('btn-save-draft');

    showBtn.onclick = () => {
      formCard.style.display = 'block';
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    cancelBtn.onclick = () => {
      formCard.style.display = 'none';
      form.reset();
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      uploadTrack(form, 'published');
    };
    draftBtn.onclick = () => uploadTrack(form, 'draft');

    // Auto-detect audio duration when file is selected
    const audioInput = form.querySelector('input[name="audio"]');
    const durationInput = form.querySelector('input[name="durationSec"]');
    if (audioInput && durationInput) {
      audioInput.addEventListener('change', async () => {
        const file = audioInput.files?.[0];
        if (!file) return;
        const detected = await detectAudioDuration(file);
        if (detected && detected > 0) {
          durationInput.value = Math.round(detected);
          const hint = durationInput.parentElement.querySelector('.form-hint, .duration-hint');
          if (hint) hint.textContent = `Auto-detected: ${Math.round(detected)}s from "${file.name}"`;
          showToast(`Detected duration: ${Math.round(detected)}s`, 'info');
        }
      });
    }
  }

  // Probe audio duration locally using HTML5 audio element
  async function detectAudioDuration(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.src = url;
    });
  }

  async function uploadTrack(form, status) {
    const submitBtn = document.getElementById('btn-upload-submit');
    const statusDiv = document.getElementById('upload-status');
    const progressDiv = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');

    statusDiv.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Uploading…';
    progressDiv.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Uploading…';

    try {
      const formData = new FormData(form);
      // Status is set via header so we can keep multipart upload simple
      const url = `${API_BASE}/api/creator/tracks?status=${status}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('X-User-Id', currentUser.id);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = `Uploading… ${pct}%`;
        }
      };
      xhr.onload = () => {
        progressDiv.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish track';
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          statusDiv.innerHTML = `<div class="status-success">✓ Track ${status === 'published' ? 'published' : 'saved as draft'}!</div>`;
          form.reset();
          document.getElementById('upload-form-card').style.display = 'none';
          showToast(`Track ${status === 'published' ? 'published' : 'saved'}!`, 'success');
          loadDashboard();
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            // Map error codes to user-friendly messages
            const friendly = {
              title_required: 'Please enter a title for your track',
              title_too_long: 'Title must be 200 characters or less',
              audio_file_required: 'Please select an audio file (MP3, WAV, or M4A)',
              unsupported_file_format: err.reason || 'That file format is not supported. Try MP3, WAV, or M4A',
              file_too_large: err.reason || 'File is too large (max 50MB)',
              invalid_price: err.reason || 'Price must be between 1 and 10000 micro-USDC',
              invalid_duration: err.reason || 'Duration is invalid',
              unexpected_field: err.reason || 'Unexpected form field',
              too_many_files: err.reason || 'Too many files',
              upload_failed: err.reason || 'Upload failed',
              missing_user_id: 'Please sign in to upload',
              unknown_user: 'Session expired. Please sign in again',
            };
            const msg = friendly[err.error] || err.reason || err.error || 'Upload failed';
            statusDiv.innerHTML = `<div class="status-error">✗ ${msg}<br><small style="opacity:0.7">${err.error || ''} ${err.reason ? '· ' + err.reason : ''}</small></div>`;
            showToast(msg, 'error');
          } catch {
            statusDiv.innerHTML = `<div class="status-error">✗ Upload failed (HTTP ${xhr.status})</div>`;
            showToast(`Upload failed (HTTP ${xhr.status})`, 'error');
          }
        }
      };
      xhr.onerror = () => {
        progressDiv.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish track';
        statusDiv.innerHTML = `<div class="status-error">✗ Network error during upload</div>`;
      };
      xhr.send(formData);
    } catch (err) {
      progressDiv.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish track';
      statusDiv.innerHTML = `<div class="status-error">✗ ${err.message}</div>`;
    }
  }

  // ─── Profile form ───
  function setupProfileForm() {
    const form = document.getElementById('profile-form');
    const status = document.getElementById('profile-status');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        displayName: form.elements['displayName'].value,
        avatarUrl: form.elements['avatarUrl'].value,
        bio: form.elements['bio'].value,
        socialLinks: {
          twitter: form.elements['twitter'].value,
          github: form.elements['github'].value,
          website: form.elements['website'].value,
        },
      };
      try {
        const r = await authedFetch('/api/creator/profile', {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (!r.ok) throw new Error('Failed');
        status.innerHTML = `<div class="status-success">✓ Profile saved</div>`;
        showToast('Profile saved', 'success');
        await loadDashboard();
      } catch (err) {
        status.innerHTML = `<div class="status-error">✗ ${err.message}</div>`;
      }
    };
  }

  // ─── Withdraw ───
  function setupWithdraw() {
    const allBtn = document.getElementById('btn-withdraw-all');
    const modal = document.getElementById('withdraw-modal');
    const form = document.getElementById('withdraw-form');
    const cancelBtn = document.getElementById('btn-cancel-withdraw');
    const submitBtn = document.getElementById('btn-withdraw-submit');
    const statusDiv = document.getElementById('withdraw-status');
    const amountInput = document.getElementById('withdraw-amount');

    allBtn.onclick = () => {
      // earnings.total is a NUMBER from the API (e.g. 0.0146), not a string.
      // Calling .replace() on a number throws TypeError — coerce to string first.
      const raw = dashboardData?.earnings?.total;
      const available = typeof raw === 'number' ? raw : parseFloat(String(raw || 0));
      const safe = Number.isFinite(available) && available > 0 ? available : 0;
      amountInput.value = safe.toFixed(6);
      modal.style.display = 'flex';
    };
    cancelBtn.onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) {
        statusDiv.innerHTML = `<div class="status-error">✗ Enter a positive amount</div>`;
        return;
      }
      // Show confirmation as a toast with Cancel/Confirm buttons instead of native confirm()
      const confirmed = await new Promise((resolve) => {
        const toast = document.createElement('div');
        toast.className = 'confirm-toast';
        toast.innerHTML = `
          <div class="confirm-toast-body">
            <div class="confirm-toast-msg">Confirm withdrawal of <strong>$${amount.toFixed(6)} USDC</strong> to your wallet?</div>
            <div class="confirm-toast-actions">
              <button class="btn btn-ghost btn-sm" id="confirm-no">Cancel</button>
              <button class="btn btn-primary btn-sm" id="confirm-yes">Confirm</button>
            </div>
          </div>
        `;
        document.body.appendChild(toast);
        toast.querySelector('#confirm-no').onclick = () => { toast.remove(); resolve(false); };
        toast.querySelector('#confirm-yes').onclick = () => { toast.remove(); resolve(true); };
        // Auto-cancel after 30s
        setTimeout(() => { if (toast.parentNode) { toast.remove(); resolve(false); } }, 30000);
      });
      if (!confirmed) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Withdrawing…';
      try {
        const r = await authedFetch('/api/creator/withdraw', {
          method: 'POST',
          body: JSON.stringify({ amountUsd: amount.toString() }),
        });
        const data = await r.json();
        if (!r.ok) {
          const friendly = {
            insufficient_earnings: `Insufficient earnings. You have $${(data.available != null ? data.available : 0).toFixed(6)} available.`,
          };
          throw new Error(friendly[data.error] || data.error || 'Withdraw failed');
        }
        statusDiv.innerHTML = `<div class="status-success">✓ Withdrawal successful! ${data.arcscanUrl ? `<a href="${data.arcscanUrl}" target="_blank">View on Arcscan ↗</a>` : ''}</div>`;
        showToast(`Withdrawal successful!`, 'success');
        setTimeout(() => {
          modal.style.display = 'none';
          loadDashboard();
        }, 2000);
      } catch (err) {
        statusDiv.innerHTML = `<div class="status-error">✗ ${err.message}</div>`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm withdrawal';
      }
    };
  }

  // ─── Init ───
  async function init() {
    loadUser();
    setupAuthBar();
    if (!currentUser) {
      // Show login prompt
      const email = await showLoginModal();
      if (email) {
        try {
          await login(email.trim().toLowerCase());
          location.reload();
          return;
        } catch (err) {
          showToast('Login failed: ' + err.message, 'error');
        }
      }
      return;
    }
    setupUploadForm();
    setupProfileForm();
    setupWithdraw();
    document.getElementById('track-search').addEventListener('input', applyFilters);
    document.getElementById('track-filter-category').addEventListener('change', applyFilters);
    document.getElementById('track-filter-status').addEventListener('change', applyFilters);
    document.getElementById('track-sort').addEventListener('change', applyFilters);
    await loadDashboard();
  }

  // Expose
  window.CreatorDashboard = {
    init,
    togglePublish,
    deleteTrack,
    markNotifRead,
  };
})();
