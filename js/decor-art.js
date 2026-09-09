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
  owlBookend: "assets/decor/owl-bookend.webp",
  ravenBookend: "assets/decor/raven-bookend.webp",
  stagBookend: "assets/decor/stag-bookend.webp",
  foxBookend: "assets/decor/fox-bookend.webp",
  wolfBookend: "assets/decor/wolf-bookend.webp",
  bearBookend: "assets/decor/bear-bookend.webp",
  horseBookend: "assets/decor/horse-bookend.webp",
  elephantBookend: "assets/decor/elephant-bookend.webp",
  glassRabbit: "assets/decor/glass-rabbit.webp",
  glassDeer: "assets/decor/glass-deer.webp",
  glassTurtle: "assets/decor/glass-turtle.webp",
  glassDolphin: "assets/decor/glass-dolphin.webp",
  glassHummingbird: "assets/decor/glass-hummingbird.webp",
  glassCat: "assets/decor/glass-cat.webp",
  glassDragon: "assets/decor/glass-dragon.webp",
  celadonJar: "assets/decor/celadon-jar.webp",
  blackAmphora: "assets/decor/black-amphora.webp",
  terracottaUrn: "assets/decor/terracotta-urn.webp",
  bluewhiteGingerJar: "assets/decor/bluewhite-ginger-jar.webp",
  artNouveauVase: "assets/decor/art-nouveau-vase.webp",
  rakuBowl: "assets/decor/raku-bowl.webp",
  mosaicPot: "assets/decor/mosaic-pot.webp",
  filigreeBox: "assets/decor/filigree-box.webp",
  walnutBox: "assets/decor/walnut-box.webp",
  pearlBox: "assets/decor/pearl-box.webp",
  gothicBox: "assets/decor/gothic-box.webp",
  lacquerBox: "assets/decor/lacquer-box.webp",
  succulentEcheveria: "assets/decor/succulent-echeveria.webp",
  succulentHaworthia: "assets/decor/succulent-haworthia.webp",
  succulentStringPearls: "assets/decor/succulent-string-pearls.webp",
  succulentJade: "assets/decor/succulent-jade.webp",
  succulentMoonCactus: "assets/decor/succulent-moon-cactus.webp",
  succulentLithops: "assets/decor/succulent-lithops.webp",
  succulentAloe: "assets/decor/succulent-aloe.webp",
  succulentHenChicks: "assets/decor/succulent-hen-chicks.webp",
  succulentBurroTail: "assets/decor/succulent-burro-tail.webp",
  succulentPanda: "assets/decor/succulent-panda.webp",
  airplantBrass: "assets/decor/airplant-brass.webp",
  airplantDriftwood: "assets/decor/airplant-driftwood.webp",
  airplantGlassOrb: "assets/decor/airplant-glass-orb.webp",
  airplantMoon: "assets/decor/airplant-moon.webp",
  ovalPhotoFrame: "assets/decor/oval-photo-frame.webp",
  walnutPhotoFrame: "assets/decor/walnut-photo-frame.webp",
  gothicPhotoFrame: "assets/decor/gothic-photo-frame.webp",
  goldPhotoFrame: "assets/decor/gold-photo-frame.webp",
  sunrisePainting: "assets/decor/sunrise-painting.webp",
  coastPainting: "assets/decor/coast-painting.webp",
  botanicalPainting: "assets/decor/botanical-painting.webp",
};

window.DECOR_ART = Object.fromEntries(
  Object.entries(window.DECOR_ASSETS).map(([type, src]) => [
    type,
    () => `<img class="decor-photo" src="${src}" alt="" draggable="false" loading="lazy" decoding="async">`,
  ])
);

// The generated clock supplies the carved wooden case and dial. Live CSS
// hands sit over it so every clock follows the device's own local time.
window.DECOR_ART.clock = () => `
  <span class="live-clock" aria-hidden="true">
    <span class="clock-artboard">
      <img class="decor-photo" src="${window.DECOR_ASSETS.clock}" alt="" draggable="false">
      <span class="clock-dial-hands">
        <i class="clock-hand clock-hour"></i>
        <i class="clock-hand clock-minute"></i>
        <i class="clock-hand clock-second"></i>
        <b class="clock-pin"></b>
      </span>
    </span>
  </span>`;

