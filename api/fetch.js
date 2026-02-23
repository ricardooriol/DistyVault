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

    // 3. Forward the request parameters cleanly
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      // Drop headers that cause issues with upstream fetch (e.g., host mismatch)
      if (['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding'].includes(lowerKey)) return;
      headers.set(key, value);
    });

    // YouTube/General extraction requires a standard user agent to avoid bot blocks
    if (!headers.has('user-agent')) {
      headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) width/1920 Chrome/120.0.0.0 Safari/537.36 DistyVault/1.0');
    }

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'follow'
      // No manual timeout is set here so AI providers and large transcripts have as much time as the server permits
    };

    // Forward body if present for state-mutating requests (e.g., AI provider POSTs)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body) {
        // Vercel serverless might pre-parse JSON
        fetchOptions.body = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
          ? JSON.stringify(req.body)
          : req.body;
      } else {
        // Stream fallback
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        if (buffers.length > 0) fetchOptions.body = Buffer.concat(buffers);
      }
    }

    // 4. Perform the upstream request
    const response = await fetch(targetUrlParsed.toString(), fetchOptions);

    // 5. Pipe the response back
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (['content-encoding', 'transfer-encoding', 'content-length'].includes(lowerKey)) return;
      res.setHeader(lowerKey, value);
    });

    res.setHeader('x-final-url', response.url || targetUrlParsed.toString());
    res.statusCode = response.status;

    // Read the array buffer to avoid chunk/stream issues in serverless; removes the hard 4MB limit
    const arrayBuf = await response.arrayBuffer();
    return res.end(Buffer.from(arrayBuf));

  } catch (e) {
    const msg = String(e?.message || e);
    console.error('Fetch error:', msg);
    res.statusCode = 502; // Bad Gateway
    return res.end(`Proxy Error: ${msg}`);
  }
};