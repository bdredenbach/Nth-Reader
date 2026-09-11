/* Reflowable book paginator.
 * Chapters are measured separately to avoid the browser's very-large CSS
 * column ceiling. Only the visible chapter is cloned into the live page.
 */
window.EpubPageReader = class {
  constructor(host, owner) {
    this.host = host;
    this.owner = owner;
    this.pages = [];
    this.index = 0;
    this.drag = null;
    this._resizeTimer = null;
    this.host.addEventListener("pointerdown", (e) => this.onDown(e));
    this.host.addEventListener("pointermove", (e) => this.onMove(e));
    this.host.addEventListener("pointerup", (e) => this.onUp(e));
    this.host.addEventListener("pointercancel", (e) => this.onUp(e));
  }

  async open(html, progress = 0) {
    await this.prepare(html, progress);
    this.render();
  }

  async prepare(html, progress = 0) {
    this.sourceHtml = html;
    this.host.innerHTML = '<div class="epub-loading">Laying out pages…</div>';
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await this.paginate();
    this.index = Math.min(this.pages.length - 1, Math.max(0, Math.round(progress * (this.pages.length - 1))));
    this.owner.index = this.index;
  }

  dimensions() {
    const w = Math.max(240, Math.min(this.host.clientWidth - 34, 700));
    const h = Math.max(340, this.host.clientHeight - 54);
    return { pageW: w, pageH: h, contentW: w - 48, contentH: h - 66 };
  }

  async paginate() {
    const { contentW, contentH } = this.dimensions();
    this.layout = this.dimensions();
    const source = document.createElement("div");
    source.innerHTML = this.sourceHtml;
    const chapters = Array.from(source.querySelectorAll(":scope > .chapter"));
    const parts = chapters.length ? chapters : Array.from(source.children);
    if (!parts.length) parts.push(source);

    const measure = document.createElement("div");
    measure.className = "epub-measure";
    Object.assign(measure.style, {
      width: `${contentW}px`, height: `${contentH}px`, columnWidth: `${contentW}px`,
      columnGap: "0px", columnFill: "auto",
    });
    document.body.appendChild(measure);
    this.pages = [];

    for (const part of parts) {
      measure.innerHTML = part.outerHTML || part.innerHTML;
      await this.waitForImages(measure);
      const count = Math.max(1, Math.ceil((measure.scrollWidth - 1) / contentW));
      const markup = part.outerHTML || `<section class="chapter">${part.innerHTML}</section>`;
      for (let column = 0; column < count; column++) {
        this.pages.push({ markup, column, count });
      }
    }
    measure.remove();
    if (!this.pages.length) this.pages.push({ markup: this.sourceHtml, column: 0, count: 1 });
  }

  makeTurnSource(index) {
    return {
      lazy: true,
      reflow: true,
      eager: index === 0,
      render: () => this.makeTurnPage(index),
    };
  }

  makeTurnPage(index) {
    const page = this.pages[index];
    const { pageW, pageH, contentW, contentH } = this.layout || this.dimensions();
    const paper = document.createElement("article");
    paper.className = "epub-turn-paper";
    Object.assign(paper.style, { width: `${pageW}px`, height: `${pageH}px` });
    const windowEl = document.createElement("div");
    windowEl.className = "epub-page-window";
    Object.assign(windowEl.style, { width: `${contentW}px`, height: `${contentH}px` });
    const columns = document.createElement("div");
    columns.className = "epub-page-columns";
    columns.innerHTML = page.markup;
    Object.assign(columns.style, {
      width: `${contentW * page.count}px`, height: `${contentH}px`,
      columnWidth: `${contentW}px`, columnCount: String(page.count), columnGap: "0px",
      transform: `translateX(${-page.column * contentW}px)`,
    });
    windowEl.appendChild(columns);
    paper.appendChild(windowEl);
    paper.insertAdjacentHTML("beforeend", `<span class="epub-page-number">${index + 1}</span><span class="epub-corner-cue" aria-hidden="true"></span>`);
    return paper;
  }

  waitForImages(root) {
    const pending = Array.from(root.querySelectorAll("img")).filter((img) => !img.complete);
    return Promise.all(pending.map((img) => new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 1200);
    })));
  }

  render() {
    const page = this.pages[this.index];
    const { pageW, pageH, contentW, contentH } = this.dimensions();
    this.host.innerHTML = "";
    const book = document.createElement("div");
    book.className = "epub-book";
    book.style.width = `${pageW}px`;
    book.style.height = `${pageH}px`;
    book.innerHTML = '<div class="epub-fallback-book-underlay" aria-hidden="true"></div><div class="epub-sheet sheet-three"></div><div class="epub-sheet sheet-two"></div><div class="epub-sheet sheet-one"></div>';

    const paper = document.createElement("article");
    paper.className = "epub-page-paper";
    const windowEl = document.createElement("div");
    windowEl.className = "epub-page-window";
    Object.assign(windowEl.style, { width: `${contentW}px`, height: `${contentH}px` });
    const columns = document.createElement("div");
    columns.className = "epub-page-columns";
    columns.innerHTML = page.markup;
    Object.assign(columns.style, {
      width: `${contentW * page.count}px`, height: `${contentH}px`,
      columnWidth: `${contentW}px`, columnCount: String(page.count), columnGap: "0px",
      transform: `translateX(${-page.column * contentW}px)`,
    });
    windowEl.appendChild(columns);
    paper.appendChild(windowEl);
    paper.insertAdjacentHTML("beforeend", '<span class="epub-page-number"></span><span class="epub-corner-cue" aria-hidden="true"></span>');
    paper.querySelector(".epub-page-number").textContent = String(this.index + 1);
    book.appendChild(paper);
    this.host.appendChild(book);
    this.paper = paper;
    this.owner.index = this.index;
    this.owner.updateSliderLabel();
    this.owner.updateBookmarkFlag();
    this.owner.voiceReader?.onPageChanged(this.index);
  }

  next() { this.turn(1); }
  prev() { this.turn(-1); }

  turn(delta) {
    const target = this.index + delta;
    if (target < 0 || target >= this.pages.length || !this.paper) return;
    const paper = this.paper;
    paper.classList.add(delta > 0 ? "turn-away" : "turn-back");
    setTimeout(() => {
      this.index = target;
      this.owner.index = target;
      this.render();
      this.owner.saveProgress();
    }, 300);
  }

  onDown(e) {
    if (!this.paper || e.target.closest("button")) return;
    const rect = this.paper.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const direction = localX > rect.width * .55 ? 1 : localX < rect.width * .45 ? -1 : 0;
    if (!direction) { this.owner.toggleChrome(); return; }
    this.drag = { id: e.pointerId, startX: e.clientX, direction, rect };
    this.paper.setPointerCapture?.(e.pointerId);
    this.paper.classList.add("dragging");
  }

  onMove(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.startX;
    const amount = this.drag.direction > 0 ? Math.max(0, -dx) : Math.max(0, dx);
    const progress = Math.min(1, amount / (this.drag.rect.width * .65));
    const angle = this.drag.direction > 0 ? -178 * progress : 178 * progress;
    this.paper.style.transformOrigin = this.drag.direction > 0 ? "left center" : "right center";
    this.paper.style.transform = `perspective(1500px) rotateY(${angle}deg)`;
    this.paper.style.setProperty("--curl", String(progress));
  }

  onUp(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.startX;
    const amount = this.drag.direction > 0 ? -dx : dx;
    const direction = this.drag.direction;
    this.drag = null;
    this.paper.classList.remove("dragging");
    this.paper.style.cssText = "";
    if (amount > 54) this.turn(direction);
  }
};
