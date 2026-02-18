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
    // Ignore non-http requests (extensions, data:, etc) and non-GET
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    // Network-first for everything to ensure fresh code
    // Fall back to cache if network fails (offline)
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache =>
                        cache.put(event.request, clone).catch(err => console.debug('SW Cache Error:', err))
                    );
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
