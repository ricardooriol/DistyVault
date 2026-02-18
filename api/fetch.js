/**
 * HTTP proxy endpoint to fetch external resources with CORS enablement, input validation,
 * and response normalization. Intended for frontend use to bypass cross-origin restrictions
 * while enforcing server-side safety constraints (protocol allowlist, timeout, size cap).
 *
 * Key behaviors:
 * - Handles CORS preflight (OPTIONS) and sets permissive CORS for GET responses.
 * - Validates and decodes the 'url' query parameter, allowing only http/https protocols.
 * - Issues a GET with a realistic User-Agent and follows redirects.
 * - Enforces a 15s timeout via AbortController and limits payload to 4 MiB.
 * - Returns upstream status code and content-type, and exposes final URL via 'x-final-url'.
 */
/**
 * Serverless-style request handler.
 *
 * Contract:
 * - Input: HTTP request with optional `query.url` or `?url=` parameter (encoded or plain).
 * - Output: Proxied response body (capped), upstream status code, content-type, and headers
 *   `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: x-final-url, content-type`,
 *   `x-final-url`.
 * - Error modes: 400 for missing/invalid URL or disallowed protocol, 502 for fetch failures,
 *   504 on timeout/abort.
 *
 * Notes:
 * - This endpoint is intentionally minimal: it does not forward arbitrary headers or cookies,
 *   and it reads the full response into memory before truncation (no streaming).
 *
 * @param {import('http').IncomingMessage & { method?: string, query?: Record<string, unknown>, url?: string }} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
 */
/**
 * Simple in-memory rate limiter (per-IP, per serverless cold start).
 * Allows `MAX_RPM` requests per minute per IP.
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
  // Evict stale entries periodically
  if (RATE_MAP.size > 10000) {
    for (const [k, v] of RATE_MAP) {
      if (now - v.start > RATE_WINDOW_MS) RATE_MAP.delete(k);
    }
  }
  return entry.count <= MAX_RPM;
}

/**
 * Check whether a hostname points to a private/internal/link-local IP range.
 * Blocks SSRF attacks targeting cloud metadata, localhost, or LAN addresses.
 * @param {string} hostname
 * @returns {boolean} true if the hostname appears to be internal
 */
function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  // Block localhost and common internal hostnames
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h === '0.0.0.0') return true;
  // Block cloud metadata endpoints
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  // Block common private IP ranges (basic check; does not resolve DNS)
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^0\./.test(h)) return true;
  // Block .local, .internal, .localhost TLDs
  if (/\.(local|internal|localhost|corp|home|lan)$/i.test(h)) return true;
  return false;
}

module.exports = async (req, res) => {
  const origin = req.headers?.origin || '*';
  const allowedOriginPattern = /^https?:\/\/(localhost(:\d+)?|.*\.vercel\.app)$/;
  const corsOrigin = allowedOriginPattern.test(origin) ? origin : (req.headers?.referer ? new URL(req.headers.referer).origin : '*');

  // CORS preflight: respond early with allowed methods/headers and no body
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  // Rate limiting
  const clientIp = (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (!checkRateLimit(clientIp)) {
    respond(429, 'Rate limit exceeded. Try again later.');
    return;
  }

  // Support both Next/Vercel-style req.query and raw URL parsing as a fallback
  const urlParam = (req.query?.url || req.url?.split('?url=')[1] || '').toString();
  let targetUrl = '';
  try {
    // Accept percent-encoded values; fall back to raw if decoding fails
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
    // Validate URL structure early; reject malformed inputs
    u = new URL(targetUrl);
  } catch (e) {
    respond(400, 'Invalid URL');
    return;
  }
  // Strict protocol allowlist to avoid local file or other dangerous schemes
  if (!/^https?:$/.test(u.protocol)) {
    respond(400, 'Only http/https protocols are allowed');
    return;
  }

  // SSRF protection: block private/internal/cloud-metadata hostnames
  if (isPrivateHost(u.hostname)) {
    respond(403, 'Access to internal addresses is not allowed');
    return;
  }

  try {
    // Enforce an upper bound on request duration to prevent hanging connections
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(u.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DistyVault/1.0'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    // After redirect, re-check final URL for SSRF bypass via DNS rebinding
    try {
      const finalUrl = new URL(response.url || u.toString());
      if (isPrivateHost(finalUrl.hostname)) {
        respond(403, 'Redirect to internal address blocked');
        return;
      }
    } catch { /* keep going if URL parse fails */ }

    // Default to a sensible content-type if none provided upstream
    const ctype = response.headers.get('content-type') || 'text/plain; charset=utf-8';
    // Read full body into memory; apply a conservative 4 MiB cap to protect server resources
    const buffer = Buffer.from(await response.arrayBuffer());
    const maxBytes = 4 * 1024 * 1024;
    const limited = buffer.length > maxBytes ? buffer.subarray(0, maxBytes) : buffer;

    // Return proxied response with scoped CORS and expose the final resolved URL
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Expose-Headers', 'x-final-url, content-type');
    res.setHeader('x-final-url', response.url || u.toString());
    res.setHeader('content-type', ctype);
    res.statusCode = response.status;
    res.end(limited);
  } catch (e) {
    // Normalize errors: map abort/timeout to 504, others to 502; avoid leaking internals
    const msg = e && (e.name || e.message) || 'Fetch error';
    const code = /AbortError/i.test(String(msg)) ? 504 : 502;
    respond(code, String(msg));
  }

  /**
   * Minimal helper to send a text response with CORS headers.
   * Ensures consistent status and content-type for error conditions.
   *
   * @param {number} code HTTP status code
   * @param {string} message Human-readable message returned in the body
   */
  function respond(code, message) {
    res.statusCode = code;
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(message);
  }
};