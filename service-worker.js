// Cache names
const CACHE_NAME = 'barcode-tool-cache-v5';
const ASSETS = [
  '/barcodetool/',
  '/barcodetool/index.html',
  '/barcodetool/main.css',
  '/barcodetool/generator.js',
  '/barcodetool/scanner.js',
  '/barcodetool/manifest.json',
  '/barcodetool/favicon.ico',
  'https://unpkg.com/bwip-js/dist/bwip-js-min.js',
  'https://unpkg.com/@zxing/library@latest'
];

// Install event: Cache assets and skip waiting
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // **Forces the waiting service worker to become the active service worker**
        console.log('Service Worker: Skipping waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Cache addAll failed:', error);
      })
  );
});

// Activate event: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            // **Delete old caches**
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
        .filter(Boolean) // Remove null entries
      );
    }).then(() => {
      // **Immediately take control of all clients (tabs/windows)**
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event: Serve from cache or fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // No cache hit - fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and can only be consumed once. We consume the stream
            // here to cache the response, and we also need to return
            // a response to the browser for the fetch request.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch((error) => {
        console.error('Service Worker: Fetch failed:', error);
        // You could return a fallback page here
        // return caches.match('/offline.html');
      })
  );
});