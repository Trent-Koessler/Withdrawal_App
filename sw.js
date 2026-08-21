// A cache name is a version stamp. Everything in one cache was fetched by one
// install, so serving only from the current cache means a page load can never
// mix files from two releases — see the fetch handler for why that matters.
//
// It is the app version verbatim, and a test asserts that. Releases 0.4.5's
// predecessors shipped real clinical changes behind an unchanged 'v32' stamp:
// the worker is cache-first and only reinstalls when this file changes, so
// every device that had already installed kept serving the older snapshot and
// never saw them. An opaque counter made that easy to forget. Tying it to the
// version people can read in the footer makes the omission visible.
const CACHE_NAME = 'withdrawal-app-cache-v0.4.5';
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
    'data/content-meta.js',
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
            if (!contentTypeMatches(url, response)) {
                return `${url} (served ${response.headers.get('content-type') || 'no content-type'})`;
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
// under a script key would persist the outage across reloads — and survive
// going offline — so a precached response whose content type does not match
// what the URL claims to be is rejected as a failure.
function contentTypeMatches(url, response) {
    const expected = /\.js$/.test(url) ? 'javascript'
        : (/\.html$/.test(url) || url === './') ? 'html'
            : null;
    if (!expected) {
        return true; // images, manifest, icons: nothing useful to check.
    }
    return (response.headers.get('content-type') || '').includes(expected);
}

// Cache-first, from the snapshot THIS worker installed, and nothing is ever
// written back into that snapshot outside install.
//
// This used to be network-first per request, which shipped a real defect: the
// decision was taken independently for every file, so one page load could serve
// a fresh index.html from the network and a script.js from the old cache
// because that one request happened to exceed the 5s timeout. The app then
// rendered the new markup with the previous release's behaviour — controls that
// are present but wired to nothing, and dosing content from the older build.
// On a ward phone, on hospital wifi, that is not an edge case.
//
// One cache = one release. Updates arrive the standard PWA way: a changed sw.js
// installs a new CACHE_NAME, precaches the whole release, takes over, and the
// next load is entirely the new version. Never half of each.
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    // Navigations resolve to the shell in the snapshot rather than to whatever
    // the URL happens to be (deep links, hash routes, ?diag all land here).
    if (request.mode === 'navigate') {
        const shell = await cache.match('index.html') || await cache.match('./');
        if (shell) {
            return shell;
        }
    }

    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }

    // Not part of this release's snapshot — a file added since, or one whose
    // precache was blocked. Go to the network; do not cache the result, or the
    // snapshot stops being a single consistent version.
    try {
        return await fetchWithTimeout(request, NETWORK_TIMEOUT);
    } catch (err) {
        return Response.error();
    }
}

self.addEventListener('fetch', event => {
    // Nothing in the cache can answer a non-GET, and it must reach the network.
    if (event.request.method !== 'GET') {
        return;
    }
    event.respondWith(cacheFirst(event.request));
});
