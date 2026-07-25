const CACHE_NAME = 'withdrawal-app-cache-v23';
const NETWORK_TIMEOUT = 5000; // ms before falling back to cache
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'script.js',
    // script.js imports these as ES modules; without them the app cannot boot offline.
    'data/flowchart.js',
    'data/regimens.js',
    'data/scales.js',
    'manifest.json',
    'favicon.ico',
    'icons/icon.svg',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            // Activate this worker as soon as it has installed, rather than waiting
            // for every existing tab/PWA window to close first.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            ))
            // Take control of pages already open, so the new worker applies immediately.
            .then(() => self.clients.claim())
    );
});

// Rejects if the network has not responded within `timeout` ms, so a slow
// connection falls through to the cache instead of hanging.
function fetchWithTimeout(request, timeout) {
    return Promise.race([
        fetch(request),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), timeout);
        })
    ]);
}

// Network-first, falling back to cache. Every failure path resolves to something:
// a cached copy, the cached app shell for navigations, or an explicit error
// response. Nothing is left pending.
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetchWithTimeout(request, NETWORK_TIMEOUT);
        if (response && response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Offline on a URL we have never cached. For page loads, serve the app
        // shell so the toolkit still opens; its own assets are precached.
        if (request.mode === 'navigate') {
            const shell = await cache.match('index.html') || await cache.match('./');
            if (shell) {
                return shell;
            }
        }

        return Response.error();
    }
}

self.addEventListener('fetch', event => {
    // cache.put() rejects on non-GET requests, and there is nothing useful to
    // serve them from the cache anyway.
    if (event.request.method !== 'GET') {
        return;
    }
    event.respondWith(networkFirst(event.request));
});
