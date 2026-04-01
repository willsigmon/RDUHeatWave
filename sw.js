const CACHE_NAME = 'heatwave-v8';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/meet.html',
  '/about.html',
  '/bizchat.html',
  '/kiosk.html',
  '/timer.html',
  '/survey.html',
  '/survey-results.html',
  '/remind.html',
  '/agenda.html',
  '/admin.html',
  '/crm.html',
  '/crm.css',
  '/crm.js',
  '/report.html',
  '/privacy.html',
  '/404.html',
  '/shared.css',
  '/shared-form.js',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/heatwave-icon-192.png',
  '/icons/heatwave-icon-512.png',
  '/icons/heatwave-icon-180.png',
  '/site.webmanifest',
  '/icons/iconscout/crm.svg',
  '/scripts/heatwave-fx.js',
  '/scripts/scroll-reveal.js',
  '/scripts/site-config.js',
];

// API responses excluded — must always be fresh
const STATIC_EXTENSIONS = /\.(css|js|png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)(\?.*)?$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (url.origin !== location.origin || request.method !== 'GET') return;

  // Skip caching for API routes — always fetch fresh
  if (url.pathname.includes('/api/')) return;

  if (STATIC_EXTENSIONS.test(url.pathname)) {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      )
    );
  } else {
    // Network-first for HTML and API calls
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request) || new Response('Offline — check your connection.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
    );
  }
});
