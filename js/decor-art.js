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
};

window.DECOR_ART = Object.fromEntries(
  Object.entries(window.DECOR_ASSETS).map(([type, src]) => [
    type,
    () => `<img class="decor-photo" src="${src}" alt="" draggable="false">`,
  ])
);

window.DECOR_TYPES = Object.keys(window.DECOR_ASSETS);
window.DECOR_LABELS = {
  bust: "Bust", globe: "Globe", plant: "Plant", candle: "Candle",
  vine: "Trailing Vine", lamp: "Library Lamp", mug: "Tea Mug", frame: "Picture Frame",
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
};
