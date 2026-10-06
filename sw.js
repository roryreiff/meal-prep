const CACHE = "mealprep-v6";

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const base = self.registration.scope; // e.g. https://roryreiff.github.io/meal-prep/
      const paths = [
        "",
        "index.html",
        "css/styles.css",
        "js/app.js",
        "data/week.json",
        "manifest.webmanifest",
      ];
      const urls = paths.map((p) => new URL(p, base).href);
      const cache = await caches.open(CACHE);
      await cache.addAll(urls);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
