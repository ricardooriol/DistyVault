(function() {
  /**
   * Shared utility functions used across DistyVault modules.
   * Eliminates duplication of common helpers (escaping, text normalization,
   * fetch with timeout, provider HTML wrapping).
   */

  /**
   * Escape a string for safe inclusion in HTML text nodes or attributes.
   * @param {string} [s]
   * @returns {string}
   */
  function escapeHtml(s = '') {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /**
   * Wrap raw AI model output in a minimal HTML document for rendering.
   * @param {string} inner
   * @param {string} [title]
   * @returns {string}
   */
  function wrapHtml(inner, title = 'Distilled') {
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${inner}</body></html>`;
  }

  /**
   * Normalize whitespace and remove invisible/non-printable characters.
   * @param {string} [s]
   * @returns {string}
   */
  function normalizeText(s = '') {
    return String(s)
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
      .trim();
  }

  /**
   * Fetch with an abort timeout; does not swallow non-timeout errors.
   * @param {string} url
   * @param {object} [opts]
   * @param {number} [ms=15000]
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, opts = {}, ms = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  window.DV = window.DV || {};
  window.DV.utils = { escapeHtml, wrapHtml, normalizeText, fetchWithTimeout };
})();
