/* Mirrors the visible bookcase into the native Android home-screen widget.
 * A lightweight model is sent immediately, then replaced by photoreal shelf
 * captures made by the same DOM/CSS renderer used in the app.
 */
window.NthNativeWidget = new (class {
  constructor() {
    this.captureTimer = 0;
    this.captureGeneration = 0;
    // More source shapes keep the native widget from stretching books when
    // the launcher moves between narrow, medium, and wide grid spans.
    this.captureWidths = [280, 360, 460, 580, 760];
    // Render each source snapshot at four times its CSS size. V0.37.00 treats
    // these captures as supersampling sources for an exact-size URI-backed
    // native widget image instead of decoding the entire 4× image at once.
    this.captureScale = 4;
  }

  available() {
    try { return Boolean(window.NthWidgetBridge?.isAvailable?.()); }
    catch (_) { return false; }
  }

  update(shelf) {
    if (!this.available() || !shelf) return;
    const generation = ++this.captureGeneration;
    const payload = this.makePayload(shelf);
    this.send(payload);
    clearTimeout(this.captureTimer);
    this.captureTimer = window.setTimeout(() => {
      this.capturePhotoreal(shelf, payload, generation);
    }, 650);
  }

  makePayload(shelf) {
    const firstShelf = shelf.activeBookcase * 5;
    const lastShelf = firstShelf + 5;
    const stackShelf = new Map((shelf.stacks || []).map((stack) => [String(stack.id), Number(stack.shelfIndex) || 0]));
    const books = (shelf.books || []).map((book) => {
      const shelfIndex = book.stackId && stackShelf.has(String(book.stackId))
        ? stackShelf.get(String(book.stackId))
        : (Number(book.shelfIndex) || 0);
      if (shelfIndex < firstShelf || shelfIndex >= lastShelf) return null;
      return {
        id: String(book.id), title: book.title || "Untitled", shelf: shelfIndex - firstShelf,
        slot: Number(book.slot) || 0, hue: Number(book.hue) || this.hashHue(book.title || ""),
        width: Number(book.spineWidth) || 22, height: Number(book.spineHeight) || 116,
        facedOut: Boolean(book.facedOut), stacked: Boolean(book.stackId), stackOrder: Number(book.stackOrder) || 0,
        progress: Number(book.progress) || 0,
        art: book.facedOut
          ? (book.faceCover || book.coverThumb || book.scannedSpine || "")
          : (book.scannedSpine || book.coverThumb || ""),
      };
    }).filter(Boolean);
    const decor = (shelf.decorItems || []).filter((item) => {
      const shelfIndex = Number(item.shelfIndex) || 0;
      return shelfIndex >= firstShelf && shelfIndex < lastShelf;
    }).map((item) => ({
      type: item.type || "object", shelf: (Number(item.shelfIndex) || 0) - firstShelf,
      position: Number(item.position) || 50,
    }));
    return {
      version: 3, activeBookcase: shelf.activeBookcase, bookcaseCount: shelf.bookcaseCount,
      shelfTheme: shelf.root?.dataset?.shelfTheme || "walnut",
      backdrop: shelf.root?.dataset?.backdrop || "walnut", books, decor,
    };
  }

  send(payload) {
    try { window.NthWidgetBridge.updateShelf(JSON.stringify(payload)); }
    catch (_) { /* the web/PWA shelf remains fully independent */ }
  }

  async capturePhotoreal(shelf, payload, generation) {
    if (generation !== this.captureGeneration || !window.html2canvas) return;
    try {
      const variants = [];
      const captureId = `${Date.now()}-${generation}`;
      let streaming = false;
      try {
        streaming = typeof window.NthWidgetBridge?.beginShelfCapture === "function"
          && typeof window.NthWidgetBridge?.addShelfCaptureVariant === "function";
        if (streaming) {
          streaming = window.NthWidgetBridge.beginShelfCapture(
            JSON.stringify(payload), captureId, this.captureWidths.length
          ) === true;
        }
      } catch (_) { streaming = false; }
      const captureScale = streaming ? this.captureScale : 2;

      for (let index = 0; index < this.captureWidths.length; index += 1) {
        if (generation !== this.captureGeneration) return;
        const variant = await this.captureVariant(shelf, this.captureWidths[index], captureScale);
        variants.push(variant);
        if (streaming) {
          try {
            const accepted = window.NthWidgetBridge.addShelfCaptureVariant(
              captureId, index, this.captureWidths.length, JSON.stringify(variant)
            );
            if (accepted !== true) throw new Error("Native widget rejected a capture variant.");
          } catch (_) { return; }
        }
      }
      if (generation !== this.captureGeneration) return;
      // Older Android wrappers do not expose streaming. Keep their original
      // all-at-once path functional at the lower resolutions they support.
      if (!streaming && captureScale <= 2) this.send({ ...payload, variants });
    } catch (_) {
      // The native renderer has already received a complete fallback model.
    }
  }

  async captureVariant(shelf, width, scale = this.captureScale) {
    const stage = document.createElement("div");
    stage.className = "shelf-root widget-capture-stage";
    stage.dataset.backdrop = shelf.root?.dataset?.backdrop || "walnut";
    stage.dataset.shelfTheme = shelf.root?.dataset?.shelfTheme || "walnut";
    stage.style.width = `${width}px`;
    document.body.appendChild(stage);
    try {
      shelf.renderBookcaseInto(stage, shelf.activeBookcase);
      stage.querySelectorAll("img").forEach((image) => { image.loading = "eager"; });
      stage.querySelectorAll(".selected,.selected-for-stack,.selected-for-lean").forEach((node) => {
        node.classList.remove("selected", "selected-for-stack", "selected-for-lean");
      });
      if (window.syncDecorPhotoFrames) window.syncDecorPhotoFrames(stage);
      if (window.syncDecorClocks) window.syncDecorClocks();
      await this.nextPaint();
      shelf.layoutRows(stage);
      await this.waitForImages(stage);
      await this.nextPaint();

      const rows = Array.from(stage.querySelectorAll(":scope > .shelf-row"));
      const height = Math.max(1, stage.scrollHeight);
      const rowBottoms = rows.map((row) => Math.round(row.offsetTop + row.offsetHeight));
      const canvas = await window.html2canvas(stage, {
        backgroundColor: null,
        logging: false,
        scale,
        useCORS: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      });
      const renderedScale = canvas.width / Math.max(1, width);
      return {
        width: canvas.width,
        height: canvas.height,
        rowBottoms: rowBottoms.map((bottom) => Math.round(bottom * renderedScale)),
        art: canvas.toDataURL("image/webp", .90),
      };
    } finally {
      stage.remove();
    }
  }

  nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async waitForImages(root) {
    const pending = Array.from(root.querySelectorAll("img")).map((image) => {
      if (image.complete && image.naturalWidth) return Promise.resolve();
      if (image.decode) return image.decode().catch(() => undefined);
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    });
    await Promise.race([
      Promise.all(pending),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  }

  hashHue(text) {
    let hash = 0;
    for (const character of String(text)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return Math.abs(hash) % 360;
  }
})();
