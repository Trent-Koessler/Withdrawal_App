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
    event.respondWith(
        new Promise(resolve => {
            const networkTimeout = 5000; // 5 seconds

            const timeoutPromise = new Promise(resolve => {
                setTimeout(() => {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.match(event.request).then(cachedResponse => {
                            if (cachedResponse) {
                                console.log(`Network timed out for ${event.request.url}, serving from cache.`);
                                resolve(cachedResponse);
                            }
                        });
                    });
                }, networkTimeout);
            });

            const networkPromise = fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            });

            // Race the network request against the timeout
            Promise.race([networkPromise, timeoutPromise]).then(resolve);
        }).catch(() => caches.match(event.request)) // Fallback for total network failure
    );
});
