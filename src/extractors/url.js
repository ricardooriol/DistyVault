(function () {
  /** Ensure URL has a scheme, defaulting to https. */
  function normalizeUrl(input = '') {
    const s = String(input).trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s) && !/^[a-z]+:\/\//i.test(s)) return 'https://' + s;
    return s;
  }



  /** Determine a clean page title from meta and markup. */
  function metaTitle(doc, url) {
    const mt = doc.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content?.trim();
    const h1 = doc.querySelector('h1')?.textContent?.trim();
    let t = doc.querySelector('title')?.textContent?.trim();
    const clean = (s = '') => s.replace(/\s*[|\-–—·•:]\s*.+$/, '').trim();
    const best = mt || h1 || t || url;
    return clean(best);
  }

  /**
   * Extract main readable text from a URL. Attempts direct CORS fetch first, then
   * falls back to server-side proxy at /api/fetch. Returns plain text when content-type
   * is non-HTML.
   */
  async function extractFromUrl(itemOrUrl) {
    let url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl?.url || '');
    url = normalizeUrl(url);
    if (!url) throw new Error('No URL');

    const isTwitter = /^(https?:\/\/)?(www\.)?(twitter|x)\.com\//i.test(url);
    let fetchUrl = isTwitter ? 'https://r.jina.ai/' + url : url;

    let res = null;
    const timeout = 30000;

    // Helper to check if body looks like a 'blocked' page
    const isBlocked = (html) => {
      if (!html) return true;
      const h = html.toLowerCase();
      // Added 'just a moment...' to catch general CloudFlare blocks universally
      return (h.includes('enable javascript') || h.includes('access denied') || h.includes('checking your browser') || h.includes('just a moment')) && h.length < 1500;
    };

    // Attempt 1: Local API Proxy (Our most powerful steering, universally applied to prevent browser CORS errors)
    try {
      res = await DV.utils.fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(fetchUrl), { redirect: 'follow' }, timeout);
    } catch (e) { res = null; }

    // Attempt 2: Public Proxy (Last resort)
    if (!isTwitter && (!res || !res.ok)) {
      try {
        res = await DV.utils.fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(fetchUrl), { redirect: 'follow' }, timeout);
      } catch (e) { res = null; }
    }

    if (!isTwitter && (!res || !res.ok)) {
      const ao = `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`;
      try {
        res = await DV.utils.fetchWithTimeout(ao, { redirect: 'follow' }, timeout);
      } catch (e) { res = null; }
    }

    if (!res || !res.ok) {
      throw new Error(`Bypass Exhausted: ${url} is heavily protected. Copy/Paste the text manually into a .txt file and drag it here.`);
    }

    const finalUrl = res.headers.get('x-final-url') || res.url || url;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();

    if (isBlocked(body)) {
      throw new Error('CORS block detected: The site returned a "JS required" or "Access Denied" page.');
    }

    if (ctype.includes('text/plain') || !/html/.test(ctype)) {
      const text = DV.utils.normalizeText(body);
      let title = isTwitter ? url : finalUrl;
      if (isTwitter) {
        const titleMatch = body.match(/^Title:\s*(.+)$/m);
        if (titleMatch) title = titleMatch[1].trim();
      }
      return { kind: 'url', url: isTwitter ? url : finalUrl, title, text };
    }

    const doc = new DOMParser().parseFromString(body, 'text/html');
    DV.utils.cleanHtml(doc);
    const title = metaTitle(doc, finalUrl);

    // Use Readability from CDN to get pure signal
    let text = '';
    if (window.Readability) {
      const clone = doc.cloneNode(true);
      const reader = new window.Readability(clone);
      const article = reader.parse();
      text = DV.utils.normalizeText(article?.textContent || doc.body?.innerText || '');
    } else {
      const node = DV.utils.pickMainNode(doc);
      text = DV.utils.normalizeText(node?.innerText || doc.body?.innerText || '');
    }

    if (!text) throw new Error('No readable text found');
    return { kind: 'url', url: finalUrl, title, text };
  }

  /**
   * Lightweight title peek without full extraction. Uses direct fetch, then proxy, and
   * attempts to parse title from HTML when content-type permits.
   */
  async function peekTitle(inputUrl) {
    let url = normalizeUrl(inputUrl);
    if (!url) return null;
    let res = null;

    const isTwitter = /^(https?:\/\/)?(www\.)?(twitter|x)\.com\//i.test(url);
    const fetchUrl = isTwitter ? 'https://r.jina.ai/' + url : url;

    try { res = await DV.utils.fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(fetchUrl), {}, 8000); } catch { res = null; }

    if (!isTwitter && (!res || !res.ok)) {
      try { res = await DV.utils.fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(fetchUrl), {}, 8000); } catch { res = null; }
    }
    if (!res || !res.ok) return null;

    const finalUrl = res.headers.get('x-final-url') || res.url || url;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();

    if (isTwitter) {
      const titleMatch = body.match(/^Title:\s*(.+)$/m);
      if (titleMatch) return { url, title: titleMatch[1].trim() };
      return { url, title: url };
    }

    if (!/html/.test(ctype)) return { url: finalUrl, title: finalUrl };
    try {
      const doc = new DOMParser().parseFromString(body, 'text/html');
      const title = metaTitle(doc, finalUrl);
      return { url: finalUrl, title };
    } catch { return { url: finalUrl, title: finalUrl }; }
  }

  window.DV = window.DV || {};
  window.DV.extractors = window.DV.extractors || {};
  window.DV.extractors.extractUrl = extractFromUrl;
  window.DV.extractors.peekTitle = peekTitle;
})();