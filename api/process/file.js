// Vercel-style API route: POST /api/process/file
// Accepts multipart/form-data with field "file"
const contentExtractor = require('../../src/server/processing/contentExtractor');

// Simple multipart parsing using busboy
const Busboy = require('busboy');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    return;
  }

  try {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let filename = '';
    let mimeType = '';

    await new Promise((resolve, reject) => {
      busboy.on('file', (name, file, info) => {
        const { filename: fn, mimeType: mt } = info;
        filename = fn;
        mimeType = mt;
        const chunks = [];
        file.on('data', (d) => chunks.push(d));
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });
      busboy.on('error', reject);
      busboy.on('finish', resolve);
      req.pipe(busboy);
    });

    if (!fileBuffer) {
      res.status(400).json({ status: 'error', message: 'No file uploaded' });
      return;
    }

    // For now, support only text-like extraction here (PDF/DOCX in-browser is limited). We convert buffer to UTF-8 if text.
    // If needed, extend to call a headless extraction service.
    const text = mimeType.startsWith('text/')
      ? fileBuffer.toString('utf8')
      : `Uploaded file "${filename}" (${mimeType}) received. Serverless environment cannot run native PDF/DOCX extraction. Please use URL mode or provide text.`;

    const extraction = {
      text,
      title: filename || 'Uploaded Document',
      contentType: `file-${(filename.split('.').pop() || 'bin').toLowerCase()}`,
      extractionMethod: 'serverless-upload',
      fallbackUsed: !mimeType.startsWith('text/'),
      metadata: { filename, mimeType, size: fileBuffer.length }
    };

    res.status(200).json({ status: 'ok', extraction });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
