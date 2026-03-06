const CACHE = "lifeos-v1";
const STATIC = ["/", "/index.html"];
const IS_DEV = self.location.hostname === "localhost";

self.addEventListener("install", (e) => {
  if (IS_DEV) { self.skipWaiting(); return; }
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // V dev móde (localhost) – vždy network, nikdy cache
  if (IS_DEV) return;

  // API calls: network first, no cache
  if (e.request.url.includes("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets: cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
