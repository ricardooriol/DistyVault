// YouTube extractor — fetches transcript (captions) without API key by parsing the watch page
// Supports watch, youtu.be, shorts, and live URLs. No playlist expansion in this MVP.
(function(){
  // Accept multiple URL forms and later use URL parsing to get the id
  const ytHostRegex = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i;

  function isYouTube(u=''){
    try { const url = new URL(u); return ytHostRegex.test(url.hostname); } catch { return /youtu\.?be|youtube\.com/i.test(String(u)); }
  }

  function parseVideoId(u=''){
    try {
      const url = new URL(u);
      const host = url.hostname.toLowerCase();
      if (host.includes('youtu.be')) {
        const seg = url.pathname.replace(/^\//,'').split('/')[0];
        if (seg && seg.length >= 11) return seg.slice(0,11);
      }
      // youtube.com domains
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      // /shorts/ID or /live/ID
      const idx = parts.findIndex(p => p === 'shorts' || p === 'live' || p === 'embed');
      if (idx >= 0 && parts[idx+1]) return parts[idx+1].slice(0,11);
    } catch {}
    // Fallback regex for robustness
    const m = String(u).match(/(?:v=|\/shorts\/|\/live\/|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : '';
  }

  async function fetchWithTimeout(url, opts={}, ms=12000){
    const controller = new AbortController();
    const t = setTimeout(()=> controller.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      return res;
    } finally { clearTimeout(t); }
  }

  function addQueryParam(u, key, value){
    try {
      const url = new URL(u);
      if (value === undefined || value === null || value === '') url.searchParams.set(key, '');
      else url.searchParams.set(key, String(value));
      return url.toString();
    } catch { return u + (u.includes('?') ? '&' : '?') + encodeURIComponent(key) + '=' + encodeURIComponent(String(value ?? '')); }
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

  // Extract JSON blob from the watch page: ytInitialPlayerResponse = {...}
  function extractPlayerResponseFromHtml(html=''){
    const marker = 'ytInitialPlayerResponse';
    const idx = html.indexOf(marker);
    if (idx === -1) return null;
    // Find the first '{' after the marker and parse a balanced JSON object
    let i = html.indexOf('{', idx);
    if (i === -1) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (; i < html.length; i++){
      const ch = html[i];
      if (inStr) {
        if (esc) { esc = false; }
        else if (ch === '\\') { esc = true; }
        else if (ch === '"') { inStr = false; }
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
    }
    if (end === -1) return null;
    const jsonText = html.slice(html.indexOf('{', idx), end);
    try { return JSON.parse(jsonText); } catch { return null; }
  }

  function pickBestCaptionTrack(tracks){
    if (!Array.isArray(tracks) || !tracks.length) return null;
    const isHuman = t => t && t.kind !== 'asr';
    const isEn = t => /^(en|en-)/i.test(t?.languageCode || '') || /english/i.test(t?.name?.simpleText || '');
    // Prefer human English
    let best = tracks.find(t => isHuman(t) && isEn(t));
    if (best) return best;
    // Then auto English
    best = tracks.find(t => isEn(t));
    if (best) return best;
    // Then any human
    best = tracks.find(isHuman);
    return best || tracks[0];
  }

  function decodeEntities(html){
    try {
      const doc = new DOMParser().parseFromString(html || '', 'text/html');
      return doc.documentElement.textContent || '';
    } catch { return html; }
  }

  function normalizeSpaces(s=''){
    return String(s)
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function parseTimedTextXml(xmlString){
    try {
      const xml = new DOMParser().parseFromString(xmlString, 'text/xml');
      const texts = Array.from(xml.getElementsByTagName('text'));
      const segs = texts.map(node => {
        const start = parseFloat(node.getAttribute('start') || '0');
        const dur = parseFloat(node.getAttribute('dur') || '0');
        let html = node.textContent || '';
        // The API returns entities encoded and may include <br/>
        html = html.replace(/\n/g, ' ').replace(/<br\s*\/?\s*>/gi, '\n');
        const text = normalizeSpaces(decodeEntities(html));
        return { start, dur, text };
      }).filter(s => s.text);

      // Merge segments intelligently: join with space, break on long pauses or sentence ends
      const out = [];
      let buf = '';
      let lastEnd = 0;
      for (const s of segs){
        const gap = s.start - lastEnd;
        const endsSentence = /[\.!?]$/.test(buf.trim());
        if (gap > 2.5 && buf) {
          out.push(buf.trim());
          buf = '';
        } else if (buf && (endsSentence)) {
          buf += '\n';
        } else if (buf) {
          buf += ' ';
        }
        buf += s.text.trim();
        lastEnd = s.start + s.dur;
      }
      if (buf.trim()) out.push(buf.trim());
      return normalizeSpaces(out.join('\n'));
    } catch (e) {
      return '';
    }
  }

  async function fetchTranscriptFromTrack(baseUrl, forceEnIfTranslatable=false){
    let url = baseUrl;
    // Prefer JSON3? XML is simpler and widely supported. Ensure we don't force a format; default is fine.
    if (forceEnIfTranslatable && !/[?&]tlang=/.test(url)) url = addQueryParam(url, 'tlang', 'en');
    // Route via proxy to avoid CORS
    const proxied = '/api/fetch?url=' + encodeURIComponent(url);
    const res = await fetchWithTimeout(proxied, {}, 12000).catch(()=>null);
    if (!res || !res.ok) return '';
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();
    if (ctype.includes('xml') || body.startsWith('<?xml')) return parseTimedTextXml(body);
    // Some tracks can return JSON; try to parse minimal
    try {
      const j = JSON.parse(body);
      // json3 format has events with segs
      if (j && Array.isArray(j.events)) {
        const parts = [];
        for (const ev of j.events){
          if (Array.isArray(ev.segs)) parts.push(ev.segs.map(s=>s.utf8 || '').join(''));
        }
        return normalizeSpaces(parts.join('\n'));
      }
    } catch {}
    // Fallback: treat as plain text
    return normalizeSpaces(decodeEntities(body));
  }

  async function extractYouTube(itemOrUrl) {
    const inputUrl = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl.url || '');
    if (!isYouTube(inputUrl)) throw new Error('Not a valid YouTube URL');
    const id = parseVideoId(inputUrl);
    if (!id) throw new Error('Could not parse YouTube video id');

    // Fetch the watch page via proxy with hl=en to standardize structure
    const watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(id) + '&hl=en';
    let res = await fetchWithTimeout('/api/fetch?url=' + encodeURIComponent(watchUrl), {}, 15000).catch(()=>null);
    if (!res || !res.ok) throw new Error('Failed to load YouTube page');
    const html = await res.text();

    // Title: prefer playerResponse.videoDetails.title; fallback to oEmbed
    let title = `YouTube Video ${id}`;
    let player = extractPlayerResponseFromHtml(html);
    if (player?.videoDetails?.title) title = String(player.videoDetails.title);
    else {
      try { const peek = await peekYouTubeTitle(inputUrl); if (peek?.title) title = peek.title; } catch {}
    }

    // Captions
    let tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || player?.captions?.playerCaptionsRenderer?.captionTracks || [];
    if (!Array.isArray(tracks) || !tracks.length) {
      // Some pages defer; attempt to find another occurrence (rare)
      // Fallback to error if still missing
    }
    if (!tracks || !tracks.length) {
      return { kind: 'youtube', url: inputUrl, title, text: '[No captions available for this video]', videoId: id };
    }

    const track = pickBestCaptionTrack(tracks);
    const wantEnglish = !/^en(-|$)/i.test(track?.languageCode || '') && (track?.isTranslatable || false);
    const text = await fetchTranscriptFromTrack(track.baseUrl, wantEnglish);
    const language = wantEnglish ? 'en' : (track?.languageCode || '');
    const textOut = text || '[Failed to fetch or parse captions]';

    return { kind: 'youtube', url: inputUrl, title, text: textOut, videoId: id, language };
  }

  window.DV = window.DV || {};
  window.DV.extractors = window.DV.extractors || {};
  window.DV.extractors.extractYouTube = extractYouTube;
  window.DV.extractors.isYouTube = isYouTube;
  window.DV.extractors.peekYouTubeTitle = peekYouTubeTitle;
})();