window.DECOR_PHOTO_FRAMES = {
  // Insets follow each generated frame's actual transparent opening, rather
  // than the outer decor control box. Aspect is the trimmed artwork ratio.
  ovalPhotoFrame: { inset: "20.5% 24.5% 20.5% 26.5%", shape: "oval", aspect: 710 / 900 },
  walnutPhotoFrame: { inset: "17.5% 24.8% 23.5% 33%", shape: "portrait", aspect: 876 / 900 },
  gothicPhotoFrame: { inset: "24.5% 20.5% 18.5% 33.5%", shape: "arch", aspect: 694 / 900 },
  goldPhotoFrame: { inset: "20% 17.6% 23.7% 23%", shape: "landscape", aspect: 900 / 606 },
};
Object.keys(window.DECOR_PHOTO_FRAMES).forEach((type) => {
  window.DECOR_ART[type] = (item = {}) => {
    const safePhoto = /^data:image\/(?:jpeg|png|webp);base64,/i.test(item.photoData || "") ? item.photoData : "";
    const config = window.DECOR_PHOTO_FRAMES[type];
    const zoom = Math.max(100, Math.min(250, Number(item.photoZoom) || 100));
    const photoX = Math.max(0, Math.min(100, Number(item.photoX ?? 50)));
    const photoY = Math.max(0, Math.min(100, Number(item.photoY ?? 50)));
    return `<span class="custom-photo-frame" data-shape="${config.shape}" style="--photo-inset:${config.inset};--photo-scale:${zoom / 100};--photo-x:${photoX}%;--photo-y:${photoY}%">
      <img class="decor-photo frame-art" src="${window.DECOR_ASSETS[type]}" alt="" draggable="false" loading="lazy" decoding="async">
      <span class="frame-photo-window">
        ${safePhoto ? `<img class="frame-user-photo" src="${safePhoto}" alt="Chosen photo" draggable="false">` : `<span class="frame-empty-prompt">＋<small>Add photo</small></span>`}
      </span>
    </span>`;
  };
});

window.syncDecorPhotoFrames = function syncDecorPhotoFrames(root = document) {
  root.querySelectorAll('.decor-item[data-type$="PhotoFrame"]').forEach((itemEl) => {
    const artboard = itemEl.querySelector(".custom-photo-frame");
    const config = window.DECOR_PHOTO_FRAMES[itemEl.dataset.type];
    if (!artboard || !config) return;
    const width = itemEl.clientWidth;
    const height = itemEl.clientHeight;
    const fitByWidth = width / Math.max(1, height) <= config.aspect;
    artboard.style.width = `${fitByWidth ? width : height * config.aspect}px`;
    artboard.style.height = `${fitByWidth ? width / config.aspect : height}px`;
  });
};

