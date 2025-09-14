(function(){
  /**
   * Utility extractors for local files. Supports OCR for images and PDFs,
   * textual extraction for common document types, and HTML main-content stripping.
   * External libraries are loaded lazily once per page to minimize startup cost.
   */
  function extOf(name=''){ return (String(name).split('.').pop() || '').toLowerCase(); }
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  /** Normalize spacing and remove non-printable characters. */
  function normalizeText(s=''){
    return String(s)
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
      .trim();
  }

  const _once = {};
  /**
   * Load an external script at most once, with an optional readiness check.
   * Resolves when the script loads, or immediately if `check()` returns true.
   * @param {string} url
   * @param {() => boolean} [check]
   * @returns {Promise<void>}
   */
  function loadScriptOnce(url, check){
    return new Promise((resolve, reject) => {
      try {
        if (check && check()) return resolve();
        if (_once[url]) return _once[url].then(resolve).catch(reject);
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (e) => reject(new Error('Failed to load ' + url));
        document.head.appendChild(s);
        _once[url] = new Promise((res, rej) => { s.addEventListener('load', ()=>res()); s.addEventListener('error', ()=>rej()); });
      } catch (e) { reject(e); }
    });
  }

  const OCR_MAX_PAGES = 50;

  /** Ensure pdf.js is loaded and worker is configured. */
  async function ensurePdfJs(){
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js', () => !!(window.pdfjsLib));
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';
      } catch {}
    }
  }

  /** Load Tesseract.js on demand for OCR. */
  async function ensureTesseract(){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js', () => !!window.Tesseract);
  }

  /** Load Mammoth for DOCX extraction (client-side). */
  async function ensureMammoth(){
    await loadScriptOnce('https://unpkg.com/mammoth/mammoth.browser.min.js', () => !!window.mammoth);
  }

  /** Read a plain text file via the File API. */
  async function readTextFile(file) {
    return await file.text();
  }

  /**
   * Extract primary visible text from HTML by stripping noisy elements and
   * selecting the largest content container as a heuristic fallback.
   */
  function htmlToMainText(html){
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script,style,noscript,template,iframe,canvas,svg,form,header,footer,nav,aside,menu,dialog').forEach(n=>n.remove());
      let best = doc.body, max = 0;
      doc.querySelectorAll('article, main, [role="main"], section, div').forEach(n => {
        const t = (n.innerText || '').trim();
        if (t.length > max) { max = t.length; best = n; }
      });
      const text = best?.innerText || doc.body?.innerText || '';
      return normalizeText(text);
    } catch (e) {
      return normalizeText(html.replace(/<[^>]+>/g, ' '));
    }
  }

  /** Read and reduce an HTML file to its main text content. */
  async function readHtml(file){
    const html = await file.text();
    return htmlToMainText(html);
  }

  /** Extract raw text from DOCX using Mammoth; return a diagnostic on failure. */
  async function readDocx(file){
    try {
      await ensureMammoth();
      const buf = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
      return normalizeText(result?.value || result?.text || '');
    } catch (e) {
      return '[DOCX extraction failed: ' + (e && (e.message || e)) + ']';
    }
  }

  /** Very lightweight RTF text approximation. */
  async function readRtf(file){
    try {
      const raw = await file.text();
      return normalizeText(raw
        .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\[a-zA-Z]+-?\d*(?:\s|)/g, ' ')
        .replace(/[{}]/g, ' ')
      );
    } catch {
      return '[RTF parsing failed]';
    }
  }

  /** OCR an image to text using Tesseract.js and report progress via DV.bus. */
  async function readImageWithOCR(file){
    await ensureTesseract();
    const blobUrl = URL.createObjectURL(file);
    try {
      const { data } = await window.Tesseract.recognize(blobUrl, undefined, { logger: m => DV.bus && DV.bus.emit && DV.bus.emit('ocr:progress', { ...m, file: file.name }) });
      return normalizeText(data?.text || '');
    } finally {
      setTimeout(()=> URL.revokeObjectURL(blobUrl), 3000);
    }
  }

  /** Extract embedded text from PDF with pdf.js, yielding between pages. */
  async function readPdfWithText(pdfFile){
    await ensurePdfJs();
    const buf = await pdfFile.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let out = [];
    for (let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str || '').join(' ');
      out.push(pageText);
      if (i % 3 === 0) await sleep(0);
    }
    return normalizeText(out.join('\n\n'));
  }

  /** Render pages to canvas and OCR them; limited to OCR_MAX_PAGES for cost. */
  async function readPdfWithOCR(pdfFile){
    await ensurePdfJs();
    await ensureTesseract();
    const buf = await pdfFile.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const texts = [];
    const pages = Math.min(pdf.numPages, OCR_MAX_PAGES);
    for (let i=1; i<=pages; i++){
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await window.Tesseract.recognize(canvas, undefined, { logger: m => DV.bus && DV.bus.emit && DV.bus.emit('ocr:progress', { ...m, page: i, file: pdfFile.name }) });
      texts.push(data?.text || '');
      canvas.width = canvas.height = 0;
      await sleep(0);
    }
    if (pdf.numPages > OCR_MAX_PAGES) texts.push(`\n[Truncated OCR at ${OCR_MAX_PAGES} pages of ${pdf.numPages}]`);
    return normalizeText(texts.join('\n\n'));
  }

  /**
   * Read a PDF by preferring embedded text, falling back to OCR on low-density text
   * or failure paths. Returns diagnostic messages when both strategies fail.
   */
  async function readPdf(file){
    try {
      const text = await readPdfWithText(file);
      if (text && text.replace(/\s+/g, '').length > 100) return text;
      const ocr = await readPdfWithOCR(file);
      return ocr || text || '[Empty PDF]';
    } catch (e) {
      try {
        return await readPdfWithOCR(file);
      } catch (e2) {
        return '[PDF extraction failed: ' + (e2 && (e2.message || e2)) + ']';
      }
    }
  }

  /**
   * Entrypoint for file extraction, dispatching by mime/extension, with helpful
   * diagnostics for unsupported formats. Returns a normalized item object.
   * @param {File} file
   * @returns {Promise<{kind:'file', title:string, fileName:string, fileType:string, size:number, text:string}>>}
   */
  async function extractFromFile(file) {
    const ext = extOf(file.name);
    const type = (file.type || '').toLowerCase();
    let text = '';
    try {
      if (type.startsWith('image/') || ['png','jpg','jpeg','webp','bmp','gif','tif','tiff'].includes(ext)) {
        text = await readImageWithOCR(file);
      } else if (ext === 'pdf' || type === 'application/pdf') {
        text = await readPdf(file);
      } else if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await readDocx(file);
      } else if (ext === 'rtf' || type === 'application/rtf' || type === 'text/rtf') {
        text = await readRtf(file);
      } else if (ext === 'html' || ext === 'htm' || type === 'text/html') {
        text = await readHtml(file);
      } else if (ext === 'txt' || ext === 'md' || type.startsWith('text/')) {
        text = await readTextFile(file);
      } else if (ext === 'doc') {
        text = '[.doc (legacy Word) is not supported for local extraction. Please convert to PDF or DOCX.]';
      } else {
        text = await readTextFile(file).catch(()=> '');
        if (!text) text = `[Unsupported file type: ${ext || type || 'unknown'}]`;
      }
    } catch (e) {
      text = '[Extraction failed: ' + (e && (e.message || e)) + ']';
    }

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