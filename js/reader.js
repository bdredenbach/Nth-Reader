/* Nth Reader — reader.js
 * Exposes the minimal interface LongboxNativePageTurn (page-turn.js) expects:
 *   comic.pageCount, index, mode, scale, els.viewport, getPageUrl(i),
 *   showChrome(), updateSliderLabel(), updateBookmarkFlag(), saveProgress(), render()
 * Flow (reflowable text) books use a simpler CSS-column paginator instead,
 * since the corner-flip animation needs a fixed-size page image to grab.
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
    };
    this.nativePageTurn = new LongboxNativePageTurn(this);
    this.mode = "single";
    this.scale = 1;
    this.book = null;      // db record
    this.content = null;   // normalized {kind, ...}
    this.index = 0;
    this.flowPage = 0;
    this.flowPageCount = 1;
    this._chromeTimer = null;

    this.els.backBtn.addEventListener("click", () => this.close());
    this.els.viewport.addEventListener("click", (e) => this.onTapPaged(e));
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
      this.comic = { pageCount: content.pageCount };
      this.index = Math.min(book.progress || 0, content.pageCount - 1);
      this.els.viewport.hidden = false;
      this.els.flow.hidden = true;
      await this.render();
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

  // ---------- paged (image) mode ----------
  async render() {
    const url = await this.getPageUrl(this.index);
    this.els.viewport.innerHTML = "";
    const img = new Image();
    img.src = url;
    img.decoding = "async";
    this.els.viewport.appendChild(img);
    this.updateSliderLabel();
  }

  async getPageUrl(i) { return this.content.getPageUrl(i); }

  async goTo(i) {
    if (i < 0 || i >= this.comic.pageCount) return;
    this.index = i;
    await this.render();
    this.saveProgress();
  }

  async onTapPaged(e) {
    if (this.nativePageTurn.running) return;
    const rect = this.els.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width * 0.65) {
      const handled = await this.nativePageTurn.turn("next");
      if (!handled) await this.goTo(this.index + 1);
    } else if (x < rect.width * 0.35) {
      const handled = await this.nativePageTurn.turn("prev");
      if (!handled) await this.goTo(this.index - 1);
    } else {
      this.toggleChrome();
    }
  }

  // ---------- flow (reflowable text) mode ----------
  layoutFlow() {
    const w = this.els.flow.clientWidth;
    const h = this.els.flow.clientHeight;
    this.els.flowInner.style.columnWidth = w + "px";
    this.els.flowInner.style.columnGap = "0px";
    this.els.flowInner.style.height = h + "px";
    this.els.flowInner.style.width = w + "px";
    // Force layout, then measure total scrollable width to get column count.
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
