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

    let res;
    try {
      res = await DV.utils.fetchWithTimeout(url, { mode: 'cors', redirect: 'follow', headers: { 'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' } });
    } catch (err) {
      const msg = String(err?.message || err);
      if (/abort/i.test(msg)) throw new Error('Network timeout while fetching URL');
      res = null;
    }
    if (!res || !res.ok) {
      const proxied = '/api/fetch?url=' + encodeURIComponent(url);
      try {
        res = await DV.utils.fetchWithTimeout(proxied, { redirect: 'follow' });
      } catch (e) {
        const msg = String(e?.message || e);
        if (/abort/i.test(msg)) throw new Error('Network timeout while fetching URL (proxy)');
        throw new Error('Fetch failed and proxy fallback failed: ' + msg);
      }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (res.statusText || '') + ' (via proxy)');
    }

    const finalUrl = res.headers.get('x-final-url') || res.url || url;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();

    if (ctype.includes('text/plain') || !/html/.test(ctype)) {
      const text = DV.utils.normalizeText(body);
      const title = finalUrl;
      return { kind: 'url', url: finalUrl, title, text };
    }

    const doc = new DOMParser().parseFromString(body, 'text/html');
    DV.utils.cleanHtml(doc);
    const node = DV.utils.pickMainNode(doc);
    const title = metaTitle(doc, finalUrl);
    const main = node?.innerText || doc.body?.innerText || '';
    const text = DV.utils.normalizeText(main);

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
    let res;
    try {
      res = await DV.utils.fetchWithTimeout(url, { mode: 'cors', redirect: 'follow', headers: { 'Accept': 'text/html,*/*;q=0.5' } }, 7000);
    } catch {
      try { res = await DV.utils.fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(url), {}, 8000); } catch { res = null; }
    }
    if (!res || !res.ok) return null;
    const finalUrl = res.headers.get('x-final-url') || res.url || url;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!/html/.test(ctype)) return { url: finalUrl, title: finalUrl };
    const body = await res.text();
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