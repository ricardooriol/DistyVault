// Ollama Proxy implementation (used by Vercel API route)
// Set env var OLLAMA_BASE_URL to your HTTPS-accessible Ollama endpoint

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'content-length'
]);

function getUpstreamBase() {
  const base = process.env.OLLAMA_BASE_URL || '';
  if (!base) {
    throw new Error('Missing OLLAMA_BASE_URL env var for Ollama proxy');
  }
  return base.replace(/\/$/, '');
}

function buildTargetUrl(base, pathParts, query) {
  const path = Array.isArray(pathParts) ? pathParts.join('/') : (pathParts || '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (k === 'path') continue; // remove catch-all param
    if (Array.isArray(v)) v.forEach(val => qs.append(k, val));
    else if (v != null) qs.set(k, v);
  }
  const queryString = qs.toString();
  const url = `${base}/${path}${queryString ? `?${queryString}` : ''}`;
  return url;
}

function filterRequestHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key)) continue;
    out[key] = v;
  }
  return out;
}

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  try {
    cors(res, req.headers.origin);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const base = getUpstreamBase();
    const pathParam = req.query.path;
    const targetUrl = buildTargetUrl(base, pathParam, req.query);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : null;

    const forwardHeaders = filterRequestHeaders(req.headers);
    if (body && !forwardHeaders['content-type']) {
      forwardHeaders['content-type'] = 'application/json';
    }

    const upstreamResp = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body || undefined,
    });

    res.status(upstreamResp.status);
    const ct = upstreamResp.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    const ab = await upstreamResp.arrayBuffer();
    res.end(Buffer.from(ab));
  } catch (err) {
    const msg = (err && err.message) || 'Proxy error';
    res.status(502).json({ error: 'Ollama proxy failed', message: msg });
  }
};
