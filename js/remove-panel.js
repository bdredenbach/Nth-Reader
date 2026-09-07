/* Nth Reader — remove-panel.js
 * The left slide-out panel: remove books you don't want (accidental
 * duplicates, etc). Split out from the right panel so the right panel is
 * free for adding books and shelf customization.
 */
window.RemovePanel = class {
  constructor({ onRemoved }) {
    this.onRemoved = onRemoved;
    this.els = {
      openBtn: document.getElementById("remove-open-btn"),
      closeBtn: document.getElementById("remove-close-btn"),
      overlay: document.getElementById("remove-overlay"),
      panel: document.getElementById("remove-panel"),
      list: document.getElementById("remove-book-list"),
    };

    this.els.openBtn.addEventListener("click", () => this.open());
    this.els.closeBtn.addEventListener("click", () => this.close());
    this.els.overlay.addEventListener("click", () => this.close());
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
