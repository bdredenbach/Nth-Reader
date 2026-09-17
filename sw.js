// NTH READER — V-1.0.4

const SW_VERSION = "Nth-Reader-V-1.0.4";
const CACHE_NAME = `nth-reader-shell-${SW_VERSION}`;

const SHELL_FILES = [
  "./js/feature-guide.js",
  "./css/feature-guide.css",
  "./privacy.html",
  "./js/launch.js",
  "./js/licenses.js",
  "./THIRD_PARTY_NOTICES.txt",
  "./assets/splash/nth-bookcase.png",
  "./assets/shelf/carved-walnut-row.png",
  "./assets/fonts/bodoni-moda.woff",
  "./assets/fonts/newsreader.woff",
  "./assets/fonts/fraunces.woff",
  "./assets/fonts/petrona.woff",
  "./assets/fonts/gloock.woff",
  "./assets/fonts/instrument-serif.woff",
  "./assets/fonts/licenses/bodoni-moda.txt",
  "./assets/fonts/licenses/newsreader.txt",
  "./assets/fonts/licenses/noto-sans.txt",
  "./assets/fonts/licenses/eb-garamond.txt",
  "./assets/fonts/licenses/fraunces.txt",
  "./assets/fonts/licenses/atkinson.txt",
  "./assets/fonts/licenses/literata.txt",
  "./assets/fonts/licenses/vollkorn.txt",
  "./assets/fonts/licenses/instrument-serif.txt",
  "./assets/fonts/licenses/crimson-pro.txt",
  "./assets/fonts/licenses/source-serif.txt",
  "./assets/fonts/licenses/roboto-slab.txt",
  "./assets/fonts/licenses/gloock.txt",
  "./assets/fonts/licenses/cormorant.txt",
  "./assets/fonts/licenses/petrona.txt",
  "./assets/fonts/licenses/alegreya.txt",
  "./assets/fonts/licenses/nunito-sans.txt",

  "./",
  "./index.html",
  "./manifest.json",
  "./manifest.webmanifest?v=1.0.4",
  "./css/style.css",
  "./assets/icons/favicon-32.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/reader/physical-book-paper.webp",
  "./assets/reader/physical-book-sepia.webp",
  "./assets/reader/physical-book-night.webp",
  "./assets/fonts/alegreya.woff",
  "./assets/fonts/atkinson.woff",
  "./assets/fonts/cormorant.woff",
  "./assets/fonts/crimson-pro.woff",
  "./assets/fonts/eb-garamond.woff",
  "./assets/fonts/literata.woff",
  "./assets/fonts/noto-sans.woff",
  "./assets/fonts/nunito-sans.woff",
  "./assets/fonts/roboto-slab.woff",
  "./assets/fonts/source-serif.woff",
  "./assets/fonts/vollkorn.woff",
  "./js/db.js",
  "./js/backup.js",
  "./js/formats.js",
  "./js/page-turn.js",
  "./js/page-mode.js",
  "./js/reading-style.js",
  "./js/epub-page-reader.js",
  "./js/native-narrator.js",
  "./js/native-widget.js",
  "./js/voice-reader.js",
  "./js/reader.js",
  "./js/decor-art.js",
  "./js/shelf.js",
  "./js/carousel.js",
  "./js/spine-scanner.js",
  "./js/customize.js",
  "./js/menu.js",
  "./js/remove-panel.js",
  "./js/app.js",
  "./js/nth-page-deck.js",
  "./js/vendor/jszip.min.js",
  "./js/vendor/pdf.min.js",
  "./js/vendor/pdf.worker.min.js",
  "./js/vendor/html2canvas.min.js",
  "./assets/decor/bust.webp",
  "./assets/decor/globe.webp",
  "./assets/decor/plant.webp",
  "./assets/decor/candle.webp",
  "./assets/decor/vine.webp",
  "./assets/decor/lamp.webp",
  "./assets/decor/mug.webp",
  "./assets/decor/frame.webp",
  "./assets/decor/clock.webp",
  "./assets/decor/glass-fox.webp",
  "./assets/decor/glass-elephant.webp",
  "./assets/decor/glass-swan.webp",
  "./assets/decor/white-tiger-bookend.webp",
  "./assets/decor/hero-bookend.webp",
  "./assets/decor/cobalt-vase.webp",
  "./assets/decor/porcelain-vase.webp",
  "./assets/decor/copper-pot.webp",
  "./assets/decor/woven-airplant.webp",
  "./assets/decor/ceramic-airplant.webp",
  "./assets/decor/wire-orb.webp",
  "./assets/decor/wire-polyhedron.webp",
  "./assets/decor/mountain-painting.webp",
  "./assets/decor/abstract-painting.webp",
  "./assets/decor/cosmos-painting.webp",
  "./assets/decor/owl-bookend.webp",
  "./assets/decor/raven-bookend.webp",
  "./assets/decor/stag-bookend.webp",
  "./assets/decor/fox-bookend.webp",
  "./assets/decor/wolf-bookend.webp",
  "./assets/decor/bear-bookend.webp",
  "./assets/decor/horse-bookend.webp",
  "./assets/decor/elephant-bookend.webp",
  "./assets/decor/glass-rabbit.webp",
  "./assets/decor/glass-deer.webp",
  "./assets/decor/glass-turtle.webp",
  "./assets/decor/glass-dolphin.webp",
  "./assets/decor/glass-hummingbird.webp",
  "./assets/decor/glass-cat.webp",
  "./assets/decor/glass-dragon.webp",
  "./assets/decor/celadon-jar.webp",
  "./assets/decor/black-amphora.webp",
  "./assets/decor/terracotta-urn.webp",
  "./assets/decor/bluewhite-ginger-jar.webp",
  "./assets/decor/art-nouveau-vase.webp",
  "./assets/decor/raku-bowl.webp",
  "./assets/decor/mosaic-pot.webp",
  "./assets/decor/filigree-box.webp",
  "./assets/decor/walnut-box.webp",
  "./assets/decor/pearl-box.webp",
  "./assets/decor/gothic-box.webp",
  "./assets/decor/lacquer-box.webp",
  "./assets/decor/succulent-echeveria.webp",
  "./assets/decor/succulent-haworthia.webp",
  "./assets/decor/succulent-string-pearls.webp",
  "./assets/decor/succulent-jade.webp",
  "./assets/decor/succulent-moon-cactus.webp",
  "./assets/decor/succulent-lithops.webp",
  "./assets/decor/succulent-aloe.webp",
  "./assets/decor/succulent-hen-chicks.webp",
  "./assets/decor/succulent-burro-tail.webp",
  "./assets/decor/succulent-panda.webp",
  "./assets/decor/airplant-brass.webp",
  "./assets/decor/airplant-driftwood.webp",
  "./assets/decor/airplant-glass-orb.webp",
  "./assets/decor/airplant-moon.webp",
  "./assets/decor/oval-photo-frame.webp",
  "./assets/decor/walnut-photo-frame.webp",
  "./assets/decor/gothic-photo-frame.webp",
  "./assets/decor/gold-photo-frame.webp",
  "./assets/decor/sunrise-painting.webp",
  "./assets/decor/coast-painting.webp",
  "./assets/decor/botanical-painting.webp",
];



self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // Do not forcibly navigate an in-use reader. The previous behavior could
      // interrupt an IndexedDB write or file import mid-action. Network-first
      // shell requests load this version on the user's next normal refresh.
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  // Chrome's installability evaluator must receive the current manifest
  // directly from GitHub Pages. Do not let an older cached manifest response
  // mask a newly deployed identity, scope, icon, or display setting.
  const manifestRequest = sameOrigin && (
    req.destination === "manifest" ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/manifest.json")
  );
  if (manifestRequest) return;

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
