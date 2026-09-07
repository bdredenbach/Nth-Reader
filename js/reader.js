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
 * Flow (reflowable text: EPUB/RTF/MOBI) books are a plain scrollable
 * document, not CSS-column pages. An earlier version paginated the whole
 * book into fixed-width columns in one go, which silently broke on long
 * books — a big omnibus needed 3000+ columns, and browsers cap how many
 * columns a multi-column layout will actually render, so the page came up
 * blank past a certain length. Native scrolling has no such ceiling and
 * is simpler and more robust for arbitrary-length text.
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
    this.els.flow.addEventListener("scroll", () => this.onFlowScroll());
    this.els.flow.addEventListener("click", () => this.toggleChrome());
    window.addEventListener("resize", () => {
      if (this.content?.kind === "flow") this.applyFlowWidth();
    });
  }

  async open(book, content) {
    this.book = book;
    this.content = content;
    this.els.title.textContent = book.title;
    this.els.root.hidden = false;
    this.showChrome();

    if (content.kind === "paged") {
      this.comic = { pageCount: content.pageCount, id: book.id, title: book.title };
      this.index = Math.min(book.progress || 0, content.pageCount - 1);
      this.els.viewport.hidden = false;
      this.els.flow.hidden = true;

      const ok = this.useTurnJSPageMode && await this.turnPageMode.render(this.els.viewport);
      this._usingFallback = !ok;
      if (!ok) await this.renderFallback();
      this.updateSliderLabel();
    } else {
      this.els.viewport.hidden = true;
      this.els.flow.hidden = false;
      this.els.pageLabel.textContent = "";
      this.els.flowInner.innerHTML = content.html;
      this.applyFlowWidth();
      const progress = book.progress || 0;
      // Restore scroll position once real layout (incl. any images) has settled.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const max = this.els.flow.scrollHeight - this.els.flow.clientHeight;
        this.els.flow.scrollTop = Math.max(0, max * progress);
        this.updateSliderLabel();
      }));
    }
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
  async getPageUrl(i) { return this.content.getPageUrl(i); }

  // ---------- flow (reflowable text) mode — plain vertical scroll ----------
  applyFlowWidth() {
    const w = this.els.flow.clientWidth;
    // A centered readable column on wide screens; full-width on phones.
    this.els.flowInner.style.maxWidth = Math.min(w, 720) + "px";
  }

  onFlowScroll() {
    this.showChrome();
    clearTimeout(this._scrollSaveTimer);
    this._scrollSaveTimer = setTimeout(() => this.saveProgress(), 400);
  }

  flowNext() {
    this.showChrome();
    this.els.flow.scrollBy({ top: this.els.flow.clientHeight * 0.9, behavior: "smooth" });
  }
  flowPrev() {
    this.showChrome();
    this.els.flow.scrollBy({ top: -this.els.flow.clientHeight * 0.9, behavior: "smooth" });
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
      const max = this.els.flow.scrollHeight - this.els.flow.clientHeight;
      const pct = max > 0 ? Math.round((this.els.flow.scrollTop / max) * 100) : 100;
      this.els.pageLabel.textContent = `${pct}%`;
    }
  }
  updateBookmarkFlag() { /* reserved for a future bookmarks feature */ }

  saveProgress() {
    if (!this.book) return;
    if (this.content.kind === "paged") {
      this.book.progress = this.index;
    } else {
      const max = this.els.flow.scrollHeight - this.els.flow.clientHeight;
      this.book.progress = max > 0 ? this.els.flow.scrollTop / max : 0;
      this.updateSliderLabel();
    }
    NthDB.put(this.book);
  }
};
