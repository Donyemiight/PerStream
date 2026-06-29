/**
 * PerStream — Feedback Widget
 *
 * 5-star rating + comment box + optional email + early-access CTA.
 * Stores feedback via POST /api/feedback (or demo-mode mock).
 * Stores leads via POST /api/lead.
 */

(function() {
  'use strict';

  // Use the configured API base (injected by the host page or default to current origin).
  // window.PERSTREAM_API is set on every deployed HTML page (see PROD build).
  const API_BASE = (typeof window !== 'undefined' && window.PERSTREAM_API) ||
                   (typeof window !== 'undefined' && window.location && window.location.origin) ||
                   '';

  // ── Build the widget HTML ──
  function buildWidgetHTML() {
    return `
      <div class="feedback-widget">
        <div class="fw-header">
          <h3>How was your experience?</h3>
          <p>Rate this demo and tell us what you think.</p>
        </div>

        <div class="fw-stars" id="fw-stars">
          ${[1,2,3,4,5].map(n => `<button class="fw-star" data-rating="${n}" aria-label="${n} star">★</button>`).join('')}
        </div>

        <textarea class="fw-comment" id="fw-comment" rows="3" placeholder="What's working? What's not? (optional)" maxlength="2000"></textarea>

        <div class="fw-actions">
          <input type="email" class="fw-email" id="fw-email" placeholder="Your email (optional, for follow-up)" />
          <button class="btn btn-primary fw-submit" id="fw-submit">Submit feedback</button>
        </div>

        <div class="fw-status" id="fw-status"></div>

        <div class="fw-divider"></div>

        <div class="fw-early-access">
          <h4>Want this for your podcast?</h4>
          <p>Join the early-access list. We'll email you when creator onboarding opens.</p>
          <div class="fw-lead-row">
            <input type="email" class="fw-lead-email" id="fw-lead-email" placeholder="your@email.com" />
            <select class="fw-lead-role" id="fw-lead-role">
              <option value="">I'm a...</option>
              <option value="podcaster">Podcaster</option>
              <option value="creator">Content creator</option>
              <option value="developer">Developer</option>
              <option value="agent-builder">AI agent builder</option>
              <option value="other">Other</option>
            </select>
            <button class="btn btn-primary fw-lead-submit" id="fw-lead-submit">Get early access</button>
          </div>
          <div class="fw-lead-status" id="fw-lead-status"></div>
        </div>
      </div>
    `;
  }

  // ── Insert widget + styles ──
  function injectStyles() {
    if (document.getElementById('fw-styles')) return;
    const s = document.createElement('style');
    s.id = 'fw-styles';
    s.textContent = `
      .feedback-widget {
        max-width: 720px;
        margin: 3rem auto;
        padding: 2rem;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
      }
      .feedback-widget .fw-header { margin-bottom: 1.5rem; }
      .feedback-widget h3 { font-size: 1.4rem; margin-bottom: 0.5rem; }
      .feedback-widget h4 { font-size: 1.1rem; margin-bottom: 0.5rem; }
      .feedback-widget p { color: var(--text-dim); font-size: 0.95rem; }
      .fw-stars { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
      .fw-star {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text-dim);
        font-size: 1.8rem;
        padding: 0.25rem 0.75rem;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .fw-star:hover, .fw-star.active {
        color: var(--accent-3);
        border-color: var(--accent-3);
      }
      .fw-comment {
        width: 100%;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.75rem;
        color: var(--text);
        font-family: inherit;
        font-size: 0.95rem;
        resize: vertical;
        margin-bottom: 1rem;
      }
      .fw-comment:focus { outline: none; border-color: var(--accent); }
      .fw-actions {
        display: flex;
        gap: 0.75rem;
        align-items: stretch;
        flex-wrap: wrap;
      }
      .fw-email, .fw-lead-email {
        flex: 1;
        min-width: 200px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.6rem 0.9rem;
        color: var(--text);
        font-family: inherit;
        font-size: 0.9rem;
      }
      .fw-email:focus, .fw-lead-email:focus { outline: none; border-color: var(--accent); }
      .fw-submit, .fw-lead-submit { white-space: nowrap; }
      .fw-status, .fw-lead-status { margin-top: 0.75rem; font-size: 0.9rem; min-height: 1.2rem; }
      .fw-status.success, .fw-lead-status.success { color: var(--success); }
      .fw-status.error, .fw-lead-status.error { color: var(--danger); }
      .fw-divider {
        height: 1px;
        background: var(--border);
        margin: 2rem 0;
      }
      .fw-early-access h4 { color: var(--accent); }
      .fw-lead-row {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }
      .fw-lead-role {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.6rem 0.9rem;
        color: var(--text);
        font-family: inherit;
        font-size: 0.9rem;
      }
      @media (max-width: 600px) {
        .fw-actions, .fw-lead-row { flex-direction: column; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Wire up interactions ──
  function setupInteractions() {
    let selectedRating = 0;

    // Stars
    const stars = document.querySelectorAll('.fw-star');
    stars.forEach(star => {
      star.addEventListener('mouseenter', () => {
        const r = parseInt(star.dataset.rating, 10);
        stars.forEach((s, i) => s.classList.toggle('active', i < r));
      });
      star.addEventListener('mouseleave', () => {
        stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
      });
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.rating, 10);
        stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
      });
    });

    // Submit feedback
    const fwSubmit = document.getElementById('fw-submit');
    if (fwSubmit) fwSubmit.addEventListener('click', async () => {
      if (!selectedRating) {
        setStatus('fw-status', 'Please pick a rating first.', 'error');
        return;
      }
      const comment = document.getElementById('fw-comment').value.trim();
      const email = document.getElementById('fw-email').value.trim();

      setStatus('fw-status', 'Submitting…', '');
      try {
        const body = JSON.stringify({
          rating: selectedRating,
          comment,
          userEmail: email || null,
          page: window.location.pathname,
        });
        const r = await fetch(`${API_BASE}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await r.json();
        if (data.ok) {
          setStatus('fw-status', `✓ Thanks! Your ${selectedRating}-star rating was recorded.`, 'success');
          document.getElementById('fw-comment').value = '';
          selectedRating = 0;
          stars.forEach(s => s.classList.remove('active'));
        } else {
          setStatus('fw-status', `Failed: ${data.error || 'unknown'}`, 'error');
        }
      } catch (err) {
        setStatus('fw-status', `Network error: ${err.message}`, 'error');
      }
    });

    // Submit early-access lead
    const fwLeadSubmit = document.getElementById('fw-lead-submit');
    if (fwLeadSubmit) fwLeadSubmit.addEventListener('click', async () => {
      const email = document.getElementById('fw-lead-email').value.trim();
      const role = document.getElementById('fw-lead-role').value;
      if (!email || !email.includes('@')) {
        setStatus('fw-lead-status', 'Please enter a valid email.', 'error');
        return;
      }
      setStatus('fw-lead-status', 'Submitting…', '');
      try {
        const body = JSON.stringify({ email, role, source: window.location.pathname });
        const r = await fetch(`${API_BASE}/api/lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await r.json();
        if (data.ok) {
          setStatus('fw-lead-status', `✓ You're on the list. We'll email ${email} when creator onboarding opens.`, 'success');
          document.getElementById('fw-lead-email').value = '';
        } else {
          setStatus('fw-lead-status', `Failed: ${data.error || 'unknown'}`, 'error');
        }
      } catch (err) {
        setStatus('fw-lead-status', `Network error: ${err.message}`, 'error');
      }
    });
  }

  function setStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'fw-status' + (type ? ' ' + type : '');
  }

  // ── Boot ──
  function boot() {
    try {
      injectStyles();
      const container = document.getElementById('feedback-widget-container');
      if (!container) {
        // Page has no widget container — nothing to wire up.
        return;
      }
      container.innerHTML = buildWidgetHTML();
      setupInteractions();
      console.log('[feedback-widget] ready');
    } catch (err) {
      console.error('[feedback-widget] boot failed:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();