/**
 * DistyVault Service Worker — minimal offline shell caching.
 *
 * Strategy:
 * - Cache app shell files (HTML, JS, logos) on install.
 * - Network-first for CDN scripts to avoid stale caches.
 * - Cache-first for local files once cached.
 */
const CACHE_NAME = 'dv-cache-v3';

const SHELL_FILES = [
    '/',
    '/index.html',
    '/src/core/utils.js',
    '/src/core/eventBus.js',
    '/src/core/toast.js',
    '/src/core/db.js',
    '/src/core/queue.js',
    '/src/ai/providers/openai.js',
    '/src/ai/providers/gemini.js',
    '/src/ai/providers/anthropic.js',
    '/src/ai/providers/deepseek.js',
    '/src/ai/providers/grok.js',
    '/src/ai/service.js',
    '/src/extractors/files.js',
    '/src/extractors/url.js',
    '/src/extractors/youtube.js',
    '/src/extractors/index.js',
    '/src/components/Components.jsx',
    '/src/App.jsx',
    '/logos/logo_no_bg_b.png',
    '/logos/logo_no_bg_w.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // 1. Only intercept GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 2. Only intercept same-origin requests (app shell)
    // We let the browser handle CDN caching naturally to avoid CORS/CSP issues in the SW
    if (url.origin !== self.location.origin) return;

    // 3. Network-first strategy for local app files
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If good response, clone and cache
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Network failed (offline), try cache
                return caches.match(event.request).then(response => {
                    if (response) return response;
                    // If not in cache and network failed, we can't do anything for assets.
                    // For navigation requests (HTML), we could return a fallback offline page,
                    // but for now just return undefined to let the browser show the error.
                    // actually returning undefined in respondWith throws. We must return a Response.
                    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                });
            })
    );
});
