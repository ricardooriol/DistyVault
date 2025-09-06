/**
 * ApiClient - Browser orchestrator
 * - Uses serverless /src/apis/* only for extraction (URL, file, YouTube)
 * - Persists via IndexedDB (sql.js kept client-side)
 * - Distills via AIService (online providers only)
 */
class ApiClient {
    constructor() {
        this.base = '/api';
        this.db = new Database();
        this.ai = new AIService();
    // Prefer client-only mode to avoid 404 noise unless explicitly enabled
    try { this.serverEnabled = !!(typeof window !== 'undefined' && window.DV_USE_SERVER); } catch { this.serverEnabled = false; }
    this.cancellations = new Map(); // id -> { cancelled: boolean }
    }

    // Helper
    async _json(res) {
        const ct = res.headers.get('Content-Type') || '';
        if (ct.includes('application/json')) return res.json();
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { status: res.status, text }; }
    }

    async _handle(res) {
        if (!res.ok) {
            const body = await this._json(res);
            const message = body?.message || body?.error || `HTTP ${res.status}`;
            const err = new Error(message);
            err.status = res.status;
            throw err;
        }
        return this._json(res);
    }

    /** Get all summaries from client DB */
    async getSummaries() { return this.db.getAllSummaries(); }

    /** Get single summary */
    async getSummary(id) { return this.db.getDistillation(id); }

    /** Delete summary */
    async deleteSummary(id) { return this.db.deleteDistillation(id); }

    /** Retry distillation using saved rawContent only (no re-scrape) */
    async retryDistillation(id) {
        const item = await this.db.getDistillation(id);
        if (!item) throw new Error('Distillation not found');
        if (!item.rawContent || item.rawContent.trim().length < 10) {
            // Try re-extracting if we have a source
            if (item.sourceUrl) {
                await this._processUrlPipeline(id, item.sourceUrl);
                return { status: 'ok', reextracted: true };
            }
            if (item.sourceFile && item.sourceFile.blob instanceof Blob) {
                await this._processFilePipeline(id, item.sourceFile.blob);
                return { status: 'ok', reextracted: true };
            }
            throw new Error('No saved raw text to retry; re-extraction required');
        }
        // Reset timers to ensure Duration restarts on retry
        await this.db.resetTiming(id);
        await this.db.addLog(id, 'Retry initiated');
    await this.db.updateDistillationStatus(id, 'distilling', 'Regenerating with AI');
        const raw = item.rawContent;
        const cancelled = this._isCancelled(id);
        if (cancelled) { await this._markStopped(id); return { status: 'stopped' }; }
        const distilled = await this.ai.distillContent(raw);
        const wordCount = (distilled || '').split(/\s+/).length;
        await this.db.updateDistillationContent(id, distilled, raw, 0, wordCount);
        await this.db.addLog(id, 'AI distillation completed', 'info', { wordCount });
        return { status: 'ok' };
    }

    /** Stop background processing */
    async stopProcessing(id) {
        this.cancellations.set(id, { cancelled: true });
    await this.db.updateDistillationStatus(id, 'stopped', 'Processing stopped by user');
    await this.db.addLog(id, 'Processing stopped by user', 'warn');
        return { status: 'ok', message: 'Process stopped' };
    }

    /** Download as PDF (client-side) using jsPDF + html2canvas */
    async downloadPdf(id) {
        const item = await this.db.getDistillation(id);
        if (!item || !item.content) throw new Error('Nothing to download');
        // Lazy-load jsPDF and html2canvas from CDN
        await this._ensurePdfLibs();
        // Build a styled HTML in an offscreen iframe to ensure fonts and layout
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '900px';
        iframe.style.height = '1200px';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;
        const safeTitle = (item.title || 'Distillation');
    const isDocument = (item.sourceType === 'file');
    const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const sourceUrl = !isDocument && item.sourceUrl ? String(item.sourceUrl) : '';
    const urlLine = sourceUrl ? `<div class=\"meta-row\"><span class=\"label\">URL:</span> <a href=\"${escapeHtml(sourceUrl)}\" target=\"_blank\">${escapeHtml(sourceUrl)}</a></div>` : '';
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>${safeTitle}</title>
            <style>
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; background: #fff; margin: 40px; line-height: 1.6; }
            h1,h2,h3 { margin: 0.6em 0 0.3em; font-weight: 700; }
            h1 { font-size: 24pt; }
            h2 { font-size: 18pt; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            h3 { font-size: 14pt; }
            p, li { font-size: 11pt; }
            strong { font-weight: 700; }
            .title { font-size: 24pt; font-weight: 800; margin-bottom: 6px; }
            .meta { color: #555; font-size: 10pt; margin-bottom: 10px; }
            .meta .meta-row { margin: 2px 0; }
            .meta .label { color: #777; font-weight: 600; margin-right: 6px; }
            .meta a { color: #0a66c2; text-decoration: none; }
            .meta a:hover { text-decoration: underline; }
            .divider { height: 2px; background: linear-gradient(90deg, #e5e7eb, #cbd5e1, #e5e7eb); border: 0; margin: 14px 0 20px; }
            .content { font-size: 11pt; }
            .content ol { padding-left: 1.2em; }
            .content li { margin: 6px 0; }
            .content b, .content strong { font-weight: 700; }
            .footer { margin-top: 24px; color: #888; font-size: 9pt; text-align: right; }
            </style></head><body>
                        <div class=\"title\">${escapeHtml(safeTitle)}</div>
                        <div class=\"meta\">
                            <div class=\"meta-row\">Generated by DistyVault • ${escapeHtml(new Date().toLocaleString())}</div>
                            ${!isDocument ? urlLine : ''}
                        </div>
                        <hr class=\"divider\" />
            <div class=\"content\">${item.content}</div>
            <div class=\"footer\">Generated by DistyVault</div>
        </body></html>`);
        doc.close();
        // Wait for fonts/layout to settle
        await new Promise(r => setTimeout(r, 50));
        const target = doc.body;
    const opt = { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 900, logging: false };
        const canvas = await window.html2canvas(target, opt);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new window.jspdf.jsPDF('p', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 80; // margins
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let y = 40;
        let remainingHeight = imgHeight;
        let position = y;
        // Add pages if content exceeds one page
        const pageImgHeight = pageHeight - 80; // 40 top/bottom margins
        let srcY = 0;
        const pxPerPt = canvas.height / imgHeight; // map rendered image height in pt to canvas px
        while (remainingHeight > 0) {
            const sliceHeightPt = Math.min(pageImgHeight, remainingHeight);
            const sliceHeightPx = Math.floor(sliceHeightPt * pxPerPt);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            const ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
            const sliceImg = sliceCanvas.toDataURL('image/png');
            pdf.addImage(sliceImg, 'PNG', 40, position, imgWidth, sliceHeightPt);
            remainingHeight -= sliceHeightPt;
            srcY += sliceHeightPx;
            if (remainingHeight > 0) {
                pdf.addPage();
                position = y;
            }
        }
        // Add a clickable URL overlay on the first page if available (kept above the rendered image area)
        if (sourceUrl) {
            try {
                pdf.setPage(1);
                pdf.setFont('helvetica','normal');
                pdf.setFontSize(10);
                pdf.setTextColor(10, 102, 194);
                // Place in the top margin (above y=40 where content image starts)
                if (pdf.textWithLink) {
                    pdf.textWithLink(`URL: ${sourceUrl}`, 40, 28, { url: sourceUrl });
                } else if (pdf.link) {
                    // Fallback: draw text then add rectangular link
                    const text = `URL: ${sourceUrl}`;
                    pdf.text(text, 40, 28);
                    const width = (pdf.getTextWidth ? pdf.getTextWidth(text) : 200);
                    pdf.link(40, 20, width, 12, { url: sourceUrl });
                }
                pdf.setTextColor(0, 0, 0);
            } catch {}
        }
    document.body.removeChild(iframe);
        const blob = pdf.output('blob');
        const headers = new Headers({ 'Content-Disposition': `attachment; filename="${this._safeFilename((item.title||'distillation'))}.pdf"` });
        return { blob, headers, status: 200 };
    }

    /** Bulk download: sequentially trigger PDF downloads for given ids */
    async bulkDownload(ids) {
        let count = 0;
        for (const id of ids) {
            try {
                const res = await this.downloadPdf(id);
                const blob = res.blob;
                const item = await this.db.getDistillation(id);
                const filename = `${this._safeFilename(item?.title || `distillation-${id}`)}.pdf`;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                await new Promise(r => setTimeout(r, 200));
                window.URL.revokeObjectURL(url);
                a.remove();
                count++;
            } catch (e) {
                // continue with next
            }
        }
        // Indicate to caller that downloads were triggered individually; no combined blob to download
        return { skipDownload: true, status: 200, completed: count, total: ids.length };
    }

    /** Bulk delete */
    async bulkDelete(ids) {
        const results = await Promise.all(ids.map(id => this.db.deleteDistillation(id)));
        const deletedCount = results.filter(Boolean).length;
        return { deletedCount };
    }

    /** Process URL: extract via API, then distill client-side */
    async processUrl(url) {
        // Create tracking distillation
    const dist = this._createDistillation({ sourceUrl: url, sourceType: this._detectUrlType(url), title: this._titleFromUrl(url) });
        await this.db.saveDistillation(dist);
        // Run pipeline asynchronously
        this._processUrlPipeline(dist.id, url).catch(() => {});
        return { id: dist.id, status: 'queued' };
    }

    /** Process uploaded file: extract via API, then distill client-side */
    async processFile(file) {
        const dist = this._createDistillation({ sourceType: 'file', sourceFile: { name: file.name, type: file.type, size: file.size, blob: file }, title: file.name });
        await this.db.saveDistillation(dist);
        this._processFilePipeline(dist.id, file).catch(() => {});
        return { id: dist.id, status: 'queued' };
    }

    /** Settings: use localStorage only (no server) */
    async getAiSettings() {
        const stored = localStorage.getItem('ai-provider-settings');
        if (stored) return JSON.parse(stored);
        return {
            mode: 'online',
            concurrentProcessing: 1,
            offline: { model: '', endpoint: 'http://localhost:11434' },
            online: { provider: '', apiKey: '', model: 'gpt-4o', endpoint: '' },
            lastUpdated: new Date().toISOString()
        };
    }

    /** Save AI settings locally and also mirror into AIService config */
    async saveAiSettings(settings) {
        localStorage.setItem('ai-provider-settings', JSON.stringify({ ...settings, online: { ...settings.online, apiKey: '' } }));
        // Mirror minimal config for AIService
        const aiCfg = {
            mode: 'online',
            provider: settings.online?.provider || '',
            model: settings.online?.model || '',
            apiKey: settings.online?.apiKey || '',
            ollamaEndpoint: settings.offline?.endpoint || 'http://localhost:11434',
            ollamaModel: settings.offline?.model || ''
        };
        this.ai.saveConfig(aiCfg);
        return { status: 'ok' };
    }

    /** Test AI provider directly from browser */
    async testAiProvider(config) { return this.ai.testConnection({
        mode: 'online', provider: config.type || config.provider, model: config.model, apiKey: config.apiKey
    }); }

    /** Basic client-side validation */
    async validateAiConfig(config) {
        const errors = [];
        if (!config || !config.type) errors.push('Provider is required');
        if (config && ['openai','anthropic','google','grok','deepseek'].includes(config.type) && !config.apiKey) errors.push('API key is required');
        return { valid: errors.length === 0, errors };
    }

    /** Test Ollama via AIService */
    async testOllamaConnection(config) { return this.ai.testOllamaConnection({ ollamaEndpoint: config?.endpoint }); }

    /**
     * Test AI provider connection
     */
    async testProviderConnection(config) {
        return this.testAiProvider(config);
    }

    /** Queue settings are no-op in client mode */
    async updateProcessingQueueSettings(settings) { return { status: 'ok' }; }

    /** Serverless health (not required); return true */
    async isServerResponsive() { return true; }

    // ----------------------
    // Internal helpers
    // ----------------------
    _createDistillation({ sourceUrl = null, sourceType, title, sourceFile = null }) {
        return {
            id: `dist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            title: title || 'Untitled',
            content: '',
            sourceUrl,
            sourceType,
            sourceFile,
            status: 'pending',
            processingStep: 'Queued for processing',
            rawContent: '',
            createdAt: new Date(),
            completedAt: null,
            processingTime: 0,
            elapsedTime: 0,
            startTime: new Date(),
            distillingStartTime: null,
            wordCount: 0,
            error: null,
            logs: []
        };
    }

    async _processUrlPipeline(id, url) {
        try {
            const cancelled = this._isCancelled(id);
            if (cancelled) { await this._markStopped(id); return; }
            await this.db.resetTiming(id);
            await this.db.updateDistillationStatus(id, 'extracting', 'Extracting content...');
            await this.db.addLog(id, 'Extraction started', 'info', { url });
            // Extract: use client extractor by default to avoid 404 logs; opt-in server with window.DV_USE_SERVER
            let extraction;
            if (this.serverEnabled) {
                try {
                    const extractRes = await fetch(`${this.base}/process/url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
                    if (extractRes.status === 404) {
                        throw Object.assign(new Error('Serverless API not available (404). Using client fallback.'), { status: 404 });
                    }
                    const payload = await this._handle(extractRes);
                    extraction = payload.extraction || payload;
                } catch (e) {
                    const status = e?.status || 0;
                    await this.db.addLog(id, 'Serverless API unavailable, using client-side extractor', 'warn', { status, message: e?.message });
                    extraction = await this._extractUrlClient(url);
                }
            } else {
                extraction = await this._extractUrlClient(url);
            }
            if (extraction.contentType === 'youtube-playlist' && extraction.metadata?.videos?.length) {
                // Spawn items for each video and delete tracking
                for (const v of extraction.metadata.videos) {
                    try { await this.processUrl(v); } catch {}
                    await new Promise(r => setTimeout(r, 100));
                }
                await this.db.deleteDistillation(id);
                return;
            }
            await this.db.addLog(id, 'Extraction completed', 'info', { contentType: extraction.contentType });
            const item = await this.db.getDistillation(id);
            item.rawContent = extraction.text || '';
            item.title = extraction.title || item.title;
            item.extractionMetadata = {
                contentType: extraction.contentType,
                extractionMethod: extraction.extractionMethod,
                fallbackUsed: extraction.fallbackUsed,
                meta: extraction.metadata || {}
            };
            await this.db.saveDistillation(item);
            // Distill
            await this.db.updateDistillationStatus(id, 'distilling', 'Processing with AI...');
            await this.db.addLog(id, 'AI distillation started', 'info');
            if (this._isCancelled(id)) { await this._markStopped(id); return; }
            const distilled = await this.ai.distillContent(item.rawContent, { id });
            const wordCount = (distilled || '').split(/\s+/).length;
            await this.db.updateDistillationContent(id, distilled, item.rawContent, 0, wordCount);
            await this.db.addLog(id, 'Processing completed successfully', 'info', { wordCount });
        } catch (e) {
            await this.db.updateDistillationStatus(id, 'error', e?.message || 'Processing failed');
            await this.db.addLog(id, 'Processing error', 'error', { message: e?.message || String(e) });
        }
    }

    /**
     * Client-side URL extraction using a CORS-friendly proxy (no backend needed)
     * - Attempts to fetch simplified HTML via https://r.jina.ai/<URL>
     * - Parses and extracts main content heuristically in the browser
     */
    async _extractUrlClient(url) {
        // Normalize URL
        let target = String(url || '').trim();
        if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
        const proxyUrl = `https://r.jina.ai/${encodeURI(target)}`;
        const res = await fetch(proxyUrl, { method: 'GET' });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Client extractor failed: HTTP ${res.status}${text ? ' - ' + text.slice(0, 200) : ''}`);
        }
        const html = await res.text();

        // Parse HTML and extract content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const title = (doc.querySelector('title')?.textContent || target).trim();

        // Remove noisy nodes
        const removeSelectors = 'script,style,nav,footer,header,aside,iframe,object,embed,form';
        doc.querySelectorAll(removeSelectors).forEach(n => n.remove());

        // Try main/article/content containers
        const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.post', '.entry', '#content', '.main'];
        let container = null;
        for (const sel of mainSelectors) {
            const el = doc.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 200) { container = el; break; }
        }
        if (!container) container = doc.body || doc.documentElement;

        // Basic cleaning and normalization
        const text = (container?.textContent || '').replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        const metaDesc = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();
        const content = text && text.length >= 100 ? text : metaDesc;

        return {
            text: content || (text || `This page at ${target} appears to have limited extractable text.`),
            title,
            contentType: 'webpage',
            extractionMethod: 'client-proxy',
            fallbackUsed: true,
            metadata: { url: target }
        };
    }

    async _processFilePipeline(id, file) {
        try {
            const cancelled = this._isCancelled(id);
            if (cancelled) { await this._markStopped(id); return; }
            await this.db.resetTiming(id);
            await this.db.updateDistillationStatus(id, 'extracting', `Extracting content from ${file.name}...`);
            await this.db.addLog(id, 'Extraction started', 'info', { file: { name: file.name, type: file.type, size: file.size } });
            const form = new FormData();
            form.append('file', file, file.name);
            const res = await fetch(`${this.base}/process/file`, { method: 'POST', body: form });
            const payload = await this._handle(res);
            const extraction = payload.extraction || payload;
            await this.db.addLog(id, 'Extraction completed', 'info', { contentType: extraction.contentType });
            const item = await this.db.getDistillation(id);
            item.rawContent = extraction.text || '';
            item.title = extraction.title || item.title;
            item.extractionMetadata = {
                contentType: extraction.contentType,
                extractionMethod: extraction.extractionMethod,
                fallbackUsed: extraction.fallbackUsed,
                meta: extraction.metadata || {}
            };
            await this.db.saveDistillation(item);
            await this.db.updateDistillationStatus(id, 'distilling', 'Processing with AI...');
            if (this._isCancelled(id)) { await this._markStopped(id); return; }
            const distilled = await this.ai.distillContent(item.rawContent, { id });
            const wordCount = (distilled || '').split(/\s+/).length;
            await this.db.updateDistillationContent(id, distilled, item.rawContent, 0, wordCount);
            await this.db.addLog(id, 'Processing completed successfully', 'info', { wordCount });
        } catch (e) {
            await this.db.updateDistillationStatus(id, 'error', e?.message || 'Processing failed');
            await this.db.addLog(id, 'Processing error', 'error', { message: e?.message || String(e) });
        }
    }

    _detectUrlType(url) {
        try {
            const u = new URL(url);
            if (/youtube\.com|youtu\.be/.test(u.hostname)) return 'youtube';
            return 'url';
        } catch { return 'url'; }
    }

    _titleFromUrl(url) { try { const u = new URL(url); return u.hostname + u.pathname; } catch { return url; } }
    _isCancelled(id) { return this.cancellations.get(id)?.cancelled; }
    async _markStopped(id) { await this.db.updateDistillationStatus(id, 'stopped', 'Processing stopped by user'); }
    _safeFilename(name) { return String(name).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase() || 'distillation'; }

    async _ensurePdfLibs() {
        if (window.jspdf && window.html2canvas) return;
        // Load html2canvas
        if (!window.html2canvas) {
            await this._loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        }
        // Load jsPDF
        if (!window.jspdf) {
            await this._loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
        }
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(s);
        });
    }
}

// Export for use in other modules
window.ApiClient = ApiClient;