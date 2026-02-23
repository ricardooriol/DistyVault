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

    let res = null;
    const timeout = 30000;
    const isStealthDomain = /substack\.com|thedankoe\.com|beehiiv\.com|medium\.com|bytebytego\.com|ghost\.io|beehiiv\.com|newsletter/.test(url);
    const useProxyFirst = isStealthDomain || url.includes('youtube.com') || url.includes('youtu.be');

    // Helper to check if body looks like a 'blocked' page
    const isBlocked = (html) => {
      if (!html) return true;
      const h = html.toLowerCase();
      return (h.includes('enable javascript') || h.includes('access denied') || h.includes('checking your browser')) && h.length < 1000;
    };

    // Attempt 1: Direct Fetch (Skip for known blockers to avoid ugly console errors)
    if (!useProxyFirst) {
      try {
        res = await DV.utils.fetchWithTimeout(url, { mode: 'cors', redirect: 'follow' }, timeout);
      } catch (e) { res = null; }
    }

    // Attempt 2: Local API Proxy (Our most powerful steering)
    if (!res || !res.ok) {
      try {
        res = await DV.utils.fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(url), { redirect: 'follow' }, timeout);
      } catch (e) { res = null; }
    }

    // Attempt 3: Public Proxy (Last resort)
    if (!res || !res.ok) {
      try {
        res = await DV.utils.fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(url), { redirect: 'follow' }, timeout);
      } catch (e) { res = null; }
    }

    if (!res || !res.ok) {
      const ao = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
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
    let res = null;
    const isNewsletter = /substack\.com|thedankoe\.com|beehiiv\.com|medium\.com/.test(url);

    if (!isNewsletter) {
      try {
        res = await DV.utils.fetchWithTimeout(url, { mode: 'cors', redirect: 'follow', headers: { 'Accept': 'text/html,*/*;q=0.5' } }, 7000);
      } catch { res = null; }
    }

    if (!res || !res.ok) {
      try { res = await DV.utils.fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(url), {}, 8000); } catch { res = null; }
      if (!res || !res.ok) {
        try { res = await DV.utils.fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(url), {}, 8000); } catch { res = null; }
      }
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