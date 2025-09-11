const CACHE_NAME = 'withdrawal-app-cache-v6';
const urlsToCache = [
    '.',
    'index.html',
    'style.css',
    'script.js',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png'
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
    // Use a "Network falling back to cache" strategy.
    // This is a good strategy for an app shell where you want the latest version if online,
    // but want it to work offline.
    event.respondWith(
        fetch(event.request).then(response => {
            // If the fetch is successful, clone the response and cache it.
            // We only cache successful GET requests.
            if (response && response.status === 200 && event.request.method === 'GET') {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return response;
        }).catch(() => {
            // If the network request fails, try to find the request in the cache.
            return caches.match(event.request);
        })
    );
});
