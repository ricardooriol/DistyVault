// File extractors (PDF/DOC/DOCX/TXT)
(function(){
  async function readTextFile(file) {
    return await file.text();
  }

  async function readPdf(file) {
    // Minimal: use pdf.js? For no-deps MVP, try extract via text() which won't work for PDF reliably.
    // Fallback: note limitation.
    const text = await file.text().catch(()=> '')
    return text || '[PDF content extraction not available in MVP]';
  }

  async function readDoc(file) {
    // .doc/.docx not parsed in MVP; placeholder
    return '[DOC/DOCX content extraction not available in MVP]';
  }

  async function extractFromFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let text = '';
    if (ext === 'txt' || ext === 'md') text = await readTextFile(file);
    else if (ext === 'pdf') text = await readPdf(file);
    else if (ext === 'doc' || ext === 'docx') text = await readDoc(file);
    else text = await readTextFile(file).catch(()=> '[Unknown file type; attempted text read]');

    return {
      kind: 'file',
      title: file.name,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      text
    };
  }

  window.DV = window.DV || {};
  window.DV.extractors = window.DV.extractors || {};
  window.DV.extractors.extractFile = extractFromFile;
})();
