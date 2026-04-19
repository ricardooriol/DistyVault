module.exports = async (req, res) => {
  // 1. Permissive CORS for all AI providers and sources
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // 2. Extract target URL safely
  const targetUrl = (req.query?.url || req.url?.split('?url=')[1] || '').toString();
  let u = '';
  try { u = decodeURIComponent(targetUrl); } catch { u = targetUrl; }

  if (!u) {
    res.statusCode = 400;
    return res.end('Missing url parameter');
  }

  try {
    const targetUrlParsed = new URL(u);
    const isYouTube = /youtube\.com|youtu\.be/.test(u);

    // 3. Forward the request parameters with "Human Mimicry"
    const headers = new Headers();

    // Default Browser Identity
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) width/1920 Chrome/120.0.0.0 Safari/537.36 DistyVault/1.0';
    const googleBotUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

    // Forward safe headers from original request if they exist
    Object.entries(req.headers).forEach(([key, value]) => {
      const k = key.toLowerCase();
      if (['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding', 'cookie', 'x-vercel-id', 'x-vercel-forwarded-for'].includes(k)) return;
      if (k.startsWith('sec-')) return; // Let us set these
      headers.set(key, value);
    });

    if (isYouTube) {
      headers.set('User-Agent', chromeUA);
      headers.set('Accept-Language', 'en-US,en;q=0.9');
    } else {
      // Enforce high-success identity universally
      headers.set('User-Agent', googleBotUA);
      headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
      headers.set('Accept-Language', 'en-US,en;q=0.9');

      // Stealth/Anti-Bot headers
      headers.set('Sec-Fetch-Dest', 'document');
      headers.set('Sec-Fetch-Mode', 'navigate');
      headers.set('Sec-Fetch-Site', 'none');
      headers.set('Sec-Fetch-User', '?1');
      headers.set('Upgrade-Insecure-Requests', '1');
    }

    // Special case for YouTube to appear more like a real user
    if (isYouTube) {
      headers.set('Referer', 'https://www.google.com/');
    }

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'follow'
    };

    // Forward body for state-mutating requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body) {
        fetchOptions.body = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? JSON.stringify(req.body) : req.body;
      } else {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        if (buffers.length > 0) fetchOptions.body = Buffer.concat(buffers);
      }
    }

    let response = await fetch(targetUrlParsed.toString(), fetchOptions);

    // 4. Intelligent Fallback System (The "Bypass Anything" Engine)
    // Check if the response is a typical anti-bot block (403, 503, or small HTML with block keywords)
    let needsFallback = !response.ok;
    let originalBuffer = null;

    if (response.ok) {
      const ctype = (response.headers.get('content-type') || '').toLowerCase();
      if (ctype.includes('text/html')) {
        originalBuffer = await response.arrayBuffer();
        const bodyText = Buffer.from(originalBuffer).toString('utf-8').toLowerCase();
        if ((bodyText.includes('just a moment') || bodyText.includes('enable javascript') || bodyText.includes('access denied') || bodyText.includes('cloudflare')) && bodyText.length < 50000) {
          needsFallback = true;
        }
      } else {
        originalBuffer = await response.arrayBuffer();
      }
    }

    if (needsFallback && req.method === 'GET') {
      console.log(`[Proxy] Direct fetch failed or blocked for ${targetUrlParsed.toString()}. Engaging Jina Reader fallback...`);
      // Jina Reader acts as a headless browser and bypasses most captchas
      const jinaUrl = 'https://r.jina.ai/' + targetUrlParsed.toString();
      const jinaRes = await fetch(jinaUrl, {
        headers: {
          'Accept': 'text/plain',
          'X-Return-Format': 'markdown'
        }
      });

      if (jinaRes.ok) {
        const markdown = await jinaRes.text();
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.setHeader('x-final-url', jinaRes.url || targetUrlParsed.toString());
        res.statusCode = 200;
        return res.end(markdown);
      }
    }

    // 5. Return Original Response (If fallback wasn't needed or failed)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (['content-encoding', 'transfer-encoding', 'content-length', 'content-security-policy', 'x-frame-options'].includes(lowerKey)) return;
      res.setHeader(lowerKey, value);
    });

    res.setHeader('x-final-url', response.url || targetUrlParsed.toString());
    res.statusCode = response.status;

    if (originalBuffer) {
      return res.end(Buffer.from(originalBuffer));
    } else {
      const arrayBuf = await response.arrayBuffer();
      return res.end(Buffer.from(arrayBuf));
    }

  } catch (e) {
    const msg = String(e?.message || e);
    console.error('Fetch error:', msg);
    res.statusCode = 502; // Bad Gateway
    return res.end(`Proxy Error: ${msg}`);
  }
};