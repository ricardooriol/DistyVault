/**
 * Generic AI Proxy for DistyVault
 * 
 * Unifies all AI provider access through a single endpoint.
 * specific logic (e.g. Gemini) is removed in favor of a configuration-driven approach.
 */

const PROVIDERS = {
    openai: {
        url: () => 'https://api.openai.com/v1/chat/completions',
        headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` })
    },
    anthropic: {
        url: () => 'https://api.anthropic.com/v1/messages',
        headers: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' })
    },
    gemini: {
        // Construct the Gemini streaming URL dynamically
        url: (model, apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash-preview'}:streamGenerateContent?key=${apiKey}`,
        headers: () => ({})
    },
    deepseek: {
        url: () => 'https://api.deepseek.com/chat/completions',
        headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` })
    },
    grok: {
        url: () => 'https://api.x.ai/v1/chat/completions',
        headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` })
    }
};

module.exports = async (req, res) => {
    // CORS setup
    const origin = req.headers?.origin || '*';
    const allowedOriginPattern = /^https?:\/\/(localhost(:\d+)?|.*\.vercel\.app)$/;
    const corsOrigin = allowedOriginPattern.test(origin) ? origin : (req.headers?.referer ? new URL(req.headers.referer).origin : '*');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key, authorization, x-api-key, anthropic-version');
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }

    try {
        const { provider = 'gemini', model } = req.query || {};
        const config = PROVIDERS[provider];

        if (!config) {
            res.statusCode = 400;
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Provider ${provider} not supported` }));
            return;
        }

        // Extract API Key from various possible headers
        // Priority: x-goog-api-key (Gemini), Authorization (OpenAI/others), x-api-key (Anthropic)
        const apiKey = req.headers['x-goog-api-key'] || 
                       req.headers['authorization']?.replace('Bearer ', '') || 
                       req.headers['x-api-key'];

        if (!apiKey) {
            res.statusCode = 401;
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing API Key' }));
            return;
        }

        // Construct Upstream URL
        // Pass model and apiKey in case the provider needs them in the URL (like Gemini)
        const upstreamUrl = typeof config.url === 'function' ? config.url(model, apiKey) : config.url;
        
        // Prepare Headers
        const extraHeaders = config.headers ? config.headers(apiKey) : {};
        const upstreamHeaders = {
            'Content-Type': 'application/json',
            ...extraHeaders
        };

        // Read Body
        let body;
        if (req.body) {
            if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
                body = req.body;
            } else {
                // Vercel might have already parsed JSON
                body = JSON.stringify(req.body);
            }
        } else {
            // Read raw stream if not parsed
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            body = Buffer.concat(chunks);
        }

        // Forward Request
        const upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: upstreamHeaders,
            body
        });

        // Forward Status and Headers
        res.statusCode = upstreamRes.status;
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Content-Type', 'application/json');

        if (!upstreamRes.ok) {
            const errText = await upstreamRes.text();
            res.end(errText); // Forward upstream error exactly
            return;
        }

        // Success - Stream Response
        if (upstreamRes.body) {
            // Modern Node.js fetch (undici) returns a web stream
            if (typeof upstreamRes.body.getReader === 'function') {
                const reader = upstreamRes.body.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        res.write(value);
                    }
                } catch (e) {
                    console.error('Stream error:', e);
                }
                res.end();
            } 
            // Node-fetch style (Node stream)
            else if (typeof upstreamRes.body.pipe === 'function') {
                upstreamRes.body.pipe(res);
            } 
            // Fallback for buffer
            else {
                const buffer = await upstreamRes.arrayBuffer();
                res.end(Buffer.from(buffer));
            }
        } else {
            res.end();
        }

    } catch (error) {
        console.error('Proxy Error:', error);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
        }
    }
};
