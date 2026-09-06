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
 * Flow (reflowable text: EPUB/RTF/MOBI) books use a simple CSS-column
 * paginator instead — there's no fixed-size page image for either engine
 * above to grab.
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
    this.flowPage = 0;
    this.flowPageCount = 1;
    this._chromeTimer = null;

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
    this.els.prevBtn.addEventListener("click", () => this.prev());
    this.els.nextBtn.addEventListener("click", () => this.next());
    this.els.flow.addEventListener("click", (e) => this.onTapFlow(e));
    window.addEventListener("resize", () => { if (this.content?.kind === "flow") this.layoutFlow(); });
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
      if (!ok) {
        // Same fallback path Nth Shelf takes if Turn.js can't initialize.
        this._usingFallback = true;
        this.els.viewport.addEventListener("click", (e) => this.onTapPagedFallback(e));
        await this.renderFallback();
      } else {
        this._usingFallback = false;
      }
      this.updateSliderLabel();
    } else {
      this.els.viewport.hidden = true;
      this.els.flow.hidden = false;
      this.els.flowInner.innerHTML = content.html;
      this.layoutFlow();
      this.flowPage = Math.round((book.progress || 0) * (this.flowPageCount - 1)) || 0;
      this.renderFlow();
    }
  }

  close() {
    this.saveProgress();
    this.els.root.hidden = true;
    window.dispatchEvent(new CustomEvent("nth:reader-closed"));
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
  async onTapPagedFallback(e) {
    const rect = this.els.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width * 0.65) this.next();
    else if (x < rect.width * 0.35) this.prev();
    else this.toggleChrome();
  }

  // render()/getPageUrl() are the hooks both LongboxNativePageTurn and
  // LongboxPageMode call into.
  async render() { return this.renderFallback(); }
  async getPageUrl(i) { return this.content.getPageUrl(i); }

  // ---------- flow (reflowable text) mode ----------
  layoutFlow() {
    const w = this.els.flow.clientWidth;
    const h = this.els.flow.clientHeight;
    this.els.flowInner.style.columnWidth = w + "px";
    this.els.flowInner.style.columnGap = "0px";
    this.els.flowInner.style.height = h + "px";
    this.els.flowInner.style.width = w + "px";
    const totalWidth = this.els.flowInner.scrollWidth;
    this.flowPageCount = Math.max(1, Math.round(totalWidth / w));
    this.flowPage = Math.min(this.flowPage, this.flowPageCount - 1);
  }

  renderFlow() {
    const w = this.els.flow.clientWidth;
    this.els.flowInner.style.transition = "transform .28s ease";
    this.els.flowInner.style.transform = `translateX(${-this.flowPage * w}px)`;
    this.updateSliderLabel();
  }

  onTapFlow(e) {
    const rect = this.els.flow.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width * 0.65) this.flowNext();
    else if (x < rect.width * 0.35) this.flowPrev();
    else this.toggleChrome();
  }

  flowNext() {
    if (this.flowPage < this.flowPageCount - 1) { this.flowPage++; this.renderFlow(); this.saveProgress(); }
  }
  flowPrev() {
    if (this.flowPage > 0) { this.flowPage--; this.renderFlow(); this.saveProgress(); }
  }

  // ---------- shared chrome / progress ----------
  showChrome() {
    this.els.chrome.classList.add("visible");
    clearTimeout(this._chromeTimer);
    this._chromeTimer = setTimeout(() => this.els.chrome.classList.remove("visible"), 2200);
  }
  toggleChrome() { this.els.chrome.classList.toggle("visible"); }

  updateSliderLabel() {
    if (this.content?.kind === "paged") {
      this.els.pageLabel.textContent = `${this.index + 1} / ${this.comic.pageCount}`;
    } else {
      this.els.pageLabel.textContent = `${this.flowPage + 1} / ${this.flowPageCount}`;
    }
  }
  updateBookmarkFlag() { /* reserved for a future bookmarks feature */ }

  saveProgress() {
    if (!this.book) return;
    const progress = this.content.kind === "paged"
      ? this.index
      : (this.flowPage / Math.max(1, this.flowPageCount - 1));
    this.book.progress = progress;
    NthDB.put(this.book);
  }
};
