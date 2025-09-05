/**
 * ApiClient - Browser orchestrator
 * - Uses serverless /api/process/* only for extraction (URL, file, YouTube)
 * - Persists via IndexedDB (sql.js kept client-side)
 * - Distills via AIService (online providers only)
 */
class ApiClient {
    constructor() {
        this.base = '/api';
        this.db = new Database();
        this.ai = new AIService();
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
    await this.db.updateDistillationStatus(id, 'distilling', 'Regenerating with AI');
        const raw = item.rawContent;
        const cancelled = this._isCancelled(id);
        if (cancelled) { await this._markStopped(id); return { status: 'stopped' }; }
        const distilled = await this.ai.distillContent(raw);
        const wordCount = (distilled || '').split(/\s+/).length;
        await this.db.updateDistillationContent(id, distilled, raw, 0, wordCount);
        return { status: 'ok' };
    }

    /** Stop background processing */
    async stopProcessing(id) {
        this.cancellations.set(id, { cancelled: true });
    await this.db.updateDistillationStatus(id, 'stopped', 'Processing stopped by user');
        return { status: 'ok', message: 'Process stopped' };
    }

    /** Download as HTML (client-side), returned as blob */
    async downloadPdf(id) {
        const item = await this.db.getDistillation(id);
        if (!item || !item.content) throw new Error('Nothing to download');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${(item.title||'Distillation')}</title></head><body>${item.content}</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const headers = new Headers({ 'Content-Disposition': `attachment; filename="${this._safeFilename((item.title||'distillation'))}.html"` });
        return { blob, headers, status: 200 };
    }

    /** Bulk download not supported client-side (zip); return failure */
    async bulkDownload(ids) { throw new Error('Bulk download not supported in client mode'); }

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
            await this.db.updateDistillationStatus(id, 'extracting', 'Extracting content...');
            // Extract
            const extractRes = await fetch(`${this.base}/process/url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
            const payload = await this._handle(extractRes);
            const extraction = payload.extraction || payload;
            if (extraction.contentType === 'youtube-playlist' && extraction.metadata?.videos?.length) {
                // Spawn items for each video and delete tracking
                for (const v of extraction.metadata.videos) {
                    try { await this.processUrl(v); } catch {}
                    await new Promise(r => setTimeout(r, 100));
                }
                await this.db.deleteDistillation(id);
                return;
            }
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
            if (this._isCancelled(id)) { await this._markStopped(id); return; }
            const distilled = await this.ai.distillContent(item.rawContent);
            const wordCount = (distilled || '').split(/\s+/).length;
            await this.db.updateDistillationContent(id, distilled, item.rawContent, 0, wordCount);
        } catch (e) {
            await this.db.updateDistillationStatus(id, 'error', e?.message || 'Processing failed');
        }
    }

    async _processFilePipeline(id, file) {
        try {
            const cancelled = this._isCancelled(id);
            if (cancelled) { await this._markStopped(id); return; }
            await this.db.updateDistillationStatus(id, 'extracting', `Extracting content from ${file.name}...`);
            const form = new FormData();
            form.append('file', file, file.name);
            const res = await fetch(`${this.base}/process/file`, { method: 'POST', body: form });
            const payload = await this._handle(res);
            const extraction = payload.extraction || payload;
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
            const distilled = await this.ai.distillContent(item.rawContent);
            const wordCount = (distilled || '').split(/\s+/).length;
            await this.db.updateDistillationContent(id, distilled, item.rawContent, 0, wordCount);
        } catch (e) {
            await this.db.updateDistillationStatus(id, 'error', e?.message || 'Processing failed');
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
}

// Export for use in other modules
window.ApiClient = ApiClient;