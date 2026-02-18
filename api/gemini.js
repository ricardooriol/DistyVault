/**
 * Proxy for Gemini API to hide the API key from the browser URL.
 * The Gemini API requires the key in the query string (?key=AIza...),
 * which exposes it to browser history, logs, and Referer headers.
 * This proxy accepts the key in a header (x-goog-api-key) and forwards it securely.
 */
module.exports = async (req, res) => {
    // CORS setup
    const origin = req.headers?.origin || '*';
    // Allow localhost and Vercel deployments
    const allowedOriginPattern = /^https?:\/\/(localhost(:\d+)?|.*\.vercel\.app)$/;
    const corsOrigin = allowedOriginPattern.test(origin) ? origin : (req.headers?.referer ? new URL(req.headers.referer).origin : '*');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key');
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    try {
        const apiKey = req.headers['x-goog-api-key'];
        if (!apiKey) {
            res.statusCode = 401;
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.end('Missing API Key');
            return;
        }

        // Parse target model from query or body? 
        // The client sends: https://generativelanguage.googleapis.com/v1beta/models/MODEL:generateContent
        // We'll accept the model as a query param
        const model = req.query?.model || 'gemini-3-flash-preview';

        // Construct upstream URL
        const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        // Forward the request
        // We need to read the body
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

        const upstreamData = await upstreamRes.arrayBuffer();

        res.statusCode = upstreamRes.status;
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'application/json');
        res.end(Buffer.from(upstreamData));

    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        res.statusCode = 500;
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.end(JSON.stringify({ error: error.message }));
    }
};
