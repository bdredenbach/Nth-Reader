/* Nth Reader — shelf.js
 * Home screen: a literal wooden bookshelf.
 *   - Books: double-tap to open; long-press (340ms) to pick up, drag,
 *     and drop on any shelf to re-shelve.
 *   - Decor items (bust/globe/plant/candle/vine/lamp/mug/frame): same
 *     long-press-drag to move between shelves; tap to select in Customize
 *     mode's Decorate tab for size/position/glow controls.
 *   - Stacks: a pile of books lying flat, built from a multi-selection in
 *     Customize mode's Arrange tab (Stack Books). Drags as one unit like a
 *     book; Unstack dissolves it back into individual spines.
 *   - Face-out books: a persisted full-cover shelf display with independent
 *     width, height and horizontal-position controls.
 */
const SHELF_PICKUP_DELAY_MS = 340;
const SHELVES_PER_BOOKCASE = 5;

window.Shelf = class {
  constructor(root, { onOpen }) {
    this.root = root;
    this.onOpen = onOpen;
    this.onBookMoved = null;   // (book, previous:{shelfIndex,slot}) => void — Arrange undo toast
    this.onDecorTap = null;    // (decorItem) => void — wired by customize.js
    this.onPhotoFrameTap = null; // gallery-ready frame tap outside Customize
    this.onStackTap = null;    // (stack) => void — wired by customize.js
    this.onFaceOutTap = null;  // (book) => void — wired by customize.js
    this.onLeanTap = null;     // (book) => void — wired by customize.js
    this.decorateActive = false; // Decorate tab open: decor items become tappable/selectable
    this.stackSelectMode = false; // Arrange tab "Stack Books" active: taps toggle selection, not open/drag
    this.faceOutSelectMode = false;
    this.leanSelectMode = false;
    this.selectedDecorId = null;
    this.selectedStackId = null;
    this.selectedFaceOutId = null;
    this.selectedForStack = new Set();
    this.selectedForLean = new Set();
    this.onStackSelectionChanged = null; // (Set) => void
    this.onLeanSelectionChanged = null;

    this.books = [];
    this.decorItems = [];
    this.stacks = [];
    this.shelfCount = SHELVES_PER_BOOKCASE;
    this.bookcaseCount = 1;
    this.activeBookcase = 0;
    this.bookcaseScrollPositions = new Map();
    this.onBookcaseChanged = null;
    this.onBookcaseScrollChanged = null;
    this._lastTap = { id: null, time: 0 };
    this._drag = null; // { kind: 'book'|'faceout'|'decor'|'stack', ... }

    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this.onPointerCancel(e));
    let scrollTimer = 0;
    this.root.addEventListener("scroll", () => {
      if (this._restoringBookcaseScroll) return;
      this.bookcaseScrollPositions.set(this.activeBookcase, this.root.scrollTop);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => this.onBookcaseScrollChanged?.(this.scrollState()), 220);
    }, { passive: true });
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
    const occupied = [...this.books.filter((book) => !book.stackId), ...this.decorItems, ...this.stacks]
      .map((item) => Math.max(0, Number(item.shelfIndex) || 0));
    // Shelf indices remain global for backward compatibility. Every five
    // shelves form one cabinet, and one completely empty cabinet is always
    // retained at the end of the carousel.
    const highestCase = occupied.length
      ? Math.floor(Math.max(...occupied) / SHELVES_PER_BOOKCASE)
      : -1;
    this.bookcaseCount = Math.max(1, highestCase + 2);
    this.shelfCount = this.bookcaseCount * SHELVES_PER_BOOKCASE;
    this.activeBookcase = Math.max(0, Math.min(this.activeBookcase, this.bookcaseCount - 1));
  }

  restoreBookcaseState(activeBookcase, scrollPositions = {}) {
    this.activeBookcase = Math.max(0, Number(activeBookcase) || 0);
    this.bookcaseScrollPositions = new Map(Object.entries(scrollPositions || {})
      .map(([key, value]) => [Number(key), Math.max(0, Number(value) || 0)]));
  }

  scrollState() { return Object.fromEntries(this.bookcaseScrollPositions); }

  isBookcaseEmpty(index) {
    const start = index * SHELVES_PER_BOOKCASE;
    const end = start + SHELVES_PER_BOOKCASE;
    return ![...this.books.filter((book) => !book.stackId), ...this.decorItems, ...this.stacks]
      .some((item) => (Number(item.shelfIndex) || 0) >= start && (Number(item.shelfIndex) || 0) < end);
  }

  firstEmptyShelfInActiveBookcase() {
    const start = this.activeBookcase * SHELVES_PER_BOOKCASE;
    const occupied = new Set([...this.books.filter((book) => !book.stackId), ...this.decorItems, ...this.stacks]
      .map((item) => Math.max(0, Number(item.shelfIndex) || 0)));
    for (let shelf = start; shelf < start + SHELVES_PER_BOOKCASE; shelf++) {
      if (!occupied.has(shelf)) return shelf;
    }
    return start + SHELVES_PER_BOOKCASE;
  }

  setActiveBookcase(index, { render = true } = {}) {
    const next = Math.max(0, Math.min(Number(index) || 0, this.bookcaseCount - 1));
    this.bookcaseScrollPositions.set(this.activeBookcase, this.root.scrollTop);
    if (next === this.activeBookcase) return;
    this.activeBookcase = next;
    if (render) this.render();
    this.onBookcaseChanged?.(next, this.scrollState());
    window.dispatchEvent(new CustomEvent("nth:bookcase-changed", { detail: { index: next, count: this.bookcaseCount } }));
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
    cancelAnimationFrame(this._layoutFrame);
    this.root.innerHTML = "";
    this.renderBookcaseInto(this.root, this.activeBookcase);
    if (window.syncDecorClocks) window.syncDecorClocks();
    this._layoutFrame = requestAnimationFrame(() => {
      this.layoutRows(this.root);
      this._restoringBookcaseScroll = true;
      this.root.scrollTop = this.bookcaseScrollPositions.get(this.activeBookcase) || 0;
      requestAnimationFrame(() => { this._restoringBookcaseScroll = false; });
    });
  }

  renderBookcaseInto(container, bookcaseIndex) {
    container.innerHTML = "";
    const firstShelf = bookcaseIndex * SHELVES_PER_BOOKCASE;
    for (let i = firstShelf; i < firstShelf + SHELVES_PER_BOOKCASE; i++) {
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
        plank.appendChild(item.kind === "book" ? this.bookEl(item.data) : this.stackEl(item.data));
      });
      row.appendChild(plank);

      const decorLayer = document.createElement("div");
      decorLayer.className = "shelf-decor-layer";
      this.decorByShelf(i).forEach((d) => decorLayer.appendChild(this.decorEl(d)));
      row.appendChild(decorLayer);

      row.appendChild(this.woodLedge());
      container.appendChild(row);
    }
  }

  renderBookcasePreview(container, bookcaseIndex) {
    container.dataset.backdrop = this.root.dataset.backdrop || "walnut";
    container.dataset.shelfTheme = this.root.dataset.shelfTheme || "walnut";
    // The interactive shelf and the carousel must share one coordinate system.
    // Lay the preview out at the real shelf width while it is untransformed;
    // the carousel scales that finished composition only after packing.
    const naturalWidth = Math.max(280, this.root.clientWidth || window.innerWidth || 360);
    container.style.width = `${naturalWidth}px`;
    container.classList.add("carousel-preview-measuring");
    this.renderBookcaseInto(container, bookcaseIndex);
    this.layoutRows(container);
    const naturalHeight = Math.max(1, container.scrollHeight);
    container.classList.remove("carousel-preview-measuring");
    return { width: naturalWidth, height: naturalHeight };
  }

  // Pack books around each decoration's real width. Books remain ordered by
  // slot, but skip occupied decor intervals instead of disappearing behind it.
  layoutRows(container = this.root) {
    container.querySelectorAll(".shelf-row").forEach((row) => {
      const plank = row.querySelector(".shelf-books");
      const width = Math.max(1, plank.clientWidth);
      const plankRect = plank.getBoundingClientRect();
      const blockers = Array.from(container.querySelectorAll(".decor-item")).map((decorEl) => {
        const item = this.decorItems.find((candidate) => candidate.id === decorEl.dataset.id) || {};
        const rect = decorEl.getBoundingClientRect();
        if (rect.bottom <= plankRect.top || rect.top >= plankRect.bottom) return null;
        const spacing = item.bookSpacing ?? 9;
        return {
          start: Math.max(0, rect.left - plankRect.left - spacing),
          end: rect.right - plankRect.left + spacing,
        };
      }).filter(Boolean).sort((a, b) => a.start - b.start);

      let x = 7;
      let previousBook = null;
      const nodes = Array.from(plank.querySelectorAll(":scope > .spine, :scope > .face-out-book, :scope > .stack-pile"));
      nodes.forEach((node) => {
        const book = node.classList.contains("spine")
          ? this.books.find((candidate) => candidate.id === node.dataset.id)
          : null;
        // A rotated bounding box grows wider as the angle increases. Using it
        // for packing was what made a lean group fan apart. Pack leaned books
        // by their real, unrotated spine width instead.
        const itemWidth = book?.leaned
          ? (node.offsetWidth || parseFloat(node.style.width) || 24)
          : (node.getBoundingClientRect().width || parseFloat(node.style.width) || 24);
        const positionOffset = parseFloat(node.style.marginLeft) || 0;
        node.style.marginLeft = "0px";
        x = Math.max(0, x + positionOffset);
        const spacingBook = book?.leaned ? book : (previousBook?.leaned ? previousBook : null);
        if (spacingBook) {
          // Map the familiar -40…28 control onto a useful visual gap. At the
          // default -40, adjacent spines overlap by 6px as a compact bundle.
          const visualGap = Math.round(2 + Math.max(-40, Math.min(28, spacingBook.leanSpacing ?? -40)) * 0.2);
          x = Math.max(0, x + visualGap - 2);
        }
        let moved;
        do {
          moved = false;
          for (const blocked of blockers) {
            if (x < blocked.end && x + itemWidth > blocked.start) {
              x = blocked.end;
              moved = true;
            }
          }
        } while (moved);
        node.style.position = "absolute";
        node.style.left = `${Math.round(x)}px`;
        node.style.bottom = "1px";
        x += itemWidth + 2;
        previousBook = book;
      });
      plank.style.setProperty("--shelf-flow-end", `${Math.ceil(x + 8)}px`);
    });
  }

  bookEl(book) { return book.facedOut ? this.faceOutEl(book) : this.spineEl(book); }

  faceOutEl(book) {
    const el = document.createElement("div");
    el.className = "face-out-book";
    el.dataset.id = book.id;
    el.dataset.kind = "faceout";
    el.style.width = `${book.faceWidth || 88}px`;
    el.style.height = `${book.faceHeight || 118}px`;
    el.style.marginLeft = `${book.faceOffset ?? 0}px`;
    if (book.id === this.selectedFaceOutId) el.classList.add("selected");
    if (this.stackSelectMode && this.selectedForStack.has(book.id)) el.classList.add("selected-for-stack");
    if (this.leanSelectMode && this.selectedForLean.has(book.id)) el.classList.add("selected-for-lean");
    const coverArt = book.faceCover || book.coverThumb;
    if (coverArt) {
      const cover = document.createElement("img");
      cover.className = "face-out-cover";
      cover.src = coverArt;
      cover.alt = book.title;
      el.appendChild(cover);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "face-out-fallback";
      fallback.style.setProperty("--spine-hue", book.hue ?? (book.hue = hashHue(book.title)));
      fallback.textContent = book.title;
      el.appendChild(fallback);
    }
    return el;
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
    // Real shelves read better when the spines are slim and subtly varied.
    el.style.width = (book.spineWidth || (18 + (hue % 8))) + "px";
    el.style.height = (book.spineHeight || (104 + (hue % 27))) + "px";
    if (this.stackSelectMode && this.selectedForStack.has(book.id)) el.classList.add("selected-for-stack");
    if (this.leanSelectMode && this.selectedForLean.has(book.id)) el.classList.add("selected-for-lean");
    if (book.leaned) {
      el.classList.add("leaned-book");
      const direction = book.leanDirection === "left" ? -1 : 1;
      el.style.setProperty("--lean-angle", `${direction * (book.leanAngle ?? 8)}deg`);
      const group = this.books
        .filter((candidate) => candidate.leanGroupId === book.leanGroupId && !candidate.stackId)
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
      if (group[0]?.id === book.id) el.style.marginLeft = `${book.leanOffset ?? 0}px`;
    }

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
    const offset = stack.offset ?? 0;
    el.style.setProperty("--stack-size", size);
    el.style.marginLeft = `${offset}px`;

    const books = this.booksInStack(stack);
    books.forEach((book, i) => {
      const bar = document.createElement("div");
      bar.className = "stack-book-bar";
      bar.dataset.bookId = book.id;
      const hue = book.hue ?? (book.hue = hashHue(book.title));
      bar.style.setProperty("--spine-hue", hue);
      bar.style.setProperty("--book-length", `${96 + ((hue + i * 17) % 25)}px`);
      bar.style.setProperty("--book-shift", `${((hue + i * 11) % 9) - 4}px`);
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
    const defaults = DECOR_DEFAULTS[item.type] || { width: 72, height: 84 };
    const legacySize = item.size || 1;
    const width = item.width || Math.round(defaults.width * legacySize);
    const height = item.height || Math.round(defaults.height * legacySize);
    el.style.left = (item.position ?? 50) + "%";
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.setProperty("--decor-facing", item.facing === "left" ? -1 : 1);
    el.style.transform = "translateX(-50%) scaleX(var(--decor-facing))";
    if (DECOR_HANGING[item.type]) {
      el.style.top = `${item.topOffset ?? -2}px`;
    } else {
      el.style.bottom = `${item.baseline ?? defaults.baseline ?? -6}px`;
    }
    if ((item.type === "candle" || item.type === "lamp") && item.glow) {
      el.style.setProperty("--glow", Math.min(1, item.glow / 100));
      el.classList.add("has-glow");
    }
    const art = document.createElement("div");
    art.className = "decor-art";
    art.innerHTML = (DECOR_ART[item.type] || DECOR_ART.frame)(item);
    el.appendChild(art);
    return el;
  }

  // ---------- selection (decor / stack) ----------
  selectDecor(id) { this.selectedDecorId = id; this.render(); }
  selectStack(id) { this.selectedStackId = id; this.render(); }
  selectFaceOut(id) { this.selectedFaceOutId = id; this.render(); }

  setStackSelectMode(active) {
    this.stackSelectMode = active;
    if (!active) this.selectedForStack.clear();
    this.render();
  }
  setFaceOutSelectMode(active) {
    this.faceOutSelectMode = active;
    this.render();
  }
  setLeanSelectMode(active) {
    this.leanSelectMode = active;
    if (!active) this.selectedForLean.clear();
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
  toggleLeanSelection(bookId) {
    const book = this.books.find((candidate) => candidate.id === bookId);
    if (!book || book.stackId) return;
    if (this.selectedForLean.has(bookId)) {
      this.selectedForLean.delete(bookId);
    } else {
      if (this.selectedForLean.size) {
        const first = this.books.find((candidate) => candidate.id === this.selectedForLean.values().next().value);
        if (first && first.shelfIndex !== book.shelfIndex) return;
      }
      this.selectedForLean.add(bookId);
    }
    this.onLeanSelectionChanged?.(this.selectedForLean);
    this.render();
  }

  // ---------- unified pointer / drag ----------
  onPointerDown(e) {
    const faceOutEl = e.target.closest(".face-out-book");
    const spineEl = !faceOutEl ? e.target.closest(".spine") : null;
    const decorCandidate = !spineEl && !faceOutEl ? e.target.closest(".decor-item") : null;
    const isPhotoFrame = !!(decorCandidate && DECOR_PHOTO_FRAMES?.[decorCandidate.dataset.type]);
    const decorEl = decorCandidate && (this.decorateActive || isPhotoFrame) ? decorCandidate : null;
    // Stacks remain interactive outside Customize mode so their books open.
    const stackEl = !spineEl && !decorEl ? e.target.closest(".stack-pile") : null;
    const targetEl = faceOutEl || spineEl || decorEl || stackEl;
    if (!targetEl) return;

    const kind = faceOutEl ? "faceout" : spineEl ? "book" : decorEl ? "decor" : "stack";
    const id = targetEl.dataset.id;
    const startX = e.clientX, startY = e.clientY;
    const stackedBookId = kind === "stack" ? e.target.closest(".stack-book-bar")?.dataset.bookId : null;

    if (kind === "decor" && isPhotoFrame && !this.decorateActive) {
      this._pending = { kind, id, targetEl, startX, startY, moved: false, isPhotoFrameTap: true };
      return;
    }

    if ((kind === "book" || kind === "faceout") && this.stackSelectMode) {
      // In Stack Books mode, a tap toggles selection — no drag, no open.
      this._pending = { kind, id, targetEl, startX, startY, moved: false, isSelectTap: true };
      return;
    }
    if ((kind === "book" || kind === "faceout") && this.faceOutSelectMode) {
      this._pending = { kind, id, targetEl, startX, startY, moved: false, isFaceOutTap: true };
      return;
    }
    if ((kind === "book" || kind === "faceout") && this.leanSelectMode) {
      const book = this.books.find((candidate) => candidate.id === id);
      this._pending = {
        kind, id, targetEl, startX, startY, moved: false,
        isExistingLeanTap: !!book?.leaned,
        isLeanTap: !book?.leaned,
      };
      return;
    }

    let originalShelfIndex = 0, originalSlot = 0;
    if (kind === "book" || kind === "faceout") {
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
      pointerId: e.pointerId,
      lastY: startY,
      timer: setTimeout(() => this.beginDrag(kind, id, targetEl, startX, startY, e.pointerId), SHELF_PICKUP_DELAY_MS),
      originalShelfIndex, originalSlot, stackedBookId,
    };
  }

  onPointerMove(e) {
    if (this._pending && !this._drag) {
      const dx = e.clientX - this._pending.startX, dy = e.clientY - this._pending.startY;
      if (this._pending.isShelfScroll) {
        e.preventDefault();
        this.root.scrollTop -= e.clientY - this._pending.lastY;
        this._pending.lastY = e.clientY;
        return;
      }
      if (Math.hypot(dx, dy) > 12) {
        if (Math.abs(dy) > Math.abs(dx) * 1.12) {
          // A vertical swipe that starts on any shelf item still scrolls the
          // shelf unless the user first paused for the pickup hold.
          clearTimeout(this._pending.timer);
          this._pending.moved = true;
          this._pending.isShelfScroll = true;
          this._pending.lastY = e.clientY;
          e.preventDefault();
          return;
        } else {
          // Horizontal movement before the hold is treated as a cancelled tap;
          // a deliberate drag starts after the short hold above.
          clearTimeout(this._pending.timer);
          this._pending.moved = true;
        }
      }
    }
    if (this._drag) {
      e.preventDefault();
      this._drag.ghost.style.left = (e.clientX - this._drag.offX) + "px";
      this._drag.ghost.style.top = (e.clientY - this._drag.offY) + "px";
      this.autoScrollShelf(e.clientY);
      this.updateBookcaseEdgeDrag(e.clientX);
      this.highlightDropTarget(e.clientX, e.clientY);
    }
  }

  onPointerUp(e) {
    if (this._pending) {
      clearTimeout(this._pending.timer);
      if (this._pending.isSelectTap && !this._pending.moved) {
        this.toggleStackSelection(this._pending.id);
      } else if (this._pending.isFaceOutTap && !this._pending.moved) {
        const book = this.books.find((candidate) => candidate.id === this._pending.id);
        if (book) this.onFaceOutTap?.(book);
      } else if (this._pending.isExistingLeanTap && !this._pending.moved) {
        const book = this.books.find((candidate) => candidate.id === this._pending.id);
        if (book) this.onLeanTap?.(book);
      } else if (this._pending.isLeanTap && !this._pending.moved) {
        this.toggleLeanSelection(this._pending.id);
      } else if (this._pending.isPhotoFrameTap && !this._pending.moved) {
        const item = this.decorItems.find((candidate) => candidate.id === this._pending.id);
        if (item) this.onPhotoFrameTap?.(item);
      } else if (!this._drag && !this._pending.moved) {
        this.handleTap(this._pending.kind, this._pending.id, this._pending.stackedBookId);
      }
      this._pending = null;
    }
    if (this._drag) this.endDrag(e.clientX, e.clientY);
  }

  onPointerCancel() {
    if (this._pending) {
      clearTimeout(this._pending.timer);
      this._pending = null;
    }
    if (!this._drag) return;
    this.clearBookcaseEdgeDrag();
    this._drag.ghost.remove();
    this._drag.el.classList.remove("drag-lifted");
    this.root.querySelectorAll(".shelf-row.drop-target").forEach((row) => row.classList.remove("drop-target"));
    this._drag = null;
    this.render();
  }

  handleTap(kind, id, stackedBookId) {
    if (kind === "book" || kind === "faceout") {
      const tappedBook = this.books.find((candidate) => candidate.id === id);
      if (kind === "book" && tappedBook?.leaned && this.decorateActive) {
        this.onLeanTap?.(tappedBook);
        return;
      }
      if (kind === "faceout" && this.decorateActive) {
        const book = this.books.find((candidate) => candidate.id === id);
        if (book) this.onFaceOutTap?.(book);
        return;
      }
      const now = Date.now();
      if (this._lastTap.id === id && now - this._lastTap.time < 320) {
        this._lastTap = { id: null, time: 0 };
        this.onOpen(id);
      } else {
        this._lastTap = { id, time: now };
      }
    } else if (kind === "decor") {
      const item = this.decorItems.find(d => d.id === id);
      if (item && !this.decorateActive && DECOR_PHOTO_FRAMES?.[item.type]) this.onPhotoFrameTap?.(item);
      else if (item) this.onDecorTap?.(item);
    } else if (kind === "stack" && !this.decorateActive) {
      const stack = this.stacks.find(s => s.id === id);
      const fallbackId = this.booksInStack(stack || {}).at(-1)?.id;
      this.onOpen(stackedBookId || fallbackId);
    } else if (kind === "stack") {
      const stack = this.stacks.find(s => s.id === id);
      if (stack) this.onStackTap?.(stack);
    }
  }

  beginDrag(kind, id, el, x, y, pointerId = this._pending?.pointerId) {
    if (this._drag) return;
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.className = el.className + " drag-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.left = x - (x - rect.left) + "px";
    ghost.style.top = y - (y - rect.top) + "px";
    ghost.style.transform = "";
    document.body.appendChild(ghost);
    const edgeCue = document.createElement("div");
    edgeCue.className = "drag-bookcase-edge-cue";
    edgeCue.setAttribute("aria-live", "polite");
    document.body.appendChild(edgeCue);
    el.classList.add("drag-lifted");
    try { if (pointerId !== undefined) el.setPointerCapture(pointerId); } catch (_) { /* optional mobile capability */ }
    if (navigator.vibrate) navigator.vibrate(15);
    this._drag = {
      kind, id, el, ghost, offX: x - rect.left, offY: y - rect.top,
      originalShelfIndex: this._pending?.originalShelfIndex ?? 0,
      originalSlot: this._pending?.originalSlot ?? 0,
      pointerId, edgeCue, edgeDirection: 0, edgeTimer: 0, edgeLocked: false,
    };
  }

  updateBookcaseEdgeDrag(pointerX) {
    if (!this._drag) return;
    const rect = this.root.getBoundingClientRect();
    const edgeWidth = Math.max(34, Math.min(52, rect.width * 0.11));
    let direction = 0;
    if (pointerX <= rect.left + edgeWidth && this.activeBookcase > 0) direction = -1;
    else if (pointerX >= rect.right - edgeWidth && this.activeBookcase < this.bookcaseCount - 1) direction = 1;

    if (!direction) {
      clearTimeout(this._drag.edgeTimer);
      this._drag.edgeTimer = 0;
      this._drag.edgeDirection = 0;
      this._drag.edgeCue.className = "drag-bookcase-edge-cue";
      this._drag.edgeCue.textContent = "";
      this._drag.edgeLocked = false;
      return;
    }
    if (this._drag.edgeLocked || this._drag.edgeDirection === direction) return;

    clearTimeout(this._drag.edgeTimer);
    this._drag.edgeDirection = direction;
    this._drag.edgeCue.className = `drag-bookcase-edge-cue visible ${direction < 0 ? "left" : "right"}`;
    this._drag.edgeCue.textContent = `${direction < 0 ? "‹" : "›"} Hold for Bookcase ${this.activeBookcase + direction + 1}`;
    this._drag.edgeTimer = setTimeout(() => {
      if (!this._drag || this._drag.edgeDirection !== direction) return;
      const target = this.activeBookcase + direction;
      if (target < 0 || target >= this.bookcaseCount) return;
      this._drag.edgeLocked = true;
      this._drag.edgeTimer = 0;
      this.setActiveBookcase(target);
      this._drag.edgeCue.textContent = `Bookcase ${target + 1}`;
      this._drag.edgeCue.classList.add("arrived");
      if (navigator.vibrate) navigator.vibrate(22);
      setTimeout(() => {
        if (!this._drag) return;
        this._drag.edgeCue.className = "drag-bookcase-edge-cue";
        this._drag.edgeCue.textContent = "";
      }, 420);
    }, 560);
  }

  clearBookcaseEdgeDrag() {
    if (!this._drag) return;
    clearTimeout(this._drag.edgeTimer);
    this._drag.edgeCue?.remove();
  }

  autoScrollShelf(pointerY) {
    const rootRect = this.root.getBoundingClientRect();
    const panel = document.getElementById("customize-panel");
    const panelTop = panel && !panel.hidden ? panel.getBoundingClientRect().top : rootRect.bottom;
    const visibleBottom = Math.min(rootRect.bottom, panelTop);
    const edge = Math.min(72, Math.max(42, (visibleBottom - rootRect.top) * 0.18));
    if (pointerY < rootRect.top + edge) {
      this.root.scrollTop -= Math.ceil((rootRect.top + edge - pointerY) / 7);
    } else if (pointerY > visibleBottom - edge && pointerY < visibleBottom + 24) {
      this.root.scrollTop += Math.ceil((pointerY - (visibleBottom - edge)) / 7);
    }
  }

  highlightDropTarget(x, y) {
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));
    const row = this.dropRowAt(x, y);
    if (row) row.classList.add("drop-target");
  }

  dropRowAt(x, y) {
    const rows = Array.from(this.root.querySelectorAll(".shelf-row"));
    if (!rows.length) return null;
    const rootRect = this.root.getBoundingClientRect();
    // Keep accidental releases outside the bookcase from moving anything,
    // but forgive a small miss along the side rails and shelf boundaries.
    if (x < rootRect.left - 18 || x > rootRect.right + 18 || y < rootRect.top - 12 || y > rootRect.bottom + 28) {
      return null;
    }

    // Each shelf owns its whole open compartment, from the underside of the
    // shelf above through its wooden ledge. This is independent of whatever
    // element happens to be beneath the finger (book, decor, backdrop, etc.).
    let nearest = null;
    let nearestDistance = Infinity;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) return row;
      const distance = y < rect.top ? rect.top - y : y - rect.bottom;
      if (distance < nearestDistance) {
        nearest = row;
        nearestDistance = distance;
      }
    }
    return nearestDistance <= 30 ? nearest : null;
  }

  endDrag(x, y) {
    const { kind, id, el, ghost, originalShelfIndex, originalSlot } = this._drag;
    this.clearBookcaseEdgeDrag();
    try { if (this._drag.pointerId !== undefined) el.releasePointerCapture(this._drag.pointerId); } catch (_) { /* already released */ }
    ghost.remove();
    el.classList.remove("drag-lifted");
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));

    const row = this.dropRowAt(x, y);
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
      this._recalcShelfCount();
      this.render();
      return;
    }

    // book or stack — both live in the .shelf-books flex flow, ordered by "slot"
    const plank = row.querySelector(".shelf-books");
    const siblings = Array.from(plank.querySelectorAll(".spine:not(.drag-ghost), .face-out-book:not(.drag-ghost), .stack-pile:not(.drag-ghost)"))
      .filter(s => s.dataset.id !== id);
    let insertAt = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) { insertAt = i; break; }
    }

    const flowKind = kind === "stack" ? "stack" : "book";
    const flowItems = [
      ...this.byShelf(newShelf).map(b => ({ id: b.id, kind: "book", data: b })),
      ...this.stacksByShelf(newShelf).map(s => ({ id: s.id, kind: "stack", data: s })),
    ]
      .filter(x => x.id !== id)
      .sort((a, b) => (a.data.slot ?? 0) - (b.data.slot ?? 0));
    flowItems.splice(insertAt, 0, { id, kind: flowKind, data: null });

    let record;
    if (flowKind === "book") record = this.books.find(b => b.id === id);
    else record = this.stacks.find(s => s.id === id);
    if (!record) { this.render(); return; }
    record.shelfIndex = newShelf;
    if (flowKind === "book" && record.leaned && newShelf !== originalShelfIndex) {
      delete record.leaned;
      delete record.leanGroupId;
      delete record.leanAngle;
      delete record.leanDirection;
      delete record.leanOffset;
      delete record.leanSpacing;
    }
    const changedBooks = new Map();
    const changedStacks = new Map();
    if (flowKind === "stack") {
      this.booksInStack(record).forEach((book) => {
        book.shelfIndex = newShelf;
        changedBooks.set(book.id, book);
      });
    }

    flowItems.forEach((entry, i) => {
      const rec = entry.id === id ? record : entry.data;
      rec.slot = i;
      if (entry.kind === "book") changedBooks.set(rec.id, rec);
      else changedStacks.set(rec.id, rec);
    });
    NthDB.saveArrangement({ books: [...changedBooks.values()], stacksToPut: [...changedStacks.values()] });

    this._recalcShelfCount();
    this.render();

    if (flowKind === "book") {
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
