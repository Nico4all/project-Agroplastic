const CACHE_NAME = 'caudalia-app-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/brand/caudalia-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith('/api')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
