const CACHE_NAME = 'grupoestudio-v4';
const STATIC_ASSETS = ['/', '/index.html', '/style.css', '/app.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          try {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone).catch(() => {}));
          } catch(e) {}
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});