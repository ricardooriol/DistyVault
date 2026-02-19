/**
 * HTTP Proxy for DistyVault
 * 
 * Securely fetches external content to bypass CORS.
 * Features:
 * - SSRF Protection (blocks internal IPs)
 * - Rate Limiting
 * - Response size capping (4MB)
 * - timeouts
 */

const RATE_MAP = new Map();
const MAX_RPM = 60;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = RATE_MAP.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
    RATE_MAP.set(ip, entry);
  }
  entry.count++;

  // Cleanup old entries
  if (RATE_MAP.size > 10000) {
    for (const [k, v] of RATE_MAP) {
      if (now - v.start > RATE_WINDOW_MS) RATE_MAP.delete(k);
    }
  }
  return entry.count <= MAX_RPM;
}

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(h)) return true;
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  if (/^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^169\.254\.|^0\./.test(h)) return true;
  if (/\.(local|internal|localhost|corp|home|lan)$/i.test(h)) return true;
  return false;
}

export default async function handler(req, res) {
  // CORS setup
  const origin = req.headers?.origin || '*';
  const allowedOriginPattern = /^https?:\/\/(localhost(:\d+)?|.*\.vercel\.app)$/;
  const corsOrigin = allowedOriginPattern.test(origin) ? origin : (req.headers?.referer ? new URL(req.headers.referer).origin : '*');

  const sendError = (code, message) => {
    res.statusCode = code;
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  };

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  // Rate Limiting
  const clientIp = (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (!checkRateLimit(clientIp)) {
    return sendError(429, 'Rate limit exceeded');
  }

  // Parse URL
  const urlParam = (req.query?.url || req.url?.split('?url=')[1] || '').toString();
  let targetUrl = '';
  try {
    targetUrl = decodeURIComponent(urlParam);
  } catch {
    targetUrl = urlParam;
  }

  if (!targetUrl) return sendError(400, 'Missing url parameter');

  let u;
  try {
    u = new URL(targetUrl);
  } catch {
    return sendError(400, 'Invalid URL');
  }

  if (!/^https?:$/.test(u.protocol)) return sendError(400, 'Only http/https allowed');
  if (isPrivateHost(u.hostname)) return sendError(403, 'Access to internal addresses blocked');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(u.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DistyVault/1.0)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    // SSRF check on final URL after redirects
    try {
      const finalUrl = new URL(response.url || u.toString());
      if (isPrivateHost(finalUrl.hostname)) return sendError(403, 'Redirect to internal address blocked');
    } catch { }

    // Cap size
    const buffer = Buffer.from(await response.arrayBuffer());
    const maxBytes = 4 * 1024 * 1024; // 4MB
    const limited = buffer.length > maxBytes ? buffer.subarray(0, maxBytes) : buffer;

    res.statusCode = response.status;
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Expose-Headers', 'x-final-url, content-type');
    res.setHeader('x-final-url', response.url || u.toString());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.end(limited);

  } catch (error) {
    const msg = (error.name === 'AbortError') ? 'Request timeout' : (error.message || 'Fetch error');
    const code = (error.name === 'AbortError') ? 504 : 502;
    sendError(code, msg);
  }
};