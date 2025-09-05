// Vercel-style API route: POST /api/process/url
// Body: { url }
const contentExtractor = require('../../src/server/processing/contentExtractor');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    return;
  }
  try {
    const { url } = req.body || {};
    if (!url) {
      res.status(400).json({ status: 'error', message: 'URL is required' });
      return;
    }
    const extraction = await contentExtractor.extractFromUrl(url);
    res.status(200).json({ status: 'ok', extraction });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
