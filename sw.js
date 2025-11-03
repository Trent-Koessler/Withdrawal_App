const CACHE_NAME = 'withdrawal-app-cache-v8';
const urlsToCache = [
    '/Withdrawal_App/',
    '/Withdrawal_App/index.html',
    '/Withdrawal_App/style.css',
    '/Withdrawal_App/script.js',
    '/Withdrawal_App/manifest.json',
    '/Withdrawal_App/icons/icon-192x192.png',
    '/Withdrawal_App/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // For navigation requests (loading the page), use a network-first strategy.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // For other requests (CSS, JS, images), use a cache-first strategy
    // for speed and offline capability.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request);
        })
    );
});
