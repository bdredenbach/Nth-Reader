/* Nth Reader — shelf.js
 * Aesthetic wooden bookshelf.
 * Books: double-tap to open, long-press to drag & re-shelve.
 * Decor: long-press to drag around shelves.
 */
window.Shelf = class {
  constructor(root, { onOpen, onAdd }) {
    this.root = root;
    this.onOpen = onOpen;
    this.onAdd = onAdd;
    this.books = [];
    this.decor = [];
    this.shelfCount = 5;
    this._lastTap = { id: null, time: 0 };
    this._drag = null;
    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this._loadDecor();
  }

  async _loadDecor() {
    try {
      const raw = localStorage.getItem("nth-decor");
      this.decor = raw ? JSON.parse(raw) : this._defaultDecor();
    } catch {
      this.decor = this._defaultDecor();
    }
  }

  _defaultDecor() {
    return [
      { id: "d-bust-1", type: "bust", shelfIndex: 0, slot: 99 },
      { id: "d-globe-1", type: "globe", shelfIndex: 1, slot: 99 },
      { id: "d-plant-1", type: "plant", shelfIndex: 2, slot: 99 },
      { id: "d-candle-1", type: "candle", shelfIndex: 3, slot: 0 },
    ];
  }

  _saveDecor() {
    localStorage.setItem("nth-decor", JSON.stringify(this.decor));
  }

  setBooks(books) {
    this.books = books;
    const maxShelf = Math.max(
      books.reduce((m, b) => Math.max(m, b.shelfIndex ?? 0), 0),
      this.decor.reduce((m, d) => Math.max(m, d.shelfIndex ?? 0), 0)
    );
    this.shelfCount = Math.max(5, maxShelf + 2);
    this.render();
  }

  byShelf(i) {
    return this.books
      .filter(b => (b.shelfIndex ?? 0) === i)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  }

  decorByShelf(i) {
    return this.decor
      .filter(d => (d.shelfIndex ?? 0) === i)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  }

  render() {
    this.root.innerHTML = "";
    for (let i = 0; i < this.shelfCount; i++) {
      const row = document.createElement("div");
      row.className = "shelf-row";
      row.dataset.shelfIndex = String(i);

      const plank = document.createElement("div");
      plank.className = "shelf-books";

      const items = [
        ...this.byShelf(i).map(b => ({ kind: "book", data: b, slot: b.slot ?? 0 })),
        ...this.decorByShelf(i).map(d => ({ kind: "decor", data: d, slot: d.slot ?? 0 })),
      ].sort((a, b) => a.slot - b.slot);

      items.forEach((item) => {
        if (item.kind === "book") {
          plank.appendChild(this.spineEl(item.data));
        } else {
          plank.appendChild(this.decorEl(item.data));
        }
      });

      row.appendChild(plank);
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
    el.style.width = (book.spineWidth || 32 + (hue % 12)) + "px";
    el.style.height = (book.spineHeight || (138 + (hue % 36))) + "px";
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
    el.className = "decor";
    el.dataset.id = item.id;
    el.dataset.kind = "decor";
    el.dataset.type = item.type;
    el.innerHTML = window.DECOR_SVGS[item.type] || window.DECOR_SVGS.bust;
    return el;
  }

  addDecor(type) {
    const id = `d-${type}-${Date.now().toString(36)}`;
    const shelfIndex = 0;
    const maxSlot = Math.max(
      0,
      ...this.byShelf(shelfIndex).map(b => b.slot ?? 0),
      ...this.decorByShelf(shelfIndex).map(d => d.slot ?? 0)
    );
    this.decor.push({ id, type, shelfIndex, slot: maxSlot + 1 });
    this._saveDecor();
    this.render();
  }

  removeDecor(id) {
    this.decor = this.decor.filter(d => d.id !== id);
    this._saveDecor();
    this.render();
  }

  onPointerDown(e) {
    const target = e.target.closest(".spine, .decor");
    if (!target) return;
    const id = target.dataset.id;
    const kind = target.dataset.kind;
    const startX = e.clientX, startY = e.clientY;

    this._pending = {
      id, kind, el: target, startX, startY, pointerId: e.pointerId,
      timer: setTimeout(() => this.beginDrag(id, kind, target, startX, startY), 320),
      moved: false,
    };
  }

  onPointerMove(e) {
    if (!this._pending && !this._drag) return;
    if (this._pending) {
      const dx = e.clientX - this._pending.startX;
      const dy = e.clientY - this._pending.startY;
      if (Math.hypot(dx, dy) > 10) {
        clearTimeout(this._pending.timer);
        this._pending = null;
      }
    }
    if (this._drag) {
      const { ghost, offX, offY } = this._drag;
      ghost.style.left = (e.clientX - offX) + "px";
      ghost.style.top = (e.clientY - offY) + "px";
      this.highlightDropTarget(e.clientX, e.clientY);
    }
  }

  onPointerUp(e) {
    if (this._pending) {
      clearTimeout(this._pending.timer);
      if (!this._pending.moved) {
        if (this._pending.kind === "book") {
          this.handleTap(this._pending.id);
        }
      }
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

  beginDrag(id, kind, el, x, y) {
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.className = kind === "book" ? "spine spine-ghost" : "decor decor-ghost";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.left = (x - (x - rect.left)) + "px";
    ghost.style.top = (y - (y - rect.top)) + "px";
    document.body.appendChild(ghost);
    el.classList.add(kind === "book" ? "spine-lifted" : "decor-lifted");
    if (navigator.vibrate) navigator.vibrate(12);
    this._drag = {
      id, kind, el, ghost,
      offX: x - rect.left,
      offY: y - rect.top,
    };
  }

  highlightDropTarget(x, y) {
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));
    const row = document.elementFromPoint(x, y)?.closest(".shelf-row");
    if (row) row.classList.add("drop-target");
  }

  endDrag(x, y) {
    const { id, kind, el, ghost } = this._drag;
    ghost.remove();
    el.classList.remove("spine-lifted", "decor-lifted");
    this.root.querySelectorAll(".shelf-row.drop-target").forEach(r => r.classList.remove("drop-target"));

    const row = document.elementFromPoint(x, y)?.closest(".shelf-row");
    this._drag = null;
    if (!row) { this.render(); return; }

    const newShelf = Number(row.dataset.shelfIndex);
    const plank = row.querySelector(".shelf-books");
    const siblings = Array.from(plank.querySelectorAll(".spine, .decor"))
      .filter(s => s.dataset.id !== id);

    let insertAt = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) { insertAt = i; break; }
    }

    if (kind === "book") {
      const book = this.books.find(b => b.id === id);
      if (!book) { this.render(); return; }
      book.shelfIndex = newShelf;
      const shelfBooks = this.byShelf(newShelf).filter(b => b.id !== id);
      shelfBooks.splice(Math.min(insertAt, shelfBooks.length), 0, book);
      shelfBooks.forEach((b, i) => { b.slot = i * 2; NthDB.put(b); });
    } else {
      const item = this.decor.find(d => d.id === id);
      if (!item) { this.render(); return; }
      item.shelfIndex = newShelf;
      item.slot = insertAt * 2 + 1;
      this._saveDecor();
    }

    if (newShelf === this.shelfCount - 1) this.shelfCount++;
    this.render();
  }
};

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

