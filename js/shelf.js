/* Nth Reader — shelf.js
 * Home screen: a literal wooden bookshelf.
 *   - Books: double-tap to open; long-press (~350ms) to pick up, drag,
 *     and drop on any shelf to re-shelve.
 *   - Decor items (bust/globe/plant/candle/vine/lamp/mug/frame): same
 *     long-press-drag to move between shelves; tap to select in Customize
 *     mode's Decorate tab for size/position/glow controls.
 *   - Stacks: a pile of books lying flat, built from a multi-selection in
 *     Customize mode's Arrange tab (Stack Books). Drags as one unit like a
 *     book; Unstack dissolves it back into individual spines.
 */
window.Shelf = class {
  constructor(root, { onOpen }) {
    this.root = root;
    this.onOpen = onOpen;
    this.onBookMoved = null;   // (book, previous:{shelfIndex,slot}) => void — Arrange undo toast
    this.onDecorTap = null;    // (decorItem) => void — wired by customize.js
    this.onStackTap = null;    // (stack) => void — wired by customize.js
    this.decorateActive = false; // Decorate tab open: decor items become tappable/selectable
    this.stackSelectMode = false; // Arrange tab "Stack Books" active: taps toggle selection, not open/drag
    this.selectedDecorId = null;
    this.selectedStackId = null;
    this.selectedForStack = new Set();
    this.onStackSelectionChanged = null; // (Set) => void

    this.books = [];
    this.decorItems = [];
    this.stacks = [];
    this.shelfCount = 5;
    this._lastTap = { id: null, time: 0 };
    this._drag = null; // { kind: 'book'|'decor'|'stack', ... }

    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
  }

  setBooks(books) { this.books = books; this._recalcShelfCount(); this.render(); }
  setDecor(items) { this.decorItems = items; this._recalcShelfCount(); this.render(); }
  setStacks(stacks) { this.stacks = stacks; this._recalcShelfCount(); this.render(); }
  setAll(books, decorItems, stacks) {
    this.books = books; this.decorItems = decorItems; this.stacks = stacks;
    this._recalcShelfCount();
    this.render();
  }

  _recalcShelfCount() {
    const max = (arr) => arr.reduce((m, x) => Math.max(m, x.shelfIndex ?? 0), 0);
    this.shelfCount = Math.max(5, max(this.books) + 2, max(this.decorItems) + 2, max(this.stacks) + 2);
  }

  // Unstacked books only — stacked books are rendered inside their stack pile.
  byShelf(i) {
    return this.books
      .filter(b => (b.shelfIndex ?? 0) === i && !b.stackId)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  }
  decorByShelf(i) {
    return this.decorItems.filter(d => (d.shelfIndex ?? 0) === i);
  }
  stacksByShelf(i) {
    return this.stacks.filter(s => (s.shelfIndex ?? 0) === i);
  }
  booksInStack(stack) {
    return (stack.bookIds || [])
      .map(id => this.books.find(b => b.id === id))
      .filter(Boolean);
  }

  render() {
    this.root.innerHTML = "";
    for (let i = 0; i < this.shelfCount; i++) {
      const row = document.createElement("div");
      row.className = "shelf-row";
      row.dataset.shelfIndex = String(i);

      const plank = document.createElement("div");
      plank.className = "shelf-books";
      const flowItems = [
        ...this.byShelf(i).map(b => ({ kind: "book", slot: b.slot ?? 0, data: b })),
        ...this.stacksByShelf(i).map(s => ({ kind: "stack", slot: s.slot ?? 0, data: s })),
      ].sort((a, b) => a.slot - b.slot);
      flowItems.forEach(item => {
        plank.appendChild(item.kind === "book" ? this.spineEl(item.data) : this.stackEl(item.data));
      });
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

  spineEl(book) {
    const el = document.createElement("div");
    el.className = "spine";
    el.dataset.id = book.id;
    el.dataset.kind = "book";
    const hue = book.hue ?? (book.hue = hashHue(book.title));
    el.style.setProperty("--spine-hue", hue);
    el.style.width = (book.spineWidth || 34) + "px";
    el.style.height = (book.spineHeight || (150 + (hue % 40))) + "px";
    if (this.stackSelectMode && this.selectedForStack.has(book.id)) el.classList.add("selected-for-stack");

    const label = document.createElement("span");
    label.className = "spine-label";
    label.textContent = book.title;
    el.appendChild(label);

    if (book.coverThumb) {
      el.classList.add("has-cover");
      const plate = document.createElement("span");
      plate.className = "spine-cover-plate";
      plate.style.backgroundImage = `url(${book.coverThumb})`;
      el.appendChild(plate);
    }
    if (book.progress && book.progress > 0) {
      const bar = document.createElement("span");
      bar.className = "spine-progress";
      el.appendChild(bar);
    }
    return el;
  }

  stackEl(stack) {
    const el = document.createElement("div");
    el.className = "stack-pile";
    el.dataset.id = stack.id;
    el.dataset.kind = "stack";
    if (stack.id === this.selectedStackId) el.classList.add("selected");
    const size = stack.size || 1;
    const padding = stack.padding ?? 3;
    el.style.setProperty("--stack-size", size);
    el.style.setProperty("--stack-pad", padding + "px");

    const books = this.booksInStack(stack);
    books.forEach((book) => {
      const bar = document.createElement("div");
      bar.className = "stack-book-bar";
      const hue = book.hue ?? (book.hue = hashHue(book.title));
      bar.style.setProperty("--spine-hue", hue);
      if (book.coverThumb) {
        bar.classList.add("has-cover");
        bar.style.backgroundImage = `url(${book.coverThumb})`;
      }
      const label = document.createElement("span");
      label.className = "stack-book-label";
      label.textContent = book.title;
      bar.appendChild(label);
      el.appendChild(bar);
    });
    return el;
  }

  decorEl(item) {
    const el = document.createElement("div");
    el.className = "decor-item";
    el.dataset.id = item.id;
    el.dataset.kind = "decor";
    el.dataset.type = item.type;
    if (DECOR_HANGING[item.type]) el.classList.add("hanging");
    if (item.id === this.selectedDecorId) el.classList.add("selected");
    const size = item.size || 1;
    el.style.left = (item.position ?? 50) + "%";
    el.style.transform = `translateX(-50%) scale(${size})`;
    if (item.type === "candle" && item.glow) {
      el.style.setProperty("--glow", Math.min(1, item.glow / 100));
      el.classList.add("has-glow");
    }
    const art = document.createElement("div");
    art.className = "decor-art";
    art.innerHTML = (DECOR_ART[item.type] || DECOR_ART.frame)();
    el.appendChild(art);
    return el;
  }

  // ---------- selection (decor / stack) ----------
  selectDecor(id) { this.selectedDecorId = id; this.render(); }
  selectStack(id) { this.selectedStackId = id; this.render(); }

  setStackSelectMode(active) {
    this.stackSelectMode = active;
    if (!active) this.selectedForStack.clear();
    this.render();
  }
  toggleStackSelection(bookId) {
    const book = this.books.find(b => b.id === bookId);
    if (!book) return;
    if (this.selectedForStack.has(bookId)) {
      this.selectedForStack.delete(bookId);
    } else {
      if (this.selectedForStack.size > 0) {
        const firstId = this.selectedForStack.values().next().value;
        const firstBook = this.books.find(b => b.id === firstId);
        if (firstBook && firstBook.shelfIndex !== book.shelfIndex) return; // one shelf at a time
      }
      this.selectedForStack.add(bookId);
    }
    this.onStackSelectionChanged?.(this.selectedForStack);
    this.render();
  }

  // ---------- unified pointer / drag ----------
  onPointerDown(e) {
    const spineEl = e.target.closest(".spine");
    const decorEl = !spineEl && this.decorateActive ? e.target.closest(".decor-item") : null;
    const stackEl = !spineEl && !decorEl && this.decorateActive ? e.target.closest(".stack-pile") : null;
    const targetEl = spineEl || decorEl || stackEl;
    if (!targetEl) return;

    const kind = spineEl ? "book" : decorEl ? "decor" : "stack";
    const id = targetEl.dataset.id;
    const startX = e.clientX, startY = e.clientY;

    if (kind === "book" && this.stackSelectMode) {
      // In Stack Books mode, a tap toggles selection — no drag, no open.
      this._pending = { kind, id, targetEl, startX, startY, moved: false, isSelectTap: true };
      return;
    }

    let originalShelfIndex = 0, originalSlot = 0;
    if (kind === "book") {
      const b = this.books.find(x => x.id === id);
      originalShelfIndex = b?.shelfIndex ?? 0; originalSlot = b?.slot ?? 0;
    } else if (kind === "decor") {
      const d = this.decorItems.find(x => x.id === id);
      originalShelfIndex = d?.shelfIndex ?? 0;
    } else {
      const s = this.stacks.find(x => x.id === id);
      originalShelfIndex = s?.shelfIndex ?? 0; originalSlot = s?.slot ?? 0;
    }

    this._pending = {
      kind, id, targetEl, startX, startY, moved: false,
      timer: setTimeout(() => this.beginDrag(kind, id, targetEl, startX, startY), 350),
      originalShelfIndex, originalSlot,
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
      if (this._pending.isSelectTap && !this._pending.moved) {
        this.toggleStackSelection(this._pending.id);
      } else if (!this._drag && !this._pending.moved) {
        this.handleTap(this._pending.kind, this._pending.id);
      }
      this._pending = null;
    }
    if (this._drag) this.endDrag(e.clientX, e.clientY);
  }

  handleTap(kind, id) {
    if (kind === "book") {
      const now = Date.now();
      if (this._lastTap.id === id && now - this._lastTap.time < 320) {
        this._lastTap = { id: null, time: 0 };
        this.onOpen(id);
      } else {
        this._lastTap = { id, time: now };
      }
    } else if (kind === "decor") {
      const item = this.decorItems.find(d => d.id === id);
      if (item) this.onDecorTap?.(item);
    } else if (kind === "stack") {
      const stack = this.stacks.find(s => s.id === id);
      if (stack) this.onStackTap?.(stack);
    }
  }

  beginDrag(kind, id, el, x, y) {
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.className = el.className + " drag-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.left = x - (x - rect.left) + "px";
    ghost.style.top = y - (y - rect.top) + "px";
    ghost.style.transform = "";
    document.body.appendChild(ghost);
    el.classList.add("drag-lifted");
    if (navigator.vibrate) navigator.vibrate(15);
    this._drag = {
      kind, id, el, ghost, offX: x - rect.left, offY: y - rect.top,
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
    const { kind, id, el, ghost, originalShelfIndex, originalSlot } = this._drag;
    ghost.remove();
    el.classList.remove("drag-lifted");
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));

    const row = document.elementFromPoint(x, y)?.closest(".shelf-row");
    this._drag = null;
    if (!row) { this.render(); return; }
    const newShelf = Number(row.dataset.shelfIndex);

    if (kind === "decor") {
      const item = this.decorItems.find(d => d.id === id);
      if (!item) { this.render(); return; }
      const rowRect = row.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((x - rowRect.left) / rowRect.width) * 100));
      item.shelfIndex = newShelf;
      item.position = Math.round(pct);
      NthDB.decor.put(item);
      if (newShelf === this.shelfCount - 1) this.shelfCount++;
      this.render();
      return;
    }

    // book or stack — both live in the .shelf-books flex flow, ordered by "slot"
    const plank = row.querySelector(".shelf-books");
    const siblings = Array.from(plank.querySelectorAll(".spine:not(.drag-ghost), .stack-pile:not(.drag-ghost)"))
      .filter(s => s.dataset.id !== id);
    let insertAt = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) { insertAt = i; break; }
    }

    const flowItems = [
      ...this.byShelf(newShelf).map(b => ({ id: b.id, kind: "book", data: b })),
      ...this.stacksByShelf(newShelf).map(s => ({ id: s.id, kind: "stack", data: s })),
    ]
      .filter(x => x.id !== id)
      .sort((a, b) => (a.data.slot ?? 0) - (b.data.slot ?? 0));
    flowItems.splice(insertAt, 0, { id, kind, data: null });

    let record;
    if (kind === "book") record = this.books.find(b => b.id === id);
    else record = this.stacks.find(s => s.id === id);
    if (!record) { this.render(); return; }
    record.shelfIndex = newShelf;

    flowItems.forEach((entry, i) => {
      const rec = entry.id === id ? record : entry.data;
      rec.slot = i;
      if (entry.kind === "book") NthDB.put(rec); else NthDB.stacks.put(rec);
    });

    if (newShelf === this.shelfCount - 1) this.shelfCount++;
    this.render();

    if (kind === "book") {
      const moved = newShelf !== originalShelfIndex || record.slot !== originalSlot;
      if (moved) this.onBookMoved?.(record, { shelfIndex: originalShelfIndex, slot: originalSlot });
    }
  }
};

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
