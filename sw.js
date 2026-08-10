const CACHE_NAME = 'withdrawal-app-cache-v26';
const NETWORK_TIMEOUT = 5000; // ms before falling back to cache
// style.css is deliberately absent: it is inlined into index.html by
// tools/build-css.py, so the app never requests it as a separate file.
const urlsToCache = [
    './',
    'index.html',
    'script.js',
    // script.js imports these as ES modules; without them the app cannot boot offline.
    'data/flowchart.js',
    'data/regimens.js',
    'data/scales.js',
    'data/symptomatic.js',
    'data/harm-reduction.js',
    'data/benzo-equivalence.js',
    'manifest.json',
    'favicon.ico',
    'icons/icon.svg',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    'icons/apple-touch-icon.png'
];

// cache.addAll() is atomic: a single non-OK response rejects the whole batch,
// the install fails, and the app ends up with no offline support at all. A
// corporate web filter answering 403 for one asset was enough to do exactly
// that. Cache each entry independently so one blocked file costs only itself.
async function precache(cache) {
    const results = await Promise.all(urlsToCache.map(async url => {
        try {
            // Bypass the HTTP cache so install cannot store a stale copy that a
            // caching proxy happens to be holding.
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (!response.ok) {
                return `${url} (HTTP ${response.status})`;
            }
            await cache.put(url, response);
            return null;
        } catch (err) {
            return `${url} (${err})`;
        }
    }));

    const failed = results.filter(Boolean);
    if (failed.length) {
        console.warn('[sw] precache incomplete:', failed.join(', '));
    }
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(precache)
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

// A web filter can answer with HTTP 200 and an HTML block page. Storing that
// under the script or stylesheet key would persist the outage across reloads —
// and survive going offline — so only cache a response whose content type
// matches what was actually requested.
function isCacheable(request, response) {
    if (!response || response.status !== 200 || response.type !== 'basic') {
        return false;
    }
    const expected = { script: 'javascript', style: 'css', document: 'html' }[request.destination];
    if (!expected) {
        return true; // images, manifest, fonts: nothing useful to check.
    }
    return (response.headers.get('content-type') || '').includes(expected);
}

// Network-first, falling back to cache. Every failure path resolves to something:
// a cached copy, the cached app shell for navigations, or an explicit error
// response. Nothing is left pending.
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetchWithTimeout(request, NETWORK_TIMEOUT);
        if (isCacheable(request, response)) {
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
