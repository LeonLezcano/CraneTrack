// CraneTrack Service Worker v1.0.00
const CACHE_NAME = 'cranetrack-v1.0.00';
const STATIC_ASSETS = [
  './',
  './index.html',
  './version.json',
  './src/core/towMileageTariffEngine.js',
  './src/core/preTowVisualInspectionEngine.js',
  './src/core/fleetEmergencyDispatcherEngine.js',
  './src/services/towActaLedgerService.js',
  './src/services/craneTrackCache.service.js',
  './src/utils/cryptoSeal.js',
  './src/utils/formatters.js',
  './src/utils/sanitizer.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return networkRes;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
