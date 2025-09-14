// URL extractor — fetch, sanitize, and pick main readable content (CORS permitting)
(function(){
  function normalizeUrl(input=''){
    const s = String(input).trim();
    if (!s) return '';
    // If no scheme, assume https
    if (!/^https?:\/\//i.test(s) && !/^[a-z]+:\/\//i.test(s)) return 'https://' + s;
    return s;
  }

  function cleanDoc(doc){
    // Remove non-content elements
    doc.querySelectorAll('script,style,noscript,template,iframe,canvas,svg,form,header,footer,nav,aside,menu,dialog').forEach(n=>n.remove());
    // Remove hidden or aria-hidden nodes
    doc.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display:none" i], [style*="visibility:hidden" i]').forEach(n=>n.remove());
    // Heuristic junk removal by class/id
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

  function pickMainNode(doc){
    // Prefer explicit content containers
    const candidates = Array.from(doc.querySelectorAll('article, main, [role="main"], #content, .content, .post, .entry, .article, .main-content'));
    let best = null, max = 0;
    const score = (el) => {
      const text = (el.innerText || '').trim();
      // Favor density: paragraphs and headings
      const pCount = el.querySelectorAll('p').length;
      const hCount = el.querySelectorAll('h1,h2,h3').length;
      return text.length + pCount * 100 + hCount * 50;
    };
    for (const el of candidates) {
      const s = score(el);
      if (s > max) { max = s; best = el; }
    }
    if (best && (best.innerText || '').trim().length > 200) return best;

    // Fallback: longest section/div by innerText length
    best = doc.body; max = 0;
    doc.querySelectorAll('section, div').forEach(n => {
      const t = (n.innerText || '').trim();
      if (t.length > max) { max = t.length; best = n; }
    });
    return best || doc.body;
  }

  function metaTitle(doc, url){
    const mt = doc.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content?.trim();
    const h1 = doc.querySelector('h1')?.textContent?.trim();
    let t = doc.querySelector('title')?.textContent?.trim();
    // Clean common separators including site name
    const clean = (s='') => s.replace(/\s*[|\-–—·•:]\s*.+$/, '').trim();
    const best = mt || h1 || t || url;
    return clean(best);
  }

  function normalizeText(s=''){
    return s
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
      .trim();
  }

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
      // Try proxy fallback on generic fetch error as well
      res = null;
    }
    if (!res || !res.ok) {
      // Fallback to serverless proxy (works on Vercel deploys). Same-origin in local dev if served under /
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

    // Plain text response
    if (ctype.includes('text/plain') || !/html/.test(ctype)) {
      const text = normalizeText(body);
      const title = finalUrl;
      return { kind: 'url', url: finalUrl, title, text };
    }

    // HTML response
    const doc = new DOMParser().parseFromString(body, 'text/html');
    cleanDoc(doc);
    const node = pickMainNode(doc);
    const title = metaTitle(doc, finalUrl);
    const main = node?.innerText || doc.body?.innerText || '';
    const text = normalizeText(main);

    if (!text) throw new Error('No readable text found');
    return { kind: 'url', url: finalUrl, title, text };
  }

  // Quick title preview without full extraction; tries direct fetch then proxy
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