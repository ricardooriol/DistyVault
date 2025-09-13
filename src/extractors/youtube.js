// YouTube extractor - basic metadata extraction only (no video fetch)
// MVP: validate URL and set placeholder text. Playlist not resolved in MVP.
(function(){
  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i;

  function isYouTube(u='') { return ytRegex.test(u); }

  async function fetchWithTimeout(url, opts={}, ms=8000){
    const controller = new AbortController();
    const t = setTimeout(()=> controller.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      return res;
    } finally { clearTimeout(t); }
  }

  // Try YouTube oEmbed to get the real title without API key
  async function peekYouTubeTitle(inputUrl){
    try {
      if (!isYouTube(inputUrl)) return null;
      const endpoint = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(inputUrl);
      let res = null;
      try { res = await fetchWithTimeout(endpoint, { headers: { 'Accept': 'application/json' } }, 7000); } catch {}
      if (!res || !res.ok) {
        // Fallback via proxy
        try { res = await fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(endpoint), {}, 8000); } catch {}
      }
      if (!res || !res.ok) return null;
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      let data;
      if (ctype.includes('json')) data = await res.json();
      else data = JSON.parse(await res.text());
      if (data && data.title) return { title: String(data.title), url: inputUrl };
    } catch {}
    return null;
  }

  async function extractYouTube(itemOrUrl) {
    const url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl.url || '');
    if (!isYouTube(url)) throw new Error('Not a valid YouTube URL');
    const id = (url.match(ytRegex) || [])[1] || '';
    let title = `YouTube Video ${id}`;
    try {
      const peek = await peekYouTubeTitle(url);
      if (peek && peek.title) title = peek.title;
    } catch {}
    const text = `Placeholder transcript for ${url}. Add API-based transcript extraction later.`;
    return { kind: 'youtube', url, title, text, videoId: id };
  }

  window.DV = window.DV || {};
  window.DV.extractors = window.DV.extractors || {};
  window.DV.extractors.extractYouTube = extractYouTube;
  window.DV.extractors.isYouTube = isYouTube;
  window.DV.extractors.peekYouTubeTitle = peekYouTubeTitle;
})();
