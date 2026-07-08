const CACHE_NAME = 'cats-cradle-v4-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/audio.js',
  './js/challenge.js',
  './js/particles.js',
  './js/physics.js',
  './js/utils.js',
  './manifest.json',
  './styles/cyberpunk.json',
  './styles/ink.json'
];

self.addEventListener('install', event => {
  const cacheAdd = caches.open(CACHE_NAME)
    .then(cache => {
      return cache.addAll(urlsToCache);
    });
  event.waitUntil(Promise.all([cacheAdd, self.skipWaiting()]));
});

// Mixed caching strategy: network-first for navigations, cache-first for static assets
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Navigation requests: network-first, fallback to cache then index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and cache valid responses
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache then fallback to index.html
          return caches.match(event.request)
            .then(response => {
              return response || caches.match('./index.html');
            });
        })
    );
    return;
  }

  // Other GET requests (static assets): cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response
            const responseToCache = response.clone();

            // Ignore chrome-extension and specific unsupported schemes
            if (event.request.url.startsWith('http')) {
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
            }

            return response;
          }
        );
      })
  );
});

// Clean up old caches and claim clients
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  const cleanup = caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        if (cacheWhitelist.indexOf(cacheName) === -1) {
          return caches.delete(cacheName);
        }
      })
    );
  });
  event.waitUntil(Promise.all([cleanup, self.clients.claim()]));
});
