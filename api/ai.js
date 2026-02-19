/**
 * Generic AI Proxy for DistyVault
 * 
 * Unifies all AI provider access through a single endpoint to:
 * 1. Hide API keys (which are sent in headers)
 * 2. Handle CORS
 * 3. Support streaming responses to prevent Vercel timeouts
 */

module.exports = async (req, res) => {
    // CORS setup
    const origin = req.headers?.origin || '*';
    const allowedOriginPattern = /^https?:\/\/(localhost(:\d+)?|.*\.vercel\.app)$/;
    const corsOrigin = allowedOriginPattern.test(origin) ? origin : (req.headers?.referer ? new URL(req.headers.referer).origin : '*');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key, authorization');
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    const provider = req.query?.provider || 'gemini';
    const model = req.query?.model || 'gemini-3-flash-preview';

    try {
        if (provider === 'gemini') {
            await handleGemini(req, res, model, corsOrigin);
        } else {
            res.statusCode = 400;
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.end(JSON.stringify({ error: `Provider ${provider} not supported by proxy` }));
        }
    } catch (error) {
        console.error('Proxy Error:', error);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.end(JSON.stringify({ error: error.message }));
        }
    }
};

async function handleGemini(req, res, model, corsOrigin) {
    const apiKey = req.headers['x-goog-api-key'];
    if (!apiKey) {
        res.statusCode = 401;
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.end(JSON.stringify({ error: 'Missing Gemini API Key' }));
        return;
    }

    // Use streamGenerateContent to enable streaming response
    const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;

    // Read full request body first
    const bodyBuffers = [];
    for await (const chunk of req) {
        bodyBuffers.push(chunk);
    }
    const body = Buffer.concat(bodyBuffers);

    const upstreamRes = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    });

    if (!upstreamRes.ok) {
        // If upstream failed, forward the error
        res.statusCode = upstreamRes.status;
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Content-Type', 'application/json');
        const errText = await upstreamRes.text();
        res.end(errText);
        return;
    }

    // Success - pipe the stream!
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Content-Type', 'application/json');
    // Enable HTTP chunked transfer encoding (automatic in Node often, but good to be explicit by not setting Content-Length)

    // We must manually pump the reader because Node's fetch response body is a web stream (v18+)
    // but res is a Node stream. pipeline is safer but manual loop works for simple cases.

    // Note: Vercel/Node fetch body is a ReadableStream (Web Standard).
    // Node.js http.ServerResponse `res` is a Writable (Node stream).
    // We need to bridge them.

    if (upstreamRes.body && typeof upstreamRes.body.getReader === 'function') {
        const reader = upstreamRes.body.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();
        } catch (e) {
            console.error('Stream error', e);
            res.end(); // Close connection
        }
    } else if (upstreamRes.body && typeof upstreamRes.body.pipe === 'function') {
        // Node-fetch style
        upstreamRes.body.pipe(res);
    } else {
        // Fallback for text/buffer response (unlikely for stream endpoint but possible)
        const buffer = await upstreamRes.arrayBuffer();
        res.end(Buffer.from(buffer));
    }
}
