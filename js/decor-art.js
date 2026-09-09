/* Nth Reader — photoreal decor asset registry.
 * Artwork is deliberately separate from placement logic: every decoration
 * remains movable, independently resizable and removable in IndexedDB.
 */
window.DECOR_ASSETS = {
  bust: "assets/decor/bust.webp",
  globe: "assets/decor/globe.webp",
  plant: "assets/decor/plant.webp",
  candle: "assets/decor/candle.webp",
  vine: "assets/decor/vine.webp",
  lamp: "assets/decor/lamp.webp",
  mug: "assets/decor/mug.webp",
  frame: "assets/decor/frame.webp",
  clock: "assets/decor/clock.webp",
  glassFox: "assets/decor/glass-fox.webp",
  glassElephant: "assets/decor/glass-elephant.webp",
  glassSwan: "assets/decor/glass-swan.webp",
  whiteTigerBookend: "assets/decor/white-tiger-bookend.webp",
  heroBookend: "assets/decor/hero-bookend.webp",
  cobaltVase: "assets/decor/cobalt-vase.webp",
  porcelainVase: "assets/decor/porcelain-vase.webp",
  copperPot: "assets/decor/copper-pot.webp",
  wovenAirplant: "assets/decor/woven-airplant.webp",
  ceramicAirplant: "assets/decor/ceramic-airplant.webp",
  wireOrb: "assets/decor/wire-orb.webp",
  wirePolyhedron: "assets/decor/wire-polyhedron.webp",
  mountainPainting: "assets/decor/mountain-painting.webp",
  abstractPainting: "assets/decor/abstract-painting.webp",
  cosmosPainting: "assets/decor/cosmos-painting.webp",
};

window.DECOR_ART = Object.fromEntries(
  Object.entries(window.DECOR_ASSETS).map(([type, src]) => [
    type,
    () => `<img class="decor-photo" src="${src}" alt="" draggable="false">`,
  ])
);

// The generated clock supplies the carved wooden case and dial. Live CSS
// hands sit over it so every clock follows the device's own local time.
window.DECOR_ART.clock = () => `
  <span class="live-clock" aria-hidden="true">
    <img class="decor-photo" src="${window.DECOR_ASSETS.clock}" alt="" draggable="false">
    <span class="clock-dial-hands">
      <i class="clock-hand clock-hour"></i>
      <i class="clock-hand clock-minute"></i>
      <i class="clock-hand clock-second"></i>
      <b class="clock-pin"></b>
    </span>
  </span>`;

window.syncDecorClocks = function syncDecorClocks() {
  const now = new Date();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  document.querySelectorAll('.decor-item[data-type="clock"]').forEach((clock) => {
    clock.style.setProperty("--clock-hour", `${hours * 30}deg`);
    clock.style.setProperty("--clock-minute", `${minutes * 6}deg`);
    clock.style.setProperty("--clock-second", `${seconds * 6}deg`);
    clock.setAttribute("aria-label", `Clock showing ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  });
};
window.setInterval(window.syncDecorClocks, 1000);

window.DECOR_TYPES = Object.keys(window.DECOR_ASSETS);
window.DECOR_LABELS = {
  bust: "Bust", globe: "Globe", plant: "Plant", candle: "Candle",
  vine: "Trailing Vine", lamp: "Library Lamp", mug: "Tea Mug", frame: "Picture Frame",
  clock: "Working Clock",
  glassFox: "Glass Fox", glassElephant: "Glass Elephant", glassSwan: "Glass Swan",
  whiteTigerBookend: "White Tiger", heroBookend: "Hero Bookend",
  cobaltVase: "Cobalt Vase", porcelainVase: "Floral Vase", copperPot: "Copper Pot",
  wovenAirplant: "Woven Airplant", ceramicAirplant: "Cozy Airplant",
  wireOrb: "Wire Orb", wirePolyhedron: "Wire Gem",
  mountainPainting: "Mountain Art", abstractPainting: "Abstract Art", cosmosPainting: "Night Art",
};
window.DECOR_HANGING = { vine: true };

// Natural starting proportions. Width and height can then be changed
// independently; this lets vines grow longer without growing wider.
window.DECOR_DEFAULTS = {
  bust: { width: 76, height: 96, baseline: -8 },
  globe: { width: 78, height: 94, baseline: -7 },
  plant: { width: 92, height: 84, baseline: -9 },
  candle: { width: 72, height: 72, baseline: -6 },
  vine: { width: 78, height: 150, baseline: 0, topOffset: -2 },
  lamp: { width: 84, height: 96, baseline: -6 },
  mug: { width: 70, height: 66, baseline: -9 },
  frame: { width: 82, height: 76, baseline: -7 },
  clock: { width: 112, height: 90, baseline: -5, bookSpacing: 5 },
  glassFox: { width: 68, height: 72, baseline: -5, bookSpacing: 5 },
  glassElephant: { width: 76, height: 78, baseline: -5, bookSpacing: 5 },
  glassSwan: { width: 76, height: 78, baseline: -5, bookSpacing: 5 },
  whiteTigerBookend: { width: 72, height: 104, baseline: -4, bookSpacing: -12 },
  heroBookend: { width: 94, height: 104, baseline: -4, bookSpacing: -14 },
  cobaltVase: { width: 62, height: 94, baseline: -6, bookSpacing: 5 },
  porcelainVase: { width: 72, height: 92, baseline: -6, bookSpacing: 5 },
  copperPot: { width: 78, height: 64, baseline: -6, bookSpacing: 5 },
  wovenAirplant: { width: 76, height: 82, baseline: -6, bookSpacing: 4 },
  ceramicAirplant: { width: 76, height: 82, baseline: -6, bookSpacing: 4 },
  wireOrb: { width: 66, height: 96, baseline: -5, bookSpacing: 4 },
  wirePolyhedron: { width: 72, height: 80, baseline: -5, bookSpacing: 4 },
  mountainPainting: { width: 72, height: 84, baseline: -5, bookSpacing: 4 },
  abstractPainting: { width: 78, height: 76, baseline: -5, bookSpacing: 4 },
  cosmosPainting: { width: 78, height: 82, baseline: -5, bookSpacing: 4 },
};
