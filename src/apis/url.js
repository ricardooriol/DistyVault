// Vercel-style API route: /src/apis/url
// POST with JSON body { url } or GET with query ?url=
const contentExtractor = require('../processors/contentExtractor');

async function parseJsonBody(req) {
  return new Promise((resolve) => {
    try {
      if (req.body && typeof req.body === 'object') {
        return resolve(req.body);
      }
    } catch {}
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        const obj = JSON.parse(raw);
        resolve(obj || {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    let url = null;
    if (req.method === 'GET') {
      const query = require('url').parse(req.url, true).query || {};
      url = query.url;
    } else if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      url = body.url;
    } else {
      res.statusCode = 405;
      res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
      return;
    }

    if (!url || typeof url !== 'string') {
      res.statusCode = 400;
      res.end(JSON.stringify({ status: 'error', message: 'URL is required' }));
      return;
    }

    const extraction = await contentExtractor.extractFromUrl(url);
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', extraction }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ status: 'error', message: err?.message || 'Internal Server Error' }));
  }
};
