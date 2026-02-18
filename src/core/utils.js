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
   * Strip dangerous tags and attributes from HTML string using DOMParser.
   * Removes <script>, <iframe>, <object>, <embed>, <form> and on* events / javascript: links.
   * @param {string} html
   * @returns {string}
   */
  function sanitizeHtml(html) {
    if (!html) return '';
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const badTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'];
      badTags.forEach(tag => doc.querySelectorAll(tag).forEach(n => n.remove()));

      const all = doc.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        for (let j = el.attributes.length - 1; j >= 0; j--) {
          const attr = el.attributes[j];
          if (attr.name.startsWith('on') || (attr.value && attr.value.trim().toLowerCase().startsWith('javascript:'))) {
            el.removeAttribute(attr.name);
          }
        }
      }
      return doc.body.innerHTML;
    } catch (e) { return escapeHtml(html); }
  }

  /**
   * Wrap raw AI model output in a minimal HTML document for rendering.
   * @param {string} inner
   * @param {string} [title]
   * @returns {string}
   */
  function wrapHtml(inner, title = 'Distilled') {
    const clean = sanitizeHtml(inner);
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:20px;color:#0f172a}h1,h2,h3{margin:16px 0 8px}p{margin:10px 0;}pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto}</style></head><body>${clean}</body></html>`;
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

  /**
   * Detect a source tag from a URL, item kind, or file type.
   * Returns a lowercase source identifier (e.g. 'youtube', 'substack', 'pdf').
   * @param {string} [url]
   * @param {string} [kind]  - 'url' | 'youtube' | 'file'
   * @param {string} [fileType] - MIME type for file items
   * @param {string} [fileName] - original filename
   * @returns {string}
   */
  function detectSourceTag(url, kind, fileType, fileName) {
    // File-based detection
    if (kind === 'file') {
      const ext = (fileName || '').split('.').pop().toLowerCase();
      const mime = (fileType || '').toLowerCase();
      if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
      if (/docx?$/.test(ext) || /word|document/.test(mime)) return 'document';
      if (/^image\//.test(mime) || /^(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i.test(ext)) return 'image';
      if (/^(txt|md|csv|tsv|log)$/i.test(ext) || /^text\//.test(mime)) return 'text';
      return 'file';
    }

    // YouTube shortcut
    if (kind === 'youtube') return 'youtube';

    // URL-based detection
    const u = (url || '').toLowerCase();
    let hostname = '';
    try { hostname = new URL(u).hostname.replace(/^www\./, ''); } catch { }

    if (!hostname) return 'web';

    const rules = [
      [/youtube\.com|youtu\.be/, 'youtube'],
      [/\.substack\.com$|^substack\.com$/, 'substack'],
      [/medium\.com/, 'medium'],
      [/github\.com/, 'github'],
      [/arxiv\.org/, 'arxiv'],
      [/wikipedia\.org/, 'wikipedia'],
      [/reddit\.com/, 'reddit'],
      [/twitter\.com|^x\.com$/, 'x'],
      [/nytimes\.com/, 'nytimes'],
      [/bbc\.com|bbc\.co\.uk/, 'bbc'],
      [/theguardian\.com/, 'guardian'],
      [/stackoverflow\.com/, 'stackoverflow'],
      [/hackernews|news\.ycombinator\.com/, 'hackernews'],
      [/linkedin\.com/, 'linkedin'],
      [/notion\.so|notion\.site/, 'notion'],
    ];
    for (const [re, tag] of rules) {
      if (re.test(hostname)) return tag;
    }
    return 'web';
  }

  /**
   * Human-readable relative time string from a timestamp.
   * @param {number} ts - Unix timestamp in milliseconds
   * @returns {string}
   */
  function relativeTime(ts) {
    if (!ts) return '-';
    const diff = Date.now() - ts;
    const abs = Math.abs(diff);
    if (abs < 60000) return 'just now';
    if (abs < 3600000) return Math.floor(abs / 60000) + 'm ago';
    if (abs < 86400000) return Math.floor(abs / 3600000) + 'h ago';
    if (abs < 604800000) return Math.floor(abs / 86400000) + 'd ago';
    // Older than 7 days — show date
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${mon}/${d.getFullYear()}`;
  }

  window.DV = window.DV || {};
  window.DV.utils = { escapeHtml, wrapHtml, sanitizeHtml, normalizeText, fetchWithTimeout, detectSourceTag, relativeTime };
})();
