const CACHE = "gb-pwa-v7";
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
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        CORE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      );
    }).then(() => self.skipWaiting())
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

function sameOrigin(req) {
  try {
    return new URL(req.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function cacheKey(req) {
  const url = new URL(req.url);
  return url.origin + url.pathname;
}

async function fromCache(req) {
  const exact = await caches.match(req);
  if (exact) return exact;
  const ignored = await caches.match(req, { ignoreSearch: true });
  if (ignored) return ignored;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/") || req.mode === "navigate") {
    return (await caches.match("./index.html")) || (await caches.match("./"));
  }
  return null;
}

function updateCache(req, res) {
  if (!res || res.status !== 200 || (res.type !== "basic" && res.type !== "cors" && res.type !== "default")) {
    return;
  }
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(cacheKey(req), copy)).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !sameOrigin(req)) return;

  event.respondWith(
    (async () => {
      const cached = await fromCache(req);
      const network = fetch(req)
        .then((res) => {
          updateCache(req, res);
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }

      const fresh = await network;
      if (fresh) return fresh;
      const fallback = await fromCache(req);
      if (fallback) return fallback;
      return new Response("Offline", { status: 503, statusText: "Offline" });
    })()
  );
});
