// sw.js - Service Worker for CruciGen offline gaming and PWA support
const CACHE_NAME = "crucigen-cache-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./templates.js",
  "./worker.js",
  "./dictionary.json",
  "./icon.svg",
  "./manifest.json"
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell and dictionary...");
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache...", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network First with Cache Fallback)
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Cache external or application requests dynamically
        if (
          networkResponse.status === 200 &&
          (e.request.url.startsWith(self.location.origin) ||
           e.request.url.startsWith("https://fonts.googleapis.com") ||
           e.request.url.startsWith("https://fonts.gstatic.com") ||
           e.request.url.startsWith("https://cdnjs.cloudflare.com"))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback to cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});
