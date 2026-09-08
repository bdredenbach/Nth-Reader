// NTH READER — V-0.03.00

const SW_VERSION = "Nth-Reader-V-0.03.00";
const CACHE_NAME = `nth-reader-shell-${SW_VERSION}`;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/db.js",
  "./js/formats.js",
  "./js/page-turn.js",
  "./js/page-mode.js",
  "./js/epub-page-reader.js",
  "./js/reader.js",
  "./js/decor-art.js",
  "./js/shelf.js",
  "./js/customize.js",
  "./js/menu.js",
  "./js/remove-panel.js",
  "./js/app.js",
  "./js/turn.js",
  "./assets/decor/bust.webp",
  "./assets/decor/globe.webp",
  "./assets/decor/plant.webp",
  "./assets/decor/candle.webp",
  "./assets/decor/vine.webp",
  "./assets/decor/lamp.webp",
  "./assets/decor/mug.webp",
  "./assets/decor/frame.webp",
  "https://code.jquery.com/jquery-3.6.0.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
];

const ALLOWED_CDN_HOSTS = ["code.jquery.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const local = SHELL_FILES.filter((path) => !path.startsWith("http"));
      const remote = SHELL_FILES.filter((path) => path.startsWith("http"));
      await cache.addAll(local);
      await Promise.all(remote.map((path) => cache.add(path).catch((err) => {
        console.warn(`[${SW_VERSION}] Optional CDN cache failed for ${path}:`, err);
      })));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // A newly activated shell must not leave the already-open tab running a
      // mixture of old HTML and new modules. Navigate it once into this build.
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => Promise.all(clients.map((client) => {
        try {
          const navigation = client.navigate?.(client.url);
          return navigation?.catch(() => null) || null;
        } catch (_) { return null; }
      })))
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const allowedCdn = ALLOWED_CDN_HOSTS.includes(url.hostname);
  if (!sameOrigin && !allowedCdn) return;

  const shellCode = sameOrigin && (req.mode === "navigate" || ["script", "style"].includes(req.destination));
  if (shellCode) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
      return res;
    }))
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "GET_VERSION") {
    event.source?.postMessage({ version: SW_VERSION });
  }
});
