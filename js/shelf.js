/* Nth Reader — shelf.js
 * Home screen: a literal wooden bookshelf.
 *   - Books: double-tap to open; long-press (~350ms) to pick up, drag,
 *     and drop on any shelf to re-shelve.
 *   - Decor items (bust/globe/plant/candle): placed and controlled from
 *     Customize mode (see customize.js) — tap one there to select it.
 */
window.Shelf = class {
  constructor(root, { onOpen }) {
    this.root = root;
    this.onOpen = onOpen;
    this.onBookMoved = null;   // (book, previous:{shelfIndex,slot}) => void — wired by app.js for the Arrange undo toast
    this.onDecorTap = null;    // (decorItem) => void — wired by customize.js
    this.decorateActive = false; // when true, tapping a decor item selects it instead of being inert
    this.selectedDecorId = null;

    this.books = [];          // all book records from db
    this.decorItems = [];     // all decor records from db
    this.shelfCount = 5;      // grows as needed
    this._lastTap = { id: null, time: 0 };
    this._drag = null;        // active book-drag state

    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.root.addEventListener("click", (e) => this.onDecorClick(e));
  }

  setBooks(books) {
    this.books = books;
    this._recalcShelfCount();
    this.render();
  }

  setDecor(items) {
    this.decorItems = items;
    this._recalcShelfCount();
    this.render();
  }

  setAll(books, decorItems) {
    this.books = books;
    this.decorItems = decorItems;
    this._recalcShelfCount();
    this.render();
  }

  _recalcShelfCount() {
    const maxBookShelf = this.books.reduce((m, b) => Math.max(m, b.shelfIndex ?? 0), 0);
    const maxDecorShelf = this.decorItems.reduce((m, d) => Math.max(m, d.shelfIndex ?? 0), 0);
    this.shelfCount = Math.max(5, maxBookShelf + 2, maxDecorShelf + 2);
  }

  byShelf(i) {
    return this.books
      .filter(b => (b.shelfIndex ?? 0) === i)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  }

  decorByShelf(i) {
    return this.decorItems.filter(d => (d.shelfIndex ?? 0) === i);
  }

  render() {
    this.root.innerHTML = "";
    for (let i = 0; i < this.shelfCount; i++) {
      const row = document.createElement("div");
      row.className = "shelf-row";
      row.dataset.shelfIndex = String(i);

      const books = this.byShelf(i);
      const plank = document.createElement("div");
      plank.className = "shelf-books";
      books.forEach((b, slotPos) => plank.appendChild(this.spineEl(b, slotPos)));
      row.appendChild(plank);

      const decorLayer = document.createElement("div");
      decorLayer.className = "shelf-decor-layer";
      this.decorByShelf(i).forEach((d) => decorLayer.appendChild(this.decorEl(d)));
      row.appendChild(decorLayer);

      row.appendChild(this.woodLedge());
      this.root.appendChild(row);
    }
  }

  woodLedge() {
    const ledge = document.createElement("div");
    ledge.className = "shelf-ledge";
    return ledge;
  }

  spineEl(book, slotPos) {
    const el = document.createElement("div");
    el.className = "spine";
    el.dataset.id = book.id;
    const hue = book.hue ?? (book.hue = hashHue(book.title));
    el.style.setProperty("--spine-hue", hue);
    el.style.width = (book.spineWidth || 34) + "px";
    el.style.height = (book.spineHeight || (150 + (hue % 40))) + "px";
    if (book.coverThumb) {
      el.style.setProperty("--spine-cover", `url(${book.coverThumb})`);
      el.classList.add("has-cover");
    }
    const label = document.createElement("span");
    label.className = "spine-label";
    label.textContent = book.title;
    el.appendChild(label);
    if (book.progress && book.progress > 0) {
      const bar = document.createElement("span");
      bar.className = "spine-progress";
      el.appendChild(bar);
    }
    return el;
  }

  decorEl(item) {
    const el = document.createElement("div");
    el.className = "decor-item";
    el.dataset.id = item.id;
    if (item.id === this.selectedDecorId) el.classList.add("selected");
    const size = item.size || 1;
    el.style.left = (item.position ?? 50) + "%";
    el.style.transform = `translateX(-50%) scale(${size})`;
    if (item.type === "candle" && item.glow) {
      el.style.setProperty("--glow", Math.min(1, item.glow / 100));
      el.classList.add("has-glow");
    }
    const glyph = document.createElement("span");
    glyph.className = "decor-glyph";
    glyph.textContent = DECOR_GLYPHS[item.type] || "❔";
    el.appendChild(glyph);
    return el;
  }

  onDecorClick(e) {
    if (!this.decorateActive) return;
    const el = e.target.closest(".decor-item");
    if (!el) return;
    const item = this.decorItems.find(d => d.id === el.dataset.id);
    if (item) this.onDecorTap?.(item);
  }

  selectDecor(id) {
    this.selectedDecorId = id;
    this.render();
  }

  onPointerDown(e) {
    const spineEl = e.target.closest(".spine");
    if (!spineEl) return;
    const id = spineEl.dataset.id;
    const startX = e.clientX, startY = e.clientY;
    const book = this.books.find(b => b.id === id);

    this._pending = {
      id, spineEl, startX, startY, pointerId: e.pointerId,
      timer: setTimeout(() => this.beginDrag(id, spineEl, startX, startY, e.pointerId), 350),
      moved: false,
      originalShelfIndex: book?.shelfIndex ?? 0,
      originalSlot: book?.slot ?? 0,
    };
  }

  onPointerMove(e) {
    if (this._pending && !this._drag) {
      const dx = e.clientX - this._pending.startX, dy = e.clientY - this._pending.startY;
      if (Math.hypot(dx, dy) > 10) {
        clearTimeout(this._pending.timer);
        this._pending.moved = true;
      }
    }
    if (this._drag) {
      e.preventDefault();
      this._drag.ghost.style.left = (e.clientX - this._drag.offX) + "px";
      this._drag.ghost.style.top = (e.clientY - this._drag.offY) + "px";
      this.highlightDropTarget(e.clientX, e.clientY);
    }
  }

  onPointerUp(e) {
    if (this._pending) {
      clearTimeout(this._pending.timer);
      if (!this._drag && !this._pending.moved) this.handleTap(this._pending.id);
      this._pending = null;
    }
    if (this._drag) this.endDrag(e.clientX, e.clientY);
  }

  handleTap(id) {
    const now = Date.now();
    if (this._lastTap.id === id && now - this._lastTap.time < 320) {
      this._lastTap = { id: null, time: 0 };
      this.onOpen(id);
    } else {
      this._lastTap = { id, time: now };
    }
  }

  beginDrag(id, spineEl, x, y) {
    const rect = spineEl.getBoundingClientRect();
    const ghost = spineEl.cloneNode(true);
    ghost.className = "spine spine-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.left = x - (x - rect.left) + "px";
    ghost.style.top = y - (y - rect.top) + "px";
    document.body.appendChild(ghost);
    spineEl.classList.add("spine-lifted");
    if (navigator.vibrate) navigator.vibrate(15);
    this._drag = {
      id, spineEl, ghost, offX: x - rect.left, offY: y - rect.top,
      originalShelfIndex: this._pending?.originalShelfIndex ?? 0,
      originalSlot: this._pending?.originalSlot ?? 0,
    };
  }

  highlightDropTarget(x, y) {
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));
    const row = document.elementFromPoint(x, y)?.closest(".shelf-row");
    if (row) row.classList.add("drop-target");
  }

  endDrag(x, y) {
    const { id, spineEl, ghost, originalShelfIndex, originalSlot } = this._drag;
    ghost.remove();
    spineEl.classList.remove("spine-lifted");
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));

    const row = document.elementFromPoint(x, y)?.closest(".shelf-row");
    const book = this.books.find(b => b.id === id);
    this._drag = null;
    if (!row || !book) { this.render(); return; }

    const newShelf = Number(row.dataset.shelfIndex);
    const plank = row.querySelector(".shelf-books");
    const siblings = Array.from(plank.querySelectorAll(".spine:not(.spine-ghost)")).filter(s => s.dataset.id !== id);
    let insertAt = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) { insertAt = i; break; }
    }
    book.shelfIndex = newShelf;
    const shelfBooks = this.byShelf(newShelf).filter(b => b.id !== id);
    shelfBooks.splice(insertAt, 0, book);
    shelfBooks.forEach((b, i) => { b.slot = i; NthDB.put(b); });

    if (newShelf === this.shelfCount - 1) this.shelfCount++;
    this.render();

    const moved = newShelf !== originalShelfIndex || book.slot !== originalSlot;
    if (moved) this.onBookMoved?.(book, { shelfIndex: originalShelfIndex, slot: originalSlot });
  }
};

const DECOR_GLYPHS = { bust: "🗿", globe: "🌍", plant: "🪴", candle: "🕯️" };
window.DECOR_TYPES = Object.keys(DECOR_GLYPHS);
window.DECOR_GLYPHS = DECOR_GLYPHS;

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
