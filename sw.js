/* Royal Neon Casino — service worker
   Estrategia "red primero": siempre intenta bajar la versión nueva y
   solo usa la copia guardada si no hay conexión. Así nunca queda
   pegada una versión vieja de los archivos. */
const CACHE = "royal-neon-v4";
const FILES = [
  "./",
  "./index.html",
  "./styles.css?v=4.0",
  "./script.js?v=4.0",
  "./manifest.webmanifest",
  "./assets/logo.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
