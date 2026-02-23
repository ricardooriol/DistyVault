(function(){
  /** Ensure URL has a scheme, defaulting to https. */
  function normalizeUrl(input=''){
    const s = String(input).trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s) && !/^[a-z]+:\/\//i.test(s)) return 'https://' + s;
    return s;
  }

  /** Remove non-content elements and obvious chrome/junk by classname/id heuristics. */
  function cleanDoc(doc){
    doc.querySelectorAll('script,style,noscript,template,iframe,canvas,svg,form,header,footer,nav,aside,menu,dialog').forEach(n=>n.remove());
    doc.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display:none" i], [style*="visibility:hidden" i]').forEach(n=>n.remove());
    const junk = ['ad','ads','advert','promo','subscribe','newsletter','cookie','banner','footer','header','nav','sidebar','social','share','breadcrumb','pagination'];
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
   * Heuristic selection of the main content node. Prefers semantic containers,
   * otherwise falls back to the largest text block.
   */
  function pickMainNode(doc){
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

    best = doc.body; max = 0;
    doc.querySelectorAll('section, div').forEach(n => {
      const t = (n.innerText || '').trim();
      if (t.length > max) { max = t.length; best = n; }
    });
    return best || doc.body;
  }

  /** Determine a clean page title from meta and markup. */
  function metaTitle(doc, url){
    const mt = doc.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content?.trim();
    const h1 = doc.querySelector('h1')?.textContent?.trim();
    let t = doc.querySelector('title')?.textContent?.trim();
    const clean = (s='') => s.replace(/\s*[|\-–—·•:]\s*.+$/, '').trim();
    const best = mt || h1 || t || url;
    return clean(best);
  }

  /** Normalize whitespace and invisible chars in extracted text. */
  function normalizeText(s=''){
    return s
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
      .trim();
  }

  /** Fetch with an abort timeout; does not swallow non-timeout errors. */
  async function fetchWithTimeout(url, opts={}, ms=15000){
    const controller = new AbortController();
    const t = setTimeout(()=> controller.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(t);
    }
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
      res = await fetchWithTimeout(url, { mode: 'cors', redirect: 'follow', headers: { 'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' } });
    } catch (err) {
      const msg = String(err?.message || err);
      if (/abort/i.test(msg)) throw new Error('Network timeout while fetching URL');
      res = null;
    }
    if (!res || !res.ok) {
      const proxied = '/api/fetch?url=' + encodeURIComponent(url);
      try {
        res = await fetchWithTimeout(proxied, { redirect: 'follow' });
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
      const text = normalizeText(body);
      const title = finalUrl;
      return { kind: 'url', url: finalUrl, title, text };
    }

    const doc = new DOMParser().parseFromString(body, 'text/html');
    cleanDoc(doc);
    const node = pickMainNode(doc);
    const title = metaTitle(doc, finalUrl);
    const main = node?.innerText || doc.body?.innerText || '';
    const text = normalizeText(main);

    if (!text) throw new Error('No readable text found');
    return { kind: 'url', url: finalUrl, title, text };
  }

  /**
   * Lightweight title peek without full extraction. Uses direct fetch, then proxy, and
   * attempts to parse title from HTML when content-type permits.
   */
  async function peekTitle(inputUrl){
    let url = normalizeUrl(inputUrl);
    if (!url) return null;
    let res;
    try {
      res = await fetchWithTimeout(url, { mode: 'cors', redirect: 'follow', headers: { 'Accept': 'text/html,*/*;q=0.5' } }, 7000);
    } catch {
      try { res = await fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(url), {}, 8000); } catch { res = null; }
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