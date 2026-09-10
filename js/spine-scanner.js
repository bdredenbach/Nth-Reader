/* Nth Reader — photographed physical-book spine scanner.
 * Images never leave the device. A four-corner bilinear correction turns a
 * camera/gallery photograph into compact WebP shelf artwork.
 */
window.SpineScanner = class {
  constructor({ getBooks, onCreate, onLink }) {
    this.getBooks = getBooks;
    this.onCreate = onCreate;
    this.onLink = onLink;
    this.input = document.getElementById("spine-photo-input");
    this.coverInput = document.getElementById("cover-photo-input");
    this.overlay = document.getElementById("spine-scanner-overlay");
    this.panel = document.getElementById("spine-scanner");
    this.cropStep = document.getElementById("spine-crop-step");
    this.detailsStep = document.getElementById("spine-details-step");
    this.canvas = document.getElementById("spine-crop-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.preview = document.getElementById("spine-result-preview");
    this.coverPreviewWrap = document.getElementById("scanner-cover-preview");
    this.coverPreview = document.getElementById("cover-result-preview");
    this.coverPhotoButton = document.getElementById("cover-photo-btn");
    this.coverAdjustButton = document.getElementById("cover-adjust-btn");
    this.coverClearButton = document.getElementById("cover-clear-btn");
    this.title = document.getElementById("spine-book-title");
    this.author = document.getElementById("spine-book-author");
    this.linkRow = document.getElementById("spine-link-row");
    this.linkSelect = document.getElementById("spine-link-book");
    this.saveButton = document.getElementById("spine-save-btn");
    this.status = document.getElementById("spine-save-status");
    this.sourceCanvas = null;
    this.points = [];
    this.view = null;
    this.dragCorner = -1;
    this.result = null;
    this.coverResult = null;
    this.scanKind = "spine";
    this.spineState = null;
    this.coverState = null;
    this.fileBaseName = "";

    document.getElementById("spine-scanner-close").addEventListener("click", () => this.close());
    this.overlay.addEventListener("click", () => this.close());
    this.input.addEventListener("change", () => this.loadSelection(this.input, "spine"));
    this.coverInput.addEventListener("change", () => this.loadSelection(this.coverInput, "cover"));
    document.getElementById("spine-rotate-btn").addEventListener("click", () => this.rotateSource());
    document.getElementById("spine-reset-btn").addEventListener("click", () => { this.resetCorners(); this.draw(); });
    document.getElementById("spine-crop-btn").addEventListener("click", () => this.makeCorrectedSpine());
    document.getElementById("spine-back-btn").addEventListener("click", () => this.adjustCrop("spine"));
    this.coverPhotoButton.addEventListener("click", () => this.chooseCoverPhoto());
    this.coverAdjustButton.addEventListener("click", () => this.adjustCrop("cover"));
    this.coverClearButton.addEventListener("click", () => this.clearCover());
    this.saveButton.addEventListener("click", () => this.save());
    document.querySelectorAll('input[name="spine-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => this.syncMode());
    });
    this.linkSelect.addEventListener("change", () => this.useLinkedBookDetails());
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.pointerUp(event));
    window.addEventListener("resize", () => {
      if (!this.panel.hidden && !this.cropStep.hidden) this.resizeCanvas();
    });

    this.infoOverlay = document.getElementById("physical-book-overlay");
    this.infoPanel = document.getElementById("physical-book-info");
    document.getElementById("physical-book-close").addEventListener("click", () => this.closeBook());
    this.infoOverlay.addEventListener("click", () => this.closeBook());
  }

  choosePhoto() {
    this.input.value = "";
    this.input.click();
  }

  chooseCoverPhoto() {
    this.coverInput.value = "";
    this.coverInput.click();
  }

  async loadSelection(input, kind) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (kind === "spine") this.fileBaseName = file.name.replace(/\.[^.]+$/, "");
    try {
      const image = await this.decodeImage(file);
      const longest = Math.max(image.width, image.height);
      const scale = Math.min(1, 1600 / longest);
      const source = document.createElement("canvas");
      source.width = Math.max(1, Math.round(image.width * scale));
      source.height = Math.max(1, Math.round(image.height * scale));
      source.getContext("2d", { alpha: false }).drawImage(image, 0, 0, source.width, source.height);
      image.close?.();
      this.sourceCanvas = source;
      this.scanKind = kind;
      if (kind === "spine") {
        this.result = null;
        this.spineState = null;
        this.clearCover();
        this.title.value = this.fileBaseName;
        this.author.value = "";
        document.querySelector('input[name="spine-mode"][value="physical"]').checked = true;
      } else {
        this.coverState = null;
      }
      this.resetCorners();
      this.showStep("crop");
      this.open();
      requestAnimationFrame(() => this.resizeCanvas());
    } catch (error) {
      alert(`That photograph could not be opened: ${error.message || error}`);
    }
  }

  adjustCrop(kind) {
    const state = kind === "cover" ? this.coverState : this.spineState;
    if (!state?.sourceCanvas) return;
    this.scanKind = kind;
    this.sourceCanvas = state.sourceCanvas;
    this.points = state.points.map((point) => ({ ...point }));
    this.showStep("crop");
  }

  clearCover() {
    this.coverResult = null;
    this.coverState = null;
    if (this.coverPreview) this.coverPreview.removeAttribute("src");
    if (this.coverPreviewWrap) this.coverPreviewWrap.hidden = true;
    if (this.coverPhotoButton) this.coverPhotoButton.textContent = "+ Add Cover Photo";
    if (this.coverAdjustButton) this.coverAdjustButton.hidden = true;
    if (this.coverClearButton) this.coverClearButton.hidden = true;
  }

  async decodeImage(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
      catch (_) { try { return await createImageBitmap(file); } catch (_) { /* fallback below */ } }
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unsupported image.")); };
      image.src = url;
    });
  }

  open() {
    this.overlay.hidden = false;
    this.panel.hidden = false;
    requestAnimationFrame(() => {
      this.overlay.classList.add("visible");
      this.panel.classList.add("visible");
    });
  }

  close() {
    this.overlay.classList.remove("visible");
    this.panel.classList.remove("visible");
    setTimeout(() => {
      this.overlay.hidden = true;
      this.panel.hidden = true;
    }, 200);
  }

  showStep(step) {
    const crop = step === "crop";
    this.cropStep.hidden = !crop;
    this.detailsStep.hidden = crop;
    const isCover = this.scanKind === "cover";
    document.getElementById("spine-scanner-title").textContent = crop && isCover ? "Add a Front Cover" : "Scan a Book Spine";
    document.getElementById("spine-scanner-subtitle").textContent = crop
      ? `Drag each corner onto the photographed ${isCover ? "front cover" : "spine"}.`
      : "Save it as a physical book or apply it to an ebook.";
    document.getElementById("spine-crop-tip").textContent = isCover
      ? "Move the numbered corners around only the cover. Perspective and camera angle will be corrected."
      : "Move the numbered corners around only the spine. Angled photographs will be straightened.";
    document.getElementById("spine-crop-btn").textContent = isCover ? "Correct Cover ›" : "Straighten Spine ›";
    if (crop) requestAnimationFrame(() => this.resizeCanvas());
  }

  resetCorners() {
    if (!this.sourceCanvas) return;
    const { width, height } = this.sourceCanvas;
    const mx = width * .12, my = height * .06;
    this.points = [
      { x: mx, y: my }, { x: width - mx, y: my },
      { x: width - mx, y: height - my }, { x: mx, y: height - my }
    ];
  }

  rotateSource() {
    if (!this.sourceCanvas) return;
    const rotated = document.createElement("canvas");
    rotated.width = this.sourceCanvas.height;
    rotated.height = this.sourceCanvas.width;
    const ctx = rotated.getContext("2d", { alpha: false });
    ctx.translate(rotated.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(this.sourceCanvas, 0, 0);
    this.sourceCanvas = rotated;
    this.resetCorners();
    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.sourceCanvas) return;
    const wrap = this.canvas.parentElement;
    const width = Math.max(260, Math.min(720, wrap.clientWidth || window.innerWidth - 36));
    const height = Math.max(300, Math.min(window.innerHeight * .52, 590));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.view = { width, height, dpr };
    this.draw();
  }

  imageTransform() {
    const { width, height } = this.view;
    const scale = Math.min(width / this.sourceCanvas.width, height / this.sourceCanvas.height);
    return {
      scale,
      x: (width - this.sourceCanvas.width * scale) / 2,
      y: (height - this.sourceCanvas.height * scale) / 2
    };
  }

  draw() {
    if (!this.sourceCanvas || !this.view) return;
    const { width, height, dpr } = this.view;
    const t = this.imageTransform();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = "#090604";
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.drawImage(this.sourceCanvas, t.x, t.y, this.sourceCanvas.width * t.scale, this.sourceCanvas.height * t.scale);
    const display = this.points.map((point) => ({ x: t.x + point.x * t.scale, y: t.y + point.y * t.scale }));
    this.ctx.save();
    this.ctx.beginPath();
    display.forEach((point, index) => index ? this.ctx.lineTo(point.x, point.y) : this.ctx.moveTo(point.x, point.y));
    this.ctx.closePath();
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = "#f2bd50";
    this.ctx.fillStyle = "rgba(239,178,62,.12)";
    this.ctx.fill();
    this.ctx.stroke();
    display.forEach((point, index) => {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 14, 0, Math.PI * 2);
      this.ctx.fillStyle = "#f4bd4e";
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#38200d";
      this.ctx.stroke();
      this.ctx.fillStyle = "#2b1809";
      this.ctx.font = "800 12px system-ui";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(String(index + 1), point.x, point.y);
    });
    this.ctx.restore();
  }

  canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.view.width / rect.width),
      y: (event.clientY - rect.top) * (this.view.height / rect.height)
    };
  }

  pointerDown(event) {
    if (!this.view) return;
    const p = this.canvasPoint(event);
    const t = this.imageTransform();
    const display = this.points.map((point) => ({ x: t.x + point.x * t.scale, y: t.y + point.y * t.scale }));
    let best = -1, distance = 34;
    display.forEach((point, index) => {
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d < distance) { best = index; distance = d; }
    });
    if (best < 0) return;
    this.dragCorner = best;
    this.canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  pointerMove(event) {
    if (this.dragCorner < 0) return;
    const p = this.canvasPoint(event);
    const t = this.imageTransform();
    const point = {
      x: Math.max(0, Math.min(this.sourceCanvas.width, (p.x - t.x) / t.scale)),
      y: Math.max(0, Math.min(this.sourceCanvas.height, (p.y - t.y) / t.scale))
    };
    const i = this.dragCorner, gap = 8;
    if (i === 0 || i === 3) point.x = Math.min(point.x, Math.min(this.points[1].x, this.points[2].x) - gap);
    else point.x = Math.max(point.x, Math.max(this.points[0].x, this.points[3].x) + gap);
    if (i === 0 || i === 1) point.y = Math.min(point.y, Math.min(this.points[2].y, this.points[3].y) - gap);
    else point.y = Math.max(point.y, Math.max(this.points[0].y, this.points[1].y) + gap);
    this.points[i] = point;
    this.draw();
    event.preventDefault();
  }

  pointerUp(event) {
    if (this.dragCorner < 0) return;
    this.dragCorner = -1;
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  async makeCorrectedSpine() {
    if (!this.sourceCanvas || this.points.length !== 4) return;
    const kind = this.scanKind;
    const isCover = kind === "cover";
    const straightenButton = document.getElementById("spine-crop-btn");
    straightenButton.disabled = true;
    straightenButton.textContent = isCover ? "Correcting Cover…" : "Straightening Spine…";
    // Let the busy label paint before the pixel correction begins.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      const [tl, tr, br, bl] = this.points;
      const top = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      const bottom = Math.hypot(br.x - bl.x, br.y - bl.y);
      const left = Math.hypot(bl.x - tl.x, bl.y - tl.y);
      const right = Math.hypot(br.x - tr.x, br.y - tr.y);
      const measuredRatio = ((top + bottom) / 2) / Math.max(1, (left + right) / 2);
      const ratio = isCover
        ? Math.max(.35, Math.min(1.25, measuredRatio))
        : Math.max(.055, Math.min(.45, measuredRatio));
      const outHeight = isCover ? 900 : 720;
      const outWidth = Math.max(isCover ? 315 : 40, Math.min(isCover ? 1125 : 480, Math.round(outHeight * ratio)));
      const output = this.warpQuadrilateral(this.sourceCanvas, this.points, outWidth, outHeight);
      let data = output.toDataURL("image/webp", .88);
      if (!data.startsWith("data:image/webp")) data = output.toDataURL("image/jpeg", .88);
      const state = {
        sourceCanvas: this.sourceCanvas,
        points: this.points.map((point) => ({ ...point })),
      };
      if (isCover) {
        this.coverResult = { data, width: outWidth, height: outHeight };
        this.coverState = state;
        this.coverPreview.src = data;
        this.coverPreviewWrap.hidden = false;
        this.coverPhotoButton.textContent = "Change Cover Photo";
        this.coverAdjustButton.hidden = false;
        this.coverClearButton.hidden = false;
      } else {
        this.result = {
          data,
          width: outWidth,
          height: outHeight,
          spineWidth: Math.max(18, Math.min(56, Math.round(116 * outWidth / outHeight))),
          spineHeight: 116
        };
        this.spineState = state;
        this.preview.src = data;
        await this.populateBooks();
        this.syncMode();
      }
      this.showStep("details");
    } catch (error) {
      alert(`The ${isCover ? "cover" : "spine"} could not be corrected: ${error.message || error}`);
    } finally {
      straightenButton.disabled = false;
      straightenButton.textContent = isCover ? "Correct Cover ›" : "Straighten Spine ›";
    }
  }

  warpQuadrilateral(source, points, width, height) {
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    const src = sourceCtx.getImageData(0, 0, source.width, source.height);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const outCtx = output.getContext("2d", { alpha: false });
    const out = outCtx.createImageData(width, height);
    const [tl, tr, br, bl] = points;
    for (let y = 0; y < height; y++) {
      const v = height === 1 ? 0 : y / (height - 1);
      for (let x = 0; x < width; x++) {
        const u = width === 1 ? 0 : x / (width - 1);
        const sx = (1 - v) * ((1 - u) * tl.x + u * tr.x) + v * ((1 - u) * bl.x + u * br.x);
        const sy = (1 - v) * ((1 - u) * tl.y + u * tr.y) + v * ((1 - u) * bl.y + u * br.y);
        const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(sx)));
        const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(sy)));
        const x1 = Math.min(source.width - 1, x0 + 1);
        const y1 = Math.min(source.height - 1, y0 + 1);
        const fx = Math.max(0, Math.min(1, sx - x0));
        const fy = Math.max(0, Math.min(1, sy - y0));
        const a = (y0 * source.width + x0) * 4;
        const b = (y0 * source.width + x1) * 4;
        const c = (y1 * source.width + x0) * 4;
        const d = (y1 * source.width + x1) * 4;
        const to = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const topColor = src.data[a + channel] * (1 - fx) + src.data[b + channel] * fx;
          const bottomColor = src.data[c + channel] * (1 - fx) + src.data[d + channel] * fx;
          out.data[to + channel] = Math.round(topColor * (1 - fy) + bottomColor * fy);
        }
        out.data[to + 3] = 255;
      }
    }
    outCtx.putImageData(out, 0, 0);
    return output;
  }

  async populateBooks() {
    const books = (await this.getBooks()).filter((book) => book.format !== "physical");
    this.availableBooks = books;
    this.linkSelect.innerHTML = books.length
      ? books.map((book) => `<option value="${this.escape(book.id)}">${this.escape(book.title)}</option>`).join("")
      : '<option value="">No digital books available</option>';
  }

  mode() { return document.querySelector('input[name="spine-mode"]:checked')?.value || "physical"; }

  syncMode() {
    const linking = this.mode() === "link";
    this.linkRow.hidden = !linking;
    this.saveButton.textContent = linking ? "Apply to Book" : "Add to Shelf";
    this.saveButton.disabled = linking && !this.availableBooks?.length;
    if (linking) this.useLinkedBookDetails();
  }

  useLinkedBookDetails() {
    if (this.mode() !== "link") return;
    const book = this.availableBooks?.find((candidate) => candidate.id === this.linkSelect.value);
    if (!book) return;
    this.title.value = book.title || this.title.value;
    this.author.value = book.author || "";
  }

  async save() {
    if (!this.result || this.saveButton.disabled) return;
    const title = this.title.value.trim() || "Untitled Physical Book";
    const author = this.author.value.trim();
    this.saveButton.disabled = true;
    this.status.textContent = this.mode() === "link" ? "Applying photographed spine…" : "Saving physical book…";
    try {
      const payload = { title, author, ...this.result };
      if (this.coverResult?.data) {
        payload.coverThumb = this.coverResult.data;
        payload.faceCover = this.coverResult.data;
      }
      if (this.mode() === "link") await this.onLink(this.linkSelect.value, payload);
      else await this.onCreate(payload);
      this.status.textContent = "Saved.";
      this.close();
    } catch (error) {
      this.status.textContent = error.message || String(error);
      this.saveButton.disabled = false;
    }
  }

  showBook(book) {
    const artwork = document.getElementById("physical-book-spine");
    const artWrap = artwork.closest(".physical-book-art");
    const hasCover = Boolean(book.faceCover || book.coverThumb);
    artwork.src = book.faceCover || book.coverThumb || book.scannedSpine || "";
    artwork.alt = hasCover ? `Front cover of ${book.title || "physical book"}` : `Spine of ${book.title || "physical book"}`;
    artWrap?.classList.toggle("spine-only", !hasCover);
    document.getElementById("physical-book-title").textContent = book.title || "Untitled Physical Book";
    const author = document.getElementById("physical-book-author");
    author.textContent = book.author || "Author not recorded";
    this.infoOverlay.hidden = false;
    this.infoPanel.hidden = false;
    requestAnimationFrame(() => {
      this.infoOverlay.classList.add("visible");
      this.infoPanel.classList.add("visible");
    });
  }

  closeBook() {
    this.infoOverlay.classList.remove("visible");
    this.infoPanel.classList.remove("visible");
    setTimeout(() => { this.infoOverlay.hidden = true; this.infoPanel.hidden = true; }, 180);
  }

  escape(value) {
    const span = document.createElement("span");
    span.textContent = String(value ?? "");
    return span.innerHTML;
  }
};
