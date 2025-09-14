// Serverless proxy to fetch cross-origin HTML/text with permissive CORS
// Vercel Node.js function
// Usage: GET /api/fetch?url=https%3A%2F%2Fexample.com

/** @param {import('http').IncomingMessage & { query?: any, method?: string }} req
 *  @param {import('http').ServerResponse} res */
module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  const urlParam = (req.query?.url || req.url?.split('?url=')[1] || '').toString();
  let targetUrl = '';
  try {
    targetUrl = decodeURIComponent(urlParam);
  } catch {
    targetUrl = urlParam;
  }

  if (!targetUrl) {
    respond(400, 'Missing url parameter');
    return;
  }

  let u;
  try {
    u = new URL(targetUrl);
  } catch (e) {
    respond(400, 'Invalid URL');
    return;
  }
  if (!/^https?:$/.test(u.protocol)) {
    respond(400, 'Only http/https protocols are allowed');
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(u.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        // Spoof a browser-ish UA to avoid some basic blocks
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DistyVault/1.0'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const ctype = response.headers.get('content-type') || 'text/plain; charset=utf-8';
    // Limit body size to ~4MB for safety
    const buffer = Buffer.from(await response.arrayBuffer());
    const maxBytes = 4 * 1024 * 1024;
    const limited = buffer.length > maxBytes ? buffer.subarray(0, maxBytes) : buffer;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'x-final-url, content-type');
    res.setHeader('x-final-url', response.url || u.toString());
    res.setHeader('content-type', ctype);
    res.statusCode = response.status;
    res.end(limited);
  } catch (e) {
    const msg = e && (e.name || e.message) || 'Fetch error';
    const code = /AbortError/i.test(String(msg)) ? 504 : 502;
    respond(code, String(msg));
  }

  function respond(code, message){
    res.statusCode = code;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(message);
  }
};
