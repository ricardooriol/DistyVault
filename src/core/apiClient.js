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
        // Concurrency control (default 1)
        this.concurrentLimit = 1;
        this.activeTasks = 0;
        this.taskQueue = [];
        try {
            const raw = localStorage.getItem('ai-provider-settings');
            if (raw) {
                const cfg = JSON.parse(raw);
                const n = parseInt(cfg?.concurrentProcessing);
                if (Number.isFinite(n) && n >= 1 && n <= 10) this.concurrentLimit = n;
            }
        } catch {}
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
                            ${!isDocument ? urlLine : ''}
                            <div class=\"meta-row\">${escapeHtml(new Date().toLocaleString())}</div>
                        </div>
                        <hr class=\"divider\" />
            <div class=\"content\">${item.content}</div>
                        <hr class=\"divider\" />
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
    // Removed top clickable URL overlay per request; URL is shown only in the meta section
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
        // If this is a YouTube playlist, expand into individual videos BEFORE creating any item
        if (this._isYouTubePlaylist(url)) {
            try {
                const videos = await this._expandYouTubePlaylist(url);
                if (Array.isArray(videos) && videos.length > 0) {
                    for (const v of videos) {
                        try { await this.processUrl(v); } catch {}
                        await new Promise(r => setTimeout(r, 50));
                    }
                    return { status: 'spawned', count: videos.length };
                }
                throw new Error('Playlist has no public videos or could not be expanded.');
            } catch (e) {
                // Surface error to caller without creating a placeholder row
                throw new Error(e?.message || 'Failed to expand YouTube playlist');
            }
        }
        // Create tracking distillation for non-playlist URLs
        const dist = this._createDistillation({ sourceUrl: url, sourceType: this._detectUrlType(url), title: this._titleFromUrl(url) });
        await this.db.saveDistillation(dist);
        // Run pipeline asynchronously
        this._runWithLimit(() => this._processUrlPipeline(dist.id, url)).catch(() => {});
        return { id: dist.id, status: 'queued' };
    }

    /** Process uploaded file: extract via API, then distill client-side */
    async processFile(file) {
        const dist = this._createDistillation({ sourceType: 'file', sourceFile: { name: file.name, type: file.type, size: file.size, blob: file }, title: file.name });
        await this.db.saveDistillation(dist);
    this._runWithLimit(() => this._processFilePipeline(dist.id, file)).catch(() => {});
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

    /** Save AI settings locally (persist all fields including API key) and mirror into AIService */
    async saveAiSettings(settings) {
        // Persist full settings including apiKey for session persistence
        localStorage.setItem('ai-provider-settings', JSON.stringify(settings));
        // Mirror config for AIService
        const aiCfg = {
            mode: 'online',
            provider: settings.online?.provider || '',
            model: settings.online?.model || '',
            apiKey: settings.online?.apiKey || '',
            ollamaEndpoint: settings.offline?.endpoint || 'http://localhost:11434',
            ollamaModel: settings.offline?.model || ''
        };
        this.ai.saveConfig(aiCfg);
        // Update concurrency limit immediately
        const n = parseInt(settings?.concurrentProcessing);
        if (Number.isFinite(n) && n >= 1 && n <= 10) this.concurrentLimit = n; else this.concurrentLimit = 1;
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

            // Special handling: YouTube playlist should expand into individual video items
            if (this._isYouTubePlaylist(url)) {
                try {
                    const videos = await this._expandYouTubePlaylist(url);
                    if (Array.isArray(videos) && videos.length > 0) {
                        await this.db.addLog(id, 'YouTube playlist detected; enqueueing videos', 'info', { count: videos.length });
                        for (const v of videos) {
                            try { await this.processUrl(v); } catch {}
                            await new Promise(r => setTimeout(r, 100));
                        }
                        await this.db.deleteDistillation(id);
                        return; // Stop processing the playlist item itself
                    }
                } catch (e) {
                    await this.db.addLog(id, 'Failed to expand YouTube playlist; continuing with generic extraction', 'warn', { message: e?.message || String(e) });
                }
            }
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

    // ---------
    // YouTube helpers
    // ---------
    _isYouTubeUrl(u) {
        try { const h = new URL(u).hostname; return /youtube\.com|youtu\.be/i.test(h); } catch { return false; }
    }
    _isYouTubePlaylist(u) {
        if (!this._isYouTubeUrl(u)) return false;
        const s = String(u);
        const hasList = /[?&]list=/.test(s);
        const isDirectVideo = /(watch\?v=|youtu\.be\/|\/embed\/)/i.test(s);
        return hasList && !isDirectVideo; // treat pure playlist links only
    }
    _extractYouTubePlaylistId(u) {
        const m = String(u).match(/[?&]list=([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
    }
    async _expandYouTubePlaylist(playlistUrl) {
        const id = this._extractYouTubePlaylistId(playlistUrl);
        if (!id) return [];
        // Use CORS-friendly proxy to fetch playlist page content
        const target = `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`;
        const proxy = `https://r.jina.ai/${target}`;
        const res = await fetch(proxy, { method: 'GET' });
        if (!res.ok) return [];
        const html = await res.text();
        // Extract video IDs via robust patterns
        const idMatches = [];
        const m1 = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [];
        for (const m of m1) { const mm = m.match(/"videoId":"([a-zA-Z0-9_-]{11})"/); if (mm) idMatches.push(mm[1]); }
        const m2 = html.match(/watch\?v=([a-zA-Z0-9_-]{11})/g) || [];
        for (const m of m2) { const mm = m.match(/watch\?v=([a-zA-Z0-9_-]{11})/); if (mm) idMatches.push(mm[1]); }
        const unique = Array.from(new Set(idMatches));
        return unique.map(v => `https://www.youtube.com/watch?v=${v}`);
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
        // Title selection: prefer OG/Twitter title, then <title>, then first <h1>, then derive from URL
        const metaOg = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const metaTw = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
        const htmlTitle = doc.querySelector('title')?.textContent;
        const h1Title = doc.querySelector('h1')?.textContent;
        let title = (metaOg || metaTw || htmlTitle || h1Title || '').trim();
        if (!title) {
            try {
                const u = new URL(target);
                const segs = u.pathname.split('/').filter(Boolean);
                let last = decodeURIComponent((segs[segs.length - 1] || '').replace(/\.[a-z0-9]{1,6}$/i, ''));
                last = last.replace(/[\-_]+/g, ' ').trim();
                title = last || u.hostname;
            } catch { title = target; }
        }
        // Clean common suffixes like " - YouTube" or site names
        title = title.replace(/\s*[|\-]\s*(YouTube|YouTube Music|Medium|Substack|Blog|News).*$/i, '').trim();

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
            let extraction;
            if (this.serverEnabled) {
                try {
                    const form = new FormData();
                    form.append('file', file, file.name);
                    const res = await fetch(`${this.base}/process/file`, { method: 'POST', body: form });
                    if (res.status === 404) {
                        throw Object.assign(new Error('Serverless API not available (404). Using client fallback.'), { status: 404 });
                    }
                    const payload = await this._handle(res);
                    extraction = payload.extraction || payload;
                } catch (e) {
                    const status = e?.status || 0;
                    await this.db.addLog(id, 'Serverless file API unavailable, using client-side extractor', 'warn', { status, message: e?.message });
                    extraction = await this._extractFileClient(file);
                }
            } else {
                extraction = await this._extractFileClient(file);
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

    /**
     * Client-side file extraction (no backend): supports text, PDF, DOCX, HTML/Markdown
     */
    async _extractFileClient(file) {
        const name = file?.name || 'document';
        const type = (file?.type || '').toLowerCase();
        const lowerName = String(name).toLowerCase();
        const meta = { name, size: file?.size || 0, type: type || 'unknown' };
        const title = this._stripExtension(name);

        // Helper: read file
        const readAsText = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Failed to read file as text')); r.readAsText(blob); });
        const readAsArrayBuffer = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Failed to read file as arrayBuffer')); r.readAsArrayBuffer(blob); });

        // 1) Plain text-like
        if (type.startsWith('text/') || /\.(txt|md|csv|tsv|log|json|xml|html?)$/i.test(lowerName)) {
            const raw = await readAsText(file);
            let text = String(raw || '');
            let method = 'file-reader-text';
            let contentType = 'text';
            // Basic HTML to text
            if (/\.html?$/i.test(lowerName) || type.includes('html')) {
                try { const doc = new DOMParser().parseFromString(text, 'text/html'); text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim(); method = 'domparser-html-to-text'; contentType = 'html'; }
                catch {}
            }
            return { text, title, contentType, extractionMethod: method, fallbackUsed: true, metadata: meta };
        }

        // 2) PDF via pdf.js
        if (type === 'application/pdf' || /\.pdf$/i.test(lowerName)) {
            await this._ensurePdfJs();
            const data = await readAsArrayBuffer(file);
            const pdfjsLib = window['pdfjsLib'];
            if (!pdfjsLib || !pdfjsLib.getDocument) throw new Error('PDF.js failed to load');
            const docOptsBase = {
                data: new Uint8Array(data),
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
                standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
            };
            const loadPdf = async () => (await pdfjsLib.getDocument(docOptsBase).promise);
            const pdf = await loadPdf();
            const maxPages = Math.min(pdf.numPages, 50); // cap to avoid heavy work

            const buildPageText = async (page, opts = {}) => {
                const content = await page.getTextContent({ normalizeWhitespace: true, includeMarkedContent: true, ...opts });
                const items = content.items || [];
                if (!items.length) return '';
                // Reconstruct lines using y/x positions
                let out = '';
                let lastY = null;
                let lastX = null;
                for (const it of items) {
                    const str = (it.str || '').trim();
                    if (!str) continue;
                    const tr = it.transform || [1, 0, 0, 1, 0, 0];
                    const x = tr[4];
                    const y = tr[5];
                    if (lastY === null) {
                        out += str;
                        lastY = y; lastX = x;
                        continue;
                    }
                    const deltaY = Math.abs(y - lastY);
                    const deltaX = Math.abs(x - lastX);
                    if (deltaY > 5) {
                        out += '\n';
                    } else if (deltaX > 2) {
                        out += ' ';
                    }
                    out += str;
                    lastY = y; lastX = x;
                    if (it.hasEOL) out += '\n';
                }
                return out;
            };

            const assemble = async (opts) => {
                let buf = '';
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const pageText = await buildPageText(page, opts);
                    if (pageText) buf += pageText + '\n\n';
                }
                return buf;
            };

            let text = (await assemble({ disableCombineTextItems: false })) || '';
            if (!text.trim()) {
                // Retry with combine disabled (more granular items)
                text = (await assemble({ disableCombineTextItems: true })) || '';
            }
            text = text.replace(/[ \t\u00A0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
            if (!text) text = 'No text could be extracted from this PDF.';
            return { text, title, contentType: 'pdf', extractionMethod: text ? 'pdfjs-heuristic' : 'pdfjs-empty', fallbackUsed: true, metadata: meta };
        }

        // 3) DOCX via mammoth
        if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(lowerName)) {
            await this._ensureMammoth();
            const data = await readAsArrayBuffer(file);
            const mammoth = window['mammoth'];
            if (!mammoth || !mammoth.extractRawText) throw new Error('Mammoth failed to load');
            const result = await mammoth.extractRawText({ arrayBuffer: data });
            const text = (result?.value || '').replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
            return { text: text || 'No text could be extracted from this DOCX.', title, contentType: 'docx', extractionMethod: 'mammoth', fallbackUsed: true, metadata: meta };
        }

        // 4) Fallback: try text
        try {
            const raw = await readAsText(file);
            return { text: String(raw || ''), title, contentType: type || 'file', extractionMethod: 'file-reader-fallback', fallbackUsed: true, metadata: meta };
        } catch {}

        throw new Error(`Unsupported file type: ${type || 'unknown'}`);
    }

    async _ensurePdfJs() {
        if (window['pdfjsLib'] && window['pdfjsLib'].getDocument) return;
        await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        // Configure worker and ancillary assets
        if (window['pdfjsLib'] && window['pdfjsLib'].GlobalWorkerOptions) {
            window['pdfjsLib'].GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    async _ensureMammoth() {
        if (window['mammoth'] && (window['mammoth'].extractRawText || window['mammoth'].convertToHtml)) return;
        await this._loadScript('https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js');
    }

    _stripExtension(name) {
        return String(name || '')
            .replace(/\.[^/.]+$/, '')
            .trim() || 'Document';
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

    // Concurrency gate: run fn when a slot becomes available
    async _runWithLimit(fn) {
        return new Promise((resolve) => {
            const task = async () => {
                this.activeTasks++;
                try { resolve(await fn()); }
                finally {
                    this.activeTasks--;
                    this._drainQueue();
                }
            };
            if (this.activeTasks < this.concurrentLimit) {
                // run immediately
                void task();
            } else {
                this.taskQueue.push(task);
            }
        });
    }

    _drainQueue() {
        while (this.activeTasks < this.concurrentLimit && this.taskQueue.length > 0) {
            const next = this.taskQueue.shift();
            if (next) void next();
        }
    }

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