/* Nth Reader — menu.js
 * Right-side panel: add books, add decor, remove books.
 */
window.Menu = class {
  constructor({ onAdd, onRemoved, onAddDecor }) {
    this.onAdd = onAdd;
    this.onRemoved = onRemoved;
    this.onAddDecor = onAddDecor;
    this.els = {
      openBtn: document.getElementById("menu-open-btn"),
      closeBtn: document.getElementById("menu-close-btn"),
      overlay: document.getElementById("menu-overlay"),
      panel: document.getElementById("menu-panel"),
      addBtn: document.getElementById("menu-add-btn"),
      list: document.getElementById("menu-book-list"),
    };

    this.els.openBtn.addEventListener("click", () => this.open());
    this.els.closeBtn.addEventListener("click", () => this.close());
    this.els.overlay.addEventListener("click", () => this.close());
    this.els.addBtn.addEventListener("click", () => {
      this.close();
      this.onAdd();
    });
  }

  async open() {
    await this.renderList();
    this.els.overlay.hidden = false;
    this.els.panel.hidden = false;
    requestAnimationFrame(() => {
      this.els.overlay.classList.add("visible");
      this.els.panel.classList.add("visible");
    });
  }

  close() {
    this.els.overlay.classList.remove("visible");
    this.els.panel.classList.remove("visible");
    setTimeout(() => {
      this.els.overlay.hidden = true;
      this.els.panel.hidden = true;
    }, 220);
  }

  async renderList() {
    const books = await NthDB.all();
    this.els.list.innerHTML = "";

    // Decor section
    const decorLabel = document.createElement("div");
    decorLabel.className = "menu-section-label";
    decorLabel.textContent = "Add Decor";
    this.els.list.appendChild(decorLabel);

    const grid = document.createElement("div");
    grid.className = "decor-grid";
    const types = [
      { type: "bust", label: "Bust" },
      { type: "globe", label: "Globe" },
      { type: "plant", label: "Plant" },
      { type: "candle", label: "Candle" },
      { type: "frame", label: "Frame" },
      { type: "clock", label: "Clock" },
      { type: "vase", label: "Vase" },
    ];
    types.forEach(({ type, label }) => {
      const btn = document.createElement("button");
      btn.className = "decor-pick";
      btn.type = "button";
      btn.innerHTML = (window.DECOR_SVGS && DECOR_SVGS[type]) || "";
      const span = document.createElement("span");
      span.textContent = label;
      btn.appendChild(span);
      btn.addEventListener("click", () => {
        this.onAddDecor(type);
        this.close();
      });
      grid.appendChild(btn);
    });
    this.els.list.appendChild(grid);

    // Books section
    const booksLabel = document.createElement("div");
    booksLabel.className = "menu-section-label";
    booksLabel.textContent = "Your Books";
    this.els.list.appendChild(booksLabel);

    if (!books.length) {
      const empty = document.createElement("div");
      empty.className = "menu-empty";
      empty.textContent = "No books yet.";
      this.els.list.appendChild(empty);
      return;
    }
    books
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((book) => this.els.list.appendChild(this.rowEl(book)));
  }

  rowEl(book) {
    const row = document.createElement("div");
    row.className = "menu-book-row";

    const title = document.createElement("span");
    title.className = "menu-book-title";
    title.textContent = book.title;
    row.appendChild(title);

    const removeBtn = document.createElement("button");
    removeBtn.className = "menu-remove-btn";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${book.title}`);
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const ok = confirm(`Remove "${book.title}"? This can't be undone.`);
      if (!ok) return;
      await NthDB.remove(book.id);
      await this.renderList();
      this.onRemoved();
    });
    row.appendChild(removeBtn);

    return row;
  }
};
