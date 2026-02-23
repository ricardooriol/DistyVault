(function () {
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
   * Normalize whitespace, remove non-printable characters, and collapse multiple spaces.
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
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  /**
   * Decode HTML entities safely using a DOMParser.
   * @param {string} [html]
   * @returns {string}
   */
  function decodeEntities(html = '') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.documentElement.textContent || '';
    } catch { return html; }
  }

  /**
   * Remove noisy/non-content elements from a DOM Document.
   * @param {Document} doc
   */
  function cleanHtml(doc) {
    if (!doc) return;
    const selectors = 'script,style,noscript,template,iframe,canvas,svg,form,header,footer,nav,aside,menu,dialog,button,input,textarea,select';
    doc.querySelectorAll(selectors).forEach(n => n.remove());
    doc.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display:none" i], [style*="visibility:hidden" i]').forEach(n => n.remove());
    // Remove obvious junk by heuristic keywords
    const junk = ['ad', 'ads', 'advert', 'promo', 'subscribe', 'newsletter', 'cookie', 'banner', 'social', 'share', 'breadcrumb', 'pagination'];
    doc.querySelectorAll('*').forEach(el => {
      const cls = (el.className || '').toString().toLowerCase();
      const id = (el.id || '').toLowerCase();
      const tag = el.tagName?.toLowerCase?.() || '';
      if (junk.some(j => cls.includes(j) || id.includes(j))) {
        if (!/(article|main|section|content|post|entry)/.test(tag)) el.remove();
      }
    });
  }

  /**
   * Attempt to find the most likely main content node.
   * @param {Document} doc
   * @returns {HTMLElement}
   */
  function pickMainNode(doc) {
    if (!doc?.body) return null;
    const candidates = Array.from(doc.querySelectorAll('article, main, [role="main"], #content, .content, .post, .entry, .article, .main-content'));
    let best = null, max = 0;
    const score = (el) => {
      const text = (el.innerText || '').trim();
      const pCount = el.querySelectorAll('p').length;
      const hCount = el.querySelectorAll('h1,h2,h3').length;
      return text.length + pCount * 100 + hCount * 50;
    };
    for (const el of candidates) {
      const s = score(el);
      if (s > max) { max = s; best = el; }
    }
    if (best && (best.innerText || '').trim().length > 200) return best;

    // Second pass: just find largest text container
    best = doc.body; max = 0;
    doc.querySelectorAll('section, div').forEach(n => {
      const t = (n.innerText || '').trim();
      if (t.length > max) { max = t.length; best = n; }
    });
    return best || doc.body;
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

  /**
   * Combine CSS classes conditionally.
   */
  function classNames(...arr) {
    return arr.filter(Boolean).join(' ');
  }

  /**
   * Yield control to the browser for UI responsiveness.
   */
  async function yieldToBrowser() {
    return new Promise(resolve => {
      if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(() => resolve());
      if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(() => resolve());
      setTimeout(resolve, 0);
    });
  }

  /**
   * Save a Blob to disk with multi-platform compatibility.
   * @param {Blob} blob
   * @param {string} filename
   */
  async function saveBlob(blob, filename) {
    const ua = typeof navigator !== 'undefined' ? navigator : null;
    const isMobile = !!(ua && (
      (ua.userAgentData && ua.userAgentData.mobile) ||
      /Android|iPhone|iPad|iPod/i.test(ua.userAgent || '') ||
      ((ua.platform === 'MacIntel' || ua.platform === 'MacPPC') && ua.maxTouchPoints > 1)
    ));
    const isIOS = !!(ua && (/iPad|iPhone|iPod/i.test(ua.userAgent || '') || ((ua.platform === 'MacIntel' || ua.platform === 'MacPPC') && ua.maxTouchPoints > 1)));
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    try {
      if (!isIOS && window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: ['.' + (filename.split('.').pop() || 'bin')] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (e) { if (/AbortError|NotAllowedError|cancell?ed/i.test(e?.name || e?.message || '')) return; }

    try {
      const supportsShare = !!(ua?.share && ua?.canShare && ua.canShare({ files: [file] }));
      if (isMobile && supportsShare) { await ua.share({ files: [file], title: filename }); return; }
    } catch (e) { if (/AbortError|NotAllowedError|cancell?ed/i.test(e?.name || e?.message || '')) return; }

    if (isIOS) {
      const url = URL.createObjectURL(blob);
      try { window.open(url, '_blank'); } finally { setTimeout(() => URL.revokeObjectURL(url), 10000); }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  /**
   * Format duration in ms as "Xm Ys" or "Xs".
   */
  function formatDuration(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}m ${r}s`;
  }

  /**
   * Sanitize filename and strip common extensions.
   */
  function sanitizeFilename(s = '') {
    let out = String(s || '').trim()
      .replace(/\.(pdf|docx?|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '')
      .replace(/[^a-z0-9 _-]+/ig, '_')
      .slice(0, 80) || 'file';
    return out.trim();
  }

  window.DV = window.DV || {};
  window.DV.utils = {
    escapeHtml, wrapHtml, normalizeText, decodeEntities, cleanHtml, pickMainNode,
    fetchWithTimeout, classNames, yieldToBrowser, saveBlob, formatDuration, sanitizeFilename
  };
})();
