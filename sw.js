// CraneTrack Service Worker v1.0.01
const CACHE_NAME = 'cranetrack-v1.0.01';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon.svg',
  './version.json',
  './src/sw-register.js',
  './src/app.js',
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

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isNetworkFirst =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/version.json') ||
    url.pathname.endsWith('/sw.js');

  if (isNetworkFirst) {
    e.respondWith(
      fetch(e.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkRes;
      });
    })
  );
});
