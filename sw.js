const CACHE = "gb-pwa-v4";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/gameboy.css",
  "./js/app.js",
  "./js/boot.js",
  "./js/core.js",
  "./js/emu.js",
  "./js/pwa.js",
  "./js/skins.js",
  "./js/snake.js",
  "./js/storage.js",
  "./js/tetris.js",
  "./vendor/binjgb/binjgb.js",
  "./vendor/binjgb/binjgb.wasm",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst = /\.(?:js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");

  if (networkFirst) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type === "opaque") return res;
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