window.DECOR_SVGS = {
  bust: `<svg viewBox="0 0 64 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="86" rx="18" ry="4" fill="#2a1f16"/>
    <path d="M20 78h24c2 0 3-1.5 3-3.5V68c0-2-1-3.5-3-3.5H20c-2 0-3 1.5-3 3.5v6.5c0 2 1 3.5 3 3.5z" fill="#e8dcc8"/>
    <path d="M22 64.5h20c1.5 0 2.5-1 2.5-2.5V52c0-8-5-14-12.5-14S19.5 44 19.5 52v10c0 1.5 1 2.5 2.5 2.5z" fill="#f0e6d4"/>
    <ellipse cx="32" cy="32" rx="13" ry="16" fill="#f5ebe0"/>
    <path d="M22 28c2-6 6-9 10-9s8 3 10 9" stroke="#d4c4b0" stroke-width="1.5" fill="none"/>
    <path d="M26 36c1.5 2 3.5 3 6 3s4.5-1 6-3" stroke="#c9b8a0" stroke-width="1.2" fill="none"/>
    <circle cx="27" cy="30" r="1.2" fill="#a89078"/>
    <circle cx="37" cy="30" r="1.2" fill="#a89078"/>
    <path d="M30 34h4" stroke="#c9b8a0" stroke-width="1" stroke-linecap="round"/>
  </svg>`,

  globe: `<svg viewBox="0 0 70 76" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="35" cy="70" rx="16" ry="4" fill="#2a1f16"/>
    <path d="M27 66h16l-2-8H29l-2 8z" fill="#c9a84c"/>
    <circle cx="35" cy="36" r="28" fill="#2a6b8a"/>
    <ellipse cx="35" cy="36" rx="12" ry="28" stroke="#1a4a62" stroke-width="1.5" fill="none"/>
    <path d="M7 36h56M35 8v56" stroke="#1a4a62" stroke-width="1.2"/>
    <path d="M12 22c8 4 20 4 28 0M14 50c8-3 20-3 28 0" stroke="#3a8aaa" stroke-width="1.5" fill="none"/>
  </svg>`,

  plant: `<svg viewBox="0 0 56 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="28" cy="68" rx="14" ry="3.5" fill="#2a1f16"/>
    <path d="M16 52h24c3 0 5 3 5 6v4c0 2-2 4-5 4H16c-3 0-5-2-5-4v-4c0-3 2-6 5-6z" fill="#c4783a"/>
    <path d="M18 52h20v3H18z" fill="#a86028"/>
    <path d="M28 52V28" stroke="#3a7a3a" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="20" cy="30" rx="10" ry="7" fill="#4a9a4a" transform="rotate(-25 20 30)"/>
    <ellipse cx="36" cy="28" rx="11" ry="7" fill="#5aaa5a" transform="rotate(20 36 28)"/>
    <ellipse cx="28" cy="22" rx="9" ry="6" fill="#3d8a3d"/>
    <ellipse cx="16" cy="38" rx="8" ry="5.5" fill="#4a9a4a" transform="rotate(-40 16 38)"/>
    <ellipse cx="40" cy="36" rx="8" ry="5.5" fill="#5aaa5a" transform="rotate(35 40 36)"/>
  </svg>`,

  candle: `<svg viewBox="0 0 40 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="60" rx="12" ry="3" fill="#2a1f16"/>
    <path d="M10 48h20c2 0 3 1.5 3 3.5V56c0 1.5-1 3-3 3H10c-2 0-3-1.5-3-3v-4.5c0-2 1-3.5 3-3.5z" fill="#c9a84c"/>
    <rect x="14" y="22" width="12" height="26" rx="1.5" fill="#f5e6c8"/>
    <rect x="14" y="22" width="12" height="6" fill="#e8d4a8"/>
    <path d="M20 22v-6" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="20" cy="14" rx="4" ry="6" fill="#ff9a3c"/>
    <ellipse cx="20" cy="12" rx="2.2" ry="3.5" fill="#ffd27a"/>
  </svg>`,

  frame: `<svg viewBox="0 0 56 52" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="48" height="40" rx="2" fill="#3a2a1a" stroke="#c9a84c" stroke-width="3"/>
    <rect x="10" y="10" width="36" height="28" fill="#6a8aaa"/>
    <path d="M10 32l10-10 8 8 6-6 12 12H10z" fill="#4a6a4a"/>
    <circle cx="38" cy="18" r="4" fill="#f0e0a0"/>
  </svg>`,

  clock: `<svg viewBox="0 0 48 58" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="54" rx="10" ry="2.5" fill="#2a1f16"/>
    <path d="M18 48h12l-1.5-6h-9L18 48z" fill="#c9a84c"/>
    <circle cx="24" cy="26" r="20" fill="#f5ebe0" stroke="#c9a84c" stroke-width="3"/>
    <circle cx="24" cy="26" r="2" fill="#3a2a1a"/>
    <path d="M24 26L24 14" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/>
    <path d="M24 26L32 30" stroke="#3a2a1a" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  vase: `<svg viewBox="0 0 44 66" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="22" cy="62" rx="12" ry="3" fill="#2a1f16"/>
    <path d="M14 20c-4 8-6 18-5 28 1 8 4 12 13 12s12-4 13-12c1-10-1-20-5-28" fill="#8a4a6a"/>
    <path d="M16 20h12c1 0 2-1 2-2v-4c0-2-2-4-4-4H18c-2 0-4 2-4 4v4c0 1 1 2 2 2z" fill="#a05a7a"/>
    <path d="M22 20v-6" stroke="#5a8a5a" stroke-width="2"/>
    <ellipse cx="16" cy="18" rx="5" ry="3.5" fill="#6aaa6a" transform="rotate(-30 16 18)"/>
    <ellipse cx="28" cy="17" rx="5" ry="3.5" fill="#5a9a5a" transform="rotate(25 28 17)"/>
  </svg>`,
};
