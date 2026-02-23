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
    const isNewsletter = /substack\.com|thedankoe\.com|beehiiv\.com|medium\.com|bytebytego\.com|ghost\.io|beehiiv\.com|newsletter/.test(u);

    // 3. Forward the request parameters with "Human Mimicry"
    const headers = new Headers();
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const googleBotUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

    headers.set('User-Agent', isNewsletter ? googleBotUA : chromeUA);
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Sec-Fetch-Dest', 'document');
    headers.set('Sec-Fetch-Mode', 'navigate');
    headers.set('Sec-Fetch-Site', 'none');
    headers.set('Sec-Fetch-User', '?1');
    headers.set('Upgrade-Insecure-Requests', '1');

    if (!isNewsletter) {
      headers.set('Sec-Ch-Ua', '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"');
      headers.set('Sec-Ch-Ua-Mobile', '?0');
      headers.set('Sec-Ch-Ua-Platform', '"Windows"');
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

    const response = await fetch(targetUrlParsed.toString(), fetchOptions);

    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (['content-encoding', 'transfer-encoding', 'content-length', 'content-security-policy', 'x-frame-options'].includes(lowerKey)) return;
      res.setHeader(lowerKey, value);
    });

    res.setHeader('x-final-url', response.url || targetUrlParsed.toString());
    res.statusCode = response.status;

    const arrayBuf = await response.arrayBuffer();
    return res.end(Buffer.from(arrayBuf));

  } catch (e) {
    const msg = String(e?.message || e);
    console.error('Fetch error:', msg);
    res.statusCode = 502; // Bad Gateway
    return res.end(`Proxy Error: ${msg}`);
  }
};