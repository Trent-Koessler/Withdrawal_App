const CACHE_NAME = 'withdrawal-app-cache-v2';
const urlsToCache = [
    '.',
    'index.html',
    'style.css',
    'script.js'
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
    // "Network falling back to cache" strategy.
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return fetch(event.request).then(response => {
                try {
                    cache.put(event.request, response.clone());
                } catch (e) {
                    console.error('Cache put failed:', e);
                }
                return response;
            }).catch(() => {
                return cache.match(event.request);
            });
        })
    );
});
