/**
 * PerStream Error Overlay — shows JS errors on the page itself.
 * Critical for debugging "features not working" reports.
 */
(function() {
  'use strict';
  function showError(title, msg, stack) {
    let el = document.getElementById('perstream-error-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'perstream-error-overlay';
      el.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#ef4444; color:#fff; padding:16px; font-family:monospace; font-size:13px; z-index:99999; max-height:50vh; overflow:auto; box-shadow:0 4px 16px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.innerHTML = '<div style="font-weight:700; margin-bottom:8px;">⚠ ' + title + '</div>' +
      '<div>' + msg + '</div>' +
      (stack ? '<pre style="margin-top:8px; font-size:11px; opacity:0.8; white-space:pre-wrap;">' + stack + '</pre>' : '') +
      '<button onclick="document.getElementById(\'perstream-error-overlay\').remove()" style="margin-top:8px; background:#fff; color:#ef4444; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Dismiss</button>';
  }
  window.addEventListener('error', function(e) {
    showError('JavaScript error: ' + (e.message || 'unknown'), (e.filename || '') + ':' + (e.lineno || ''), e.error && e.error.stack ? e.error.stack : '');
  });
  window.addEventListener('unhandledrejection', function(e) {
    showError('Promise rejection: ' + (e.reason && e.reason.message || String(e.reason)), '', e.reason && e.reason.stack ? e.reason.stack : '');
  });
  // Show page ready indicator
  window.addEventListener('DOMContentLoaded', function() {
    console.log('[perstream] DOMContentLoaded fired');
  });
  window.addEventListener('load', function() {
    console.log('[perstream] window.load fired');
  });
})();
