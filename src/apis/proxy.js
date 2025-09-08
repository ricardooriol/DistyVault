// Generic CORS proxy (serverless)
// GET /api/proxy?url=<encoded target>
// - Only allows http/https targets
// - Mirrors content-type and status
// - Adds permissive CORS headers

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'content-length'
]);

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

module.exports = async function proxy(req, res) {
  try {
    cors(res, req.headers.origin);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
      return;
    }

    const { parse } = require('url');
    const query = parse(req.url, true).query || {};
    const target = query.url;
    if (!target || typeof target !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: 'url query param is required' }));
      return;
    }
    if (target.length > 2048) {
      res.statusCode = 414;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: 'URL too long' }));
      return;
    }
    let u;
    try { u = new URL(target); } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: 'Invalid URL' }));
      return;
    }
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: 'Only http/https are allowed' }));
      return;
    }

    const headers = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      const key = k.toLowerCase();
      if (HOP_BY_HOP.has(key)) continue;
      headers[key] = v;
    }

    const upstream = await fetch(u.toString(), { method: 'GET', headers });
    res.statusCode = upstream.status;
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    const ab = await upstream.arrayBuffer();
    res.end(Buffer.from(ab));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'error', message: err?.message || 'Proxy error' }));
  }
};
