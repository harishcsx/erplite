const CACHE_NAME = 'unilite-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force update
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // For proxy requests, we prioritize network but fall back to cache
    if (event.request.url.includes('/proxy')) {
        // Cache API only supports GET. Skip caching for POST/other methods.
        if (event.request.method !== 'GET') {
            event.respondWith(fetch(event.request));
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cloned);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Standard asset caching
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
