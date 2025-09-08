/**
 * Ollama AI Provider (Browser-safe)
 * Communicates with a local Ollama server from a web app hosted anywhere.
 *
 * Key points:
 * - Uses fetch (no axios) for browser compatibility
 * - Probes multiple localhost addresses (localhost, 127.0.0.1, [::1])
 * - Clear CORS/Private Network Access guidance when blocked
 * - Consistent interface with AIProvider
 */
class OllamaProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.model = config.model || 'llama3';
        this.endpoint = (config.endpoint || 'http://localhost:11434').replace(/\/$/, '');
        this.timeout = config.timeout || 300000; // 5 minutes

        // Cache for a successfully reachable endpoint variation
        this._resolvedEndpoint = null;
    }

    // Build a list of candidate localhost endpoints to try
    _candidateEndpoints() {
        const base = this.endpoint.replace(/\/$/, '');
        const url = new URL(base);
        const port = url.port || '11434';
        const candidates = new Set([
            `${url.protocol}//${url.hostname}:${port}`,
            `${url.protocol}//localhost:${port}`,
            `${url.protocol}//127.0.0.1:${port}`,
            `${url.protocol}//[::1]:${port}`
        ]);
        return Array.from(candidates);
    }

    async _withTimeout(promise, ms, errMsg = 'Request timed out') {
        let to;
        const t = new Promise((_, reject) => { to = setTimeout(() => reject(new Error(errMsg)), ms); });
        try { return await Promise.race([promise, t]); } finally { clearTimeout(to); }
    }

    async _fetchJSON(url, options = {}, { expectJSON = true } = {}) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal, mode: 'cors', credentials: 'omit' });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
                err.httpStatus = res.status;
                err.body = text;
                throw err;
            }
            if (!expectJSON) return await res.text();
            return await res.json();
        } catch (e) {
            // Normalize common browser network errors
            const msg = String(e && (e.message || e)).toLowerCase();
            if (e.name === 'AbortError' || msg.includes('timeout')) {
                e.code = 'ETIMEDOUT';
            } else if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
                e.code = 'ENETWORK';
            }
            throw e;
        } finally {
            clearTimeout(id);
        }
    }

    async _resolveEndpoint() {
        if (this._resolvedEndpoint) return this._resolvedEndpoint;

        const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'your site';
        const errs = [];
        for (const base of this._candidateEndpoints()) {
            try {
                // Use a simple GET to avoid preflight; still requires ACAO header from Ollama
                const json = await this._withTimeout(this._fetchJSON(`${base}/api/version`, { method: 'GET' }), 5000);
                if (json && (json.version || json)) {
                    this._resolvedEndpoint = base;
                    return base;
                }
            } catch (e) {
                errs.push({ base, e });
            }
        }

        // If we got here, likely CORS/PNA blocked or server down.
        const corsHint = `Browser couldn’t reach Ollama at localhost due to CORS/Private Network restrictions or the server isn’t running.
To allow this site (${origin}) to call your local Ollama, start Ollama and enable CORS for your site origin (or wildcard).`;
        const err = new Error(corsHint);
        err.code = 'OllamaUnreachable';
        err.details = errs.map(x => ({ endpoint: x.base, error: String(x.e && (x.e.message || x.e)) }));
        throw err;
    }

    async generateSummary(text, options = {}) {
        const processedText = this.preprocessText(text);
        const prompt = this.createDistillationPrompt(processedText, options);

        const base = await this._resolveEndpoint();
        const payload = {
            model: this.model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
                top_p: options.top_p ?? 0.9,
                // Ollama uses num_predict; accept both and map if provided
                num_predict: options.max_tokens ?? options.num_predict ?? 1000
            }
        };

        try {
            // Use application/json; modern Ollama supports proper CORS with OLLAMA_ORIGINS.
            // If this is blocked by PNA/CORS, the _resolveEndpoint() error will already guide the user.
            const json = await this._fetchJSON(`${base}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const raw = (json && (json.response || json.message || json.output || '')) + '';
            if (!raw) {
                throw new Error('Invalid response format from Ollama');
            }
            return this.postProcessDistillation(raw.trim());
        } catch (error) {
            // Improve error for common local issues
            const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'your site';
            if (error.httpStatus === 404 || /not found/i.test(error.message)) {
                throw new Error(`Ollama endpoint not found at ${base}. Is the server running on your machine?`);
            }
            if (error.code === 'ENETWORK') {
                throw new Error(`Network error reaching Ollama at ${base}. Make sure the app can access localhost and Ollama is running.`);
            }
            if (error.code === 'ETIMEDOUT') {
                throw new Error('Ollama request timed out. The input may be large or the model is busy.');
            }
            // Likely CORS/PNA
            if (String(error.message || '').toLowerCase().includes('cors') || String(error).toLowerCase().includes('cors')) {
                throw new Error(`CORS blocked access to Ollama at ${base}. Configure CORS on Ollama to allow origin: ${origin}.`);
            }
            throw new Error(`Ollama error: ${error.message || String(error)}`);
        }
    }

    async validateConfiguration() {
        try {
            const base = await this._resolveEndpoint();
            const tags = await this._fetchJSON(`${base}/api/tags`, { method: 'GET' });

            if (!tags || !tags.models) {
                return { valid: false, error: 'Invalid response from Ollama server' };
            }

            if (!this.model) {
                return { valid: false, error: 'No model specified. Please select a model.' };
            }

            const available = tags.models.map(m => m.name);
            let best = null;
            const exists = available.some(m => {
                if (m === this.model) { best = m; return true; }
                const baseName = m.split(':')[0];
                const reqBase = this.model.split(':')[0];
                if (baseName === reqBase) { best = m; return true; }
                if (m === `${this.model}:latest`) { best = m; return true; }
                return false;
            });

            if (exists && best) this.model = best;
            if (!exists) {
                const reqBase = this.model.split(':')[0];
                const suggestions = available.filter(m => m.split(':')[0].includes(reqBase) || reqBase.includes(m.split(':')[0]));
                let msg = `Model "${this.model}" is not available. Available: ${available.join(', ')}`;
                if (suggestions.length) msg += ` | Did you mean: ${suggestions.join(', ')}?`;
                return { valid: false, error: msg };
            }

            return { valid: true };
        } catch (error) {
            const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'your site';
            const msg = `Cannot reach Ollama on localhost or CORS blocked. Ensure Ollama is running and allows origin ${origin}. (${error.message})`;
            return { valid: false, error: msg };
        }
    }

    getRequiredConfig() {
        return {
            model: {
                type: 'string',
                required: true,
                placeholder: 'e.g., llama3, mistral, phi4-mini',
                description: 'Ollama model name'
            },
            endpoint: {
                type: 'string',
                required: false,
                default: 'http://localhost:11434',
                description: 'Local Ollama base URL'
            }
        };
    }

    async getAvailableModels() {
        try {
            const base = await this._resolveEndpoint();
            const tags = await this._fetchJSON(`${base}/api/tags`, { method: 'GET' });
            return Array.isArray(tags?.models) ? tags.models.map(m => m.name) : [];
        } catch {
            return [];
        }
    }

    getDisplayName() { return 'Ollama (Local)'; }
    getMaxInputLength() { return 50000; }

    async testConnection() {
        const start = Date.now();
        try {
            const base = await this._resolveEndpoint();
            const prompt = "Respond exactly with: Hello, Ollama is working!";
            const json = await this._fetchJSON(`${base}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: this.model, prompt, stream: false, options: { num_predict: 10 } })
            });
            return { success: true, latency: Date.now() - start, response: (json.response || '').trim() };
        } catch (error) {
            return { success: false, latency: Date.now() - start, error: this.formatError(error) };
        }
    }
}

// Support both CommonJS and browser global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OllamaProvider;
} else if (typeof window !== 'undefined') {
    window.OllamaProvider = OllamaProvider;
}