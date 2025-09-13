// File extractors with local OCR and common formats (PDF/DOCX/TXT/HTML/Images)
(function(){
  // --- Utilities ---
  function extOf(name=''){ return (String(name).split('.').pop() || '').toLowerCase(); }
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function normalizeText(s=''){
    return String(s)
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \u200b\u200c\u200d\ufeff]+/g, ' ')
      .trim();
  }

  // Lazy load external libs only when needed
  const _once = {};
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

  // Optional configuration sourced from app settings
  function getOcrLang(){
    try { return (DV.queue && DV.queue.getSettings && (DV.queue.getSettings().ocrLang || 'eng')) || 'eng'; } catch { return 'eng'; }
  }
  function getOcrMaxPages(){
    try { const n = DV.queue && DV.queue.getSettings && Number(DV.queue.getSettings().ocrMaxPages); return n>0?Math.min(200, n):30; } catch { return 30; }
  }

  async function ensurePdfJs(){
    // pdf.js 3.x UMD
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js', () => !!(window.pdfjsLib));
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';
      } catch {}
    }
  }

  async function ensureTesseract(){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js', () => !!window.Tesseract);
  }

  async function ensureMammoth(){
    await loadScriptOnce('https://unpkg.com/mammoth/mammoth.browser.min.js', () => !!window.mammoth);
  }

  // --- Readers ---
  async function readTextFile(file) {
    return await file.text();
  }

  function htmlToMainText(html){
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Remove scripts/styles and obvious non-content
      doc.querySelectorAll('script,style,noscript,template,iframe,canvas,svg,form,header,footer,nav,aside,menu,dialog').forEach(n=>n.remove());
      // heuristic: pick longest section/div by text length, else body
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

  async function readHtml(file){
    const html = await file.text();
    return htmlToMainText(html);
  }

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

  // Very naive RTF-to-text fallback (won't handle complex formatting)
  async function readRtf(file){
    try {
      const raw = await file.text();
      // Remove RTF control words and groups
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

  async function readImageWithOCR(file, ocrLang=getOcrLang()){
    await ensureTesseract();
    const blobUrl = URL.createObjectURL(file);
    try {
      const { data } = await window.Tesseract.recognize(blobUrl, ocrLang, { logger: m => DV.bus && DV.bus.emit && DV.bus.emit('ocr:progress', { ...m, file: file.name }) });
      return normalizeText(data?.text || '');
    } finally {
      setTimeout(()=> URL.revokeObjectURL(blobUrl), 3000);
    }
  }

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
      if (i % 3 === 0) await sleep(0); // yield
    }
    return normalizeText(out.join('\n\n'));
  }

  async function readPdfWithOCR(pdfFile, ocrLang=getOcrLang(), maxPages=getOcrMaxPages()){
    await ensurePdfJs();
    await ensureTesseract();
    const buf = await pdfFile.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const texts = [];
    const pages = Math.min(pdf.numPages, maxPages);
    for (let i=1; i<=pages; i++){
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await window.Tesseract.recognize(canvas, ocrLang, { logger: m => DV.bus && DV.bus.emit && DV.bus.emit('ocr:progress', { ...m, page: i, file: pdfFile.name }) });
      texts.push(data?.text || '');
      // cleanup
      canvas.width = canvas.height = 0;
      await sleep(0);
    }
    if (pdf.numPages > maxPages) texts.push(`\n[Truncated OCR at ${maxPages} pages of ${pdf.numPages}]`);
    return normalizeText(texts.join('\n\n'));
  }

  async function readPdf(file){
    // Try text extraction first; if too little text, fallback to OCR
    try {
      const text = await readPdfWithText(file);
      if (text && text.replace(/\s+/g, '').length > 100) return text;
      const ocr = await readPdfWithOCR(file);
      return ocr || text || '[Empty PDF]';
    } catch (e) {
      try {
        // Fallback straight to OCR
        return await readPdfWithOCR(file);
      } catch (e2) {
        return '[PDF extraction failed: ' + (e2 && (e2.message || e2)) + ']';
      }
    }
  }

  // --- Main dispatcher ---
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
        // Try as text, otherwise note unsupported
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