window.syncDecorClocks = function syncDecorClocks() {
  const now = new Date();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  document.querySelectorAll('.decor-item[data-type="clock"]').forEach((clock) => {
    const artboard = clock.querySelector(".clock-artboard");
    if (artboard) {
      // Fit the generated 900×721 clock into independently adjustable Width
      // and Height bounds, then anchor the hands to that fitted image—not to
      // the outer control box. This keeps the dial centered at every size.
      const aspect = 900 / 721;
      const width = clock.clientWidth;
      const height = clock.clientHeight;
      const fitByWidth = width / Math.max(1, height) <= aspect;
      artboard.style.width = `${fitByWidth ? width : height * aspect}px`;
      artboard.style.height = `${fitByWidth ? width / aspect : height}px`;
    }
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
  owlBookend: "Owl Bookend", ravenBookend: "Raven Bookend", stagBookend: "Stag Bookend",
  foxBookend: "Fox Bookend", wolfBookend: "Wolf Bookend", bearBookend: "Bear Bookend",
  horseBookend: "Horse Bookend", elephantBookend: "Elephant Bookend",
  glassRabbit: "Glass Rabbit", glassDeer: "Glass Deer", glassTurtle: "Glass Turtle",
  glassDolphin: "Glass Dolphin", glassHummingbird: "Glass Hummingbird", glassCat: "Glass Cat", glassDragon: "Glass Dragon",
  celadonJar: "Celadon Jar", blackAmphora: "Black Amphora", terracottaUrn: "Terracotta Urn",
  bluewhiteGingerJar: "Blue & White Jar", artNouveauVase: "Art Nouveau Vase", rakuBowl: "Raku Bowl", mosaicPot: "Mosaic Pot",
  filigreeBox: "Filigree Box", walnutBox: "Walnut Box", pearlBox: "Pearl Inlay Box", gothicBox: "Gothic Box", lacquerBox: "Lacquer Box",
  succulentEcheveria: "Echeveria", succulentHaworthia: "Haworthia", succulentStringPearls: "String of Pearls",
  succulentJade: "Jade Plant", succulentMoonCactus: "Moon Cactus", succulentLithops: "Living Stones",
  succulentAloe: "Aloe", succulentHenChicks: "Hen & Chicks", succulentBurroTail: "Burro's Tail", succulentPanda: "Panda Plant",
  airplantBrass: "Brass Air Plant", airplantDriftwood: "Driftwood Air Plant", airplantGlassOrb: "Glass Orb Air Plant", airplantMoon: "Moon Air Plant",
  ovalPhotoFrame: "Oval Photo Frame", walnutPhotoFrame: "Walnut Photo Frame", gothicPhotoFrame: "Gothic Photo Frame", goldPhotoFrame: "Gold Photo Frame",
  sunrisePainting: "Sunrise Painting", coastPainting: "Coastal Painting", botanicalPainting: "Botanical Painting",
};
window.DECOR_HANGING = { vine: true };

window.DECOR_CATEGORIES = [
  { id: "bookends", label: "Wildlife Bookends", types: ["whiteTigerBookend", "heroBookend", "owlBookend", "ravenBookend", "stagBookend", "foxBookend", "wolfBookend", "bearBookend", "horseBookend", "elephantBookend"] },
  { id: "succulents", label: "Succulents", types: ["succulentEcheveria", "succulentHaworthia", "succulentStringPearls", "succulentJade", "succulentMoonCactus", "succulentLithops", "succulentAloe", "succulentHenChicks", "succulentBurroTail", "succulentPanda"] },
  { id: "airplants", label: "Air Plants & Greenery", types: ["plant", "vine", "wovenAirplant", "ceramicAirplant", "airplantBrass", "airplantDriftwood", "airplantGlassOrb", "airplantMoon"] },
  { id: "glass", label: "Glass Menagerie", types: ["glassFox", "glassElephant", "glassSwan", "glassRabbit", "glassDeer", "glassTurtle", "glassDolphin", "glassHummingbird", "glassCat", "glassDragon"] },
  { id: "pottery", label: "Pottery & Vases", types: ["cobaltVase", "porcelainVase", "copperPot", "celadonJar", "blackAmphora", "terracottaUrn", "bluewhiteGingerJar", "artNouveauVase", "rakuBowl", "mosaicPot"] },
  { id: "boxes", label: "Ornate Boxes", types: ["filigreeBox", "walnutBox", "pearlBox", "gothicBox", "lacquerBox"] },
  { id: "frames", label: "Frames & Art", types: ["ovalPhotoFrame", "walnutPhotoFrame", "gothicPhotoFrame", "goldPhotoFrame", "frame", "mountainPainting", "abstractPainting", "cosmosPainting", "sunrisePainting", "coastPainting", "botanicalPainting"] },
  { id: "objects", label: "Library Objects", types: ["bust", "globe", "clock", "lamp", "candle", "mug", "wireOrb", "wirePolyhedron"] },
];

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

// New decorations deliberately share predictable 100 × 100 starting controls
// and the close-packed -40 spacing requested for newly added objects.
Object.keys(window.DECOR_ASSETS).forEach((type) => {
  if (!window.DECOR_DEFAULTS[type]) {
    window.DECOR_DEFAULTS[type] = { width: 100, height: 100, baseline: -5, bookSpacing: -40 };
  }
});
