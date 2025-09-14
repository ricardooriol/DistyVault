/**
 * HTTP proxy endpoint to fetch external resources with CORS enablement, input validation,
 * and response normalization. Intended for frontend use to bypass cross-origin restrictions
 * while enforcing server-side safety constraints (protocol allowlist, timeout, size cap).
 *
 * Key behaviors:
 * - Handles CORS preflight (OPTIONS) and sets permissive CORS for GET responses.
 * - Validates and decodes the 'url' query parameter, allowing only http/https protocols.
 * - Issues a GET with a realistic User-Agent and follows redirects.
 * - Enforces a 15s timeout via AbortController and limits payload to 4 MiB.
 * - Returns upstream status code and content-type, and exposes final URL via 'x-final-url'.
 */
/**
 * Serverless-style request handler.
 *
 * Contract:
 * - Input: HTTP request with optional `query.url` or `?url=` parameter (encoded or plain).
 * - Output: Proxied response body (capped), upstream status code, content-type, and headers
 *   `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: x-final-url, content-type`,
 *   `x-final-url`.
 * - Error modes: 400 for missing/invalid URL or disallowed protocol, 502 for fetch failures,
 *   504 on timeout/abort.
 *
 * Notes:
 * - This endpoint is intentionally minimal: it does not forward arbitrary headers or cookies,
 *   and it reads the full response into memory before truncation (no streaming).
 *
 * @param {import('http').IncomingMessage & { method?: string, query?: Record<string, unknown>, url?: string }} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
 */
// Thin wrapper: preserve /api/fetch route while hosting implementation in src/core
module.exports = require('../src/core/fetch.js');