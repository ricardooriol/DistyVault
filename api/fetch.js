const dns = require('dns').promises;
const net = require('net');

function isPrivateIP(ip) {
  if (!net.isIP(ip)) return false;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 127) return true; // 127.0.0.0/8 loopback
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 link-local
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 0) return true; // 0.0.0.0/8
  } else if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true;
  }
  return false;
}

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
    const hostname = targetUrlParsed.hostname;

    // Strict SSRF protection: check localhost and perform DNS verification
    if (hostname === 'localhost' || hostname.includes('127.0.0.1') || hostname.includes('::1')) {
      res.statusCode = 403;
      return res.end('Access denied: Localhost and loopback URLs are strictly forbidden (SSRF protection).');
    }

    try {
      const lookupRes = await dns.lookup(hostname);
      if (lookupRes && lookupRes.address && isPrivateIP(lookupRes.address)) {
        res.statusCode = 403;
        return res.end(`Access denied: Target host resolves to a private or loopback IP address (${lookupRes.address}) (SSRF protection).`);
      }
    } catch (dnsErr) {
      res.statusCode = 502;
      return res.end(`Proxy Error: DNS lookup failed for hostname ${hostname}`);
    }

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'follow',
      signal: controller.signal
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

    let response;
    try {
      response = await fetch(targetUrlParsed.toString(), fetchOptions);
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        res.statusCode = 504;
        return res.end('Proxy Error: Direct fetch timed out after 25 seconds.');
      }
      throw fetchErr;
    }

    // 4. Intelligent Fallback System (The "Bypass Anything" Engine)
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
      const jinaUrl = 'https://r.jina.ai/' + targetUrlParsed.toString();
      const jinaController = new AbortController();
      const jinaTimeout = setTimeout(() => jinaController.abort(), 25000);

      try {
        const jinaRes = await fetch(jinaUrl, {
          headers: {
            'Accept': 'text/plain',
            'X-Return-Format': 'markdown'
          },
          signal: jinaController.signal
        });
        clearTimeout(jinaTimeout);

        if (jinaRes.ok) {
          const markdown = await jinaRes.text();
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.setHeader('x-final-url', jinaRes.url || targetUrlParsed.toString());
          res.statusCode = 200;
          return res.end(markdown);
        }
      } catch (jinaErr) {
        clearTimeout(jinaTimeout);
        console.error('[Proxy] Jina fallback failed:', jinaErr);
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