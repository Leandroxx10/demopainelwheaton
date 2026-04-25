const CACHE_NAME = 'wmoldes-pwa-v20';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin.html',
  '/style.css',
  '/script.js',
  '/auth.js',
  '/firebase-config.js',
  '/manifest.webmanifest',
  '/tutorial.html',
  '/tutorial.css',
  '/tutorial.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => caches.match(event.request).then(res => res || caches.match('/index.html')))
  );
});
