// NTH READER — V-0.00.03

const SW_VERSION = "Nth-Reader-V-0.00.03";
const CACHE_NAME = `nth-reader-shell-${SW_VERSION}`;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/db.js",
  "./js/formats.js",
  "./js/page-turn.js",
  "./js/page-mode.js",
  "./js/reader.js",
  "./js/shelf.js",
  "./js/menu.js",
  "./js/app.js",
  "./js/turn.js",
  "https://code.jquery.com/jquery-3.6.0.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
];

const ALLOWED_CDN_HOSTS = ["code.jquery.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_FILES).catch((err) => {
        // Don't fail install if a CDN is briefly unreachable; retry on next fetch.
        console.warn(`[${SW_VERSION}] Shell precache partial failure:`, err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const allowedCdn = ALLOWED_CDN_HOSTS.includes(url.hostname);
  if (!sameOrigin && !allowedCdn) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "GET_VERSION") {
    event.source?.postMessage({ version: SW_VERSION });
  }
});
