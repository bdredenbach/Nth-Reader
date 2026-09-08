/* Nth Reader — reader.js
 *
 * Paged books (CBZ/PDF) use the SAME engine Nth Shelf actually uses day to
 * day: Turn.js (js/turn.js) driven through js/page-mode.js, which is the
 * realistic drag-a-corner flipbook. That file is reused byte-for-byte from
 * the Nth Shelf project — it only needs getPageUrl/getIndex/setIndex hooks,
 * which this class supplies.
 *
 * The custom canvas "corner-turn" (page-turn.js) is kept only as the
 * fallback Nth Shelf itself falls back to if Turn.js can't initialize.
 *
 * Reflowable books use EpubPageReader: a right-hand paper page with a
 * draggable turn, measured chapter-by-chapter so long books never hit the
 * browser's global CSS-column ceiling.
 */
window.Reader = class {
  constructor() {
    this.els = {
      root: document.getElementById("reader-view"),
      viewport: document.getElementById("page-viewport"),
      flow: document.getElementById("flow-viewport"),
      flowInner: document.getElementById("flow-inner"),
      title: document.getElementById("reader-title"),
      pageLabel: document.getElementById("reader-page-label"),
      backBtn: document.getElementById("reader-back-btn"),
      chrome: document.getElementById("reader-chrome"),
      prevBtn: document.getElementById("reader-prev-btn"),
      nextBtn: document.getElementById("reader-next-btn"),
    };

    this.mode = "single";
    this.scale = 1;
    this.useTurnJSPageMode = true; // same default as Nth Shelf
    this.book = null;      // db record
    this.content = null;   // normalized {kind, ...}
    this.comic = null;     // {pageCount, id, title} — what page-turn engines read
    this.index = 0;
    this._chromeTimer = null;
    this._scrollSaveTimer = null;

    this.nativePageTurn = new LongboxNativePageTurn(this);
    this.epubPages = new EpubPageReader(this.els.flowInner, this);
    this.turnPageMode = new LongboxPageMode({
      getIssue: () => this.comic,
      getPageUrl: (i) => this.getPageUrl(i),
      getIndex: () => this.index,
      setIndex: (i) => {
        this.index = Math.max(0, Math.min(this.comic.pageCount - 1, i));
        this.updateSliderLabel();
        this.saveProgress();
      },
      onPageChanged: (i) => {
        this.index = Math.max(0, Math.min(this.comic.pageCount - 1, i));
        this.updateSliderLabel();
        this.saveProgress();
      },
      onState: () => { /* console.debug("turnjs:", s) if you need to trace init */ },
    });

    this.els.backBtn.addEventListener("click", () => this.close());
    this.els.prevBtn.addEventListener("click", () => this.onPrevBtn());
    this.els.nextBtn.addEventListener("click", () => this.onNextBtn());
    // A plain tap anywhere on the page toggles the nav bar. This has to be
    // bound unconditionally (not just for the fallback engine) — Turn.js's
    // own gestures handle page-turning via drag, so nothing else was ever
    // wired to bring the auto-hidden chrome back once it hid itself.
    this.els.viewport.addEventListener("click", (e) => this.onViewportTap(e));
    window.addEventListener("resize", () => {
      if (this.content?.kind === "flow") {
        clearTimeout(this._flowResizeTimer);
        this._flowResizeTimer = setTimeout(() => this.openFlowWithTurn(this.book.progress || 0), 180);
      }
    });
  }

  async open(book, content) {
    this.book = book;
    this.content = content;
    this.els.title.textContent = book.title;
    this.els.root.hidden = false;
    this.showChrome();

    if (content.kind === "paged") {
      this._flowUsingTurn = false;
      this.comic = { pageCount: content.pageCount, id: book.id, title: book.title };
      this.index = Math.min(book.progress || 0, content.pageCount - 1);
      this.els.viewport.hidden = false;
      this.els.flow.hidden = true;

      const ok = this.useTurnJSPageMode && await this.turnPageMode.render(this.els.viewport);
      this._usingFallback = !ok;
      if (!ok) await this.renderFallback();
      this.updateSliderLabel();
    } else {
      await this.openFlowWithTurn(book.progress || 0);
    }
  }

  async openFlowWithTurn(progress) {
    // The flow host is briefly visible while chapters are measured at the
    // actual device size, then the resulting live-HTML pages move to Turn.js.
    this.els.viewport.hidden = true;
    this.els.flow.hidden = false;
    await this.epubPages.prepare(this.content.html, progress);
    this.comic = {
      pageCount: this.epubPages.pages.length,
      id: `${this.book.id}-reflow-${this.els.flow.clientWidth}x${this.els.flow.clientHeight}`,
      title: this.book.title,
    };
    this.index = this.epubPages.index;
    this.els.flow.hidden = true;
    this.els.viewport.hidden = false;
    const ok = this.useTurnJSPageMode && await this.turnPageMode.render(this.els.viewport);
    this._flowUsingTurn = !!ok;
    this._usingFallback = !ok;
    if (!ok) {
      this.els.viewport.hidden = true;
      this.els.flow.hidden = false;
      this.epubPages.render();
    }
    this.updateSliderLabel();
  }

  close() {
    this.saveProgress();
    this.els.root.hidden = true;
    window.dispatchEvent(new CustomEvent("nth:reader-closed"));
  }

  onPrevBtn() {
    if (this.content?.kind === "paged") this.prev();
    else this.flowPrev();
  }
  onNextBtn() {
    if (this.content?.kind === "paged") this.next();
    else this.flowNext();
  }

  onViewportTap(e) {
    if (this._usingFallback) {
      const rect = this.els.viewport.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x > rect.width * 0.65) { this.next(); return; }
      if (x < rect.width * 0.35) { this.prev(); return; }
    }
    this.toggleChrome();
  }

  next() {
    if (this.content?.kind !== "paged") return;
    this.showChrome();
    if (!this._usingFallback && this.turnPageMode?.book) { this.turnPageMode.next(); return; }
    if (this.mode === "single" && this.scale <= 1.02 && this.nativePageTurn) {
      this.nativePageTurn.turn("next").then(handled => {
        if (!handled && !this.nativePageTurn.running) this.goToFallback(this.index + 1);
      });
      return;
    }
    this.goToFallback(this.index + 1);
  }

  prev() {
    if (this.content?.kind !== "paged") return;
    this.showChrome();
    if (!this._usingFallback && this.turnPageMode?.book) { this.turnPageMode.prev(); return; }
    if (this.mode === "single" && this.scale <= 1.02 && this.nativePageTurn) {
      this.nativePageTurn.turn("prev").then(handled => {
        if (!handled && !this.nativePageTurn.running) this.goToFallback(this.index - 1);
      });
      return;
    }
    this.goToFallback(this.index - 1);
  }

  // ---------- fallback paged (plain image swap, only if Turn.js fails) ----------
  async renderFallback() {
    const url = await this.getPageUrl(this.index);
    this.els.viewport.innerHTML = "";
    const img = new Image();
    img.src = url;
    img.decoding = "async";
    this.els.viewport.appendChild(img);
    this.updateSliderLabel();
  }
  async goToFallback(i) {
    if (i < 0 || i >= this.comic.pageCount) return;
    this.index = i;
    await this.renderFallback();
    this.saveProgress();
  }

  // render()/getPageUrl() are the hooks both LongboxNativePageTurn and
  // LongboxPageMode call into.
  async render() { return this.renderFallback(); }
  async getPageUrl(i) {
    if (this.content?.kind === "flow") return this.epubPages.makeTurnSource(i);
    return this.content.getPageUrl(i);
  }

  // ---------- reflowable page mode ----------
  flowNext() {
    this.showChrome();
    if (this._flowUsingTurn && this.turnPageMode?.book) this.turnPageMode.next();
    else this.epubPages.next();
  }
  flowPrev() {
    this.showChrome();
    if (this._flowUsingTurn && this.turnPageMode?.book) this.turnPageMode.prev();
    else this.epubPages.prev();
  }

  // ---------- shared chrome / progress ----------
  showChrome() {
    this.els.chrome.classList.add("visible");
    clearTimeout(this._chromeTimer);
    this._chromeTimer = setTimeout(() => this.els.chrome.classList.remove("visible"), 2200);
  }
  toggleChrome() {
    if (this.els.chrome.classList.contains("visible")) {
      this.els.chrome.classList.remove("visible");
      clearTimeout(this._chromeTimer);
    } else {
      this.showChrome();
    }
  }

  updateSliderLabel() {
    if (this.content?.kind === "paged") {
      this.els.pageLabel.textContent = `${this.index + 1} / ${this.comic.pageCount}`;
    } else {
      const total = this.epubPages?.pages?.length || 1;
      this.els.pageLabel.textContent = `${this.index + 1} / ${total}`;
    }
  }
  updateBookmarkFlag() { /* reserved for a future bookmarks feature */ }

  saveProgress() {
    if (!this.book) return;
    if (this.content.kind === "paged") {
      this.book.progress = this.index;
    } else {
      const max = Math.max(1, (this.epubPages?.pages?.length || 1) - 1);
      this.book.progress = this.index / max;
      this.updateSliderLabel();
    }
    NthDB.put(this.book);
  }
};
