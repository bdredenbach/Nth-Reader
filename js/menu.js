/* Right drawer: imports, customization, current book and bookmarks. */
window.Menu = class {
  constructor({ onAdd, onScan, onCustomize, onOpenBook }) {
    this.onAdd = onAdd;
    this.onScan = onScan;
    this.onCustomize = onCustomize;
    this.onOpenBook = onOpenBook;
    this.els = {
      openBtn: document.getElementById("menu-open-btn"),
      closeBtn: document.getElementById("menu-close-btn"),
      overlay: document.getElementById("menu-overlay"),
      panel: document.getElementById("menu-panel"),
      addBtn: document.getElementById("menu-add-btn"),
      scanBtn: document.getElementById("menu-scan-btn"),
      customizeBtn: document.getElementById("menu-customize-btn"),
      current: document.getElementById("currently-reading"),
      bookmarksBtn: document.getElementById("menu-bookmarks-btn"),
      bookmarkCount: document.getElementById("menu-bookmark-count"),
      bookmarkList: document.getElementById("menu-bookmark-list"),
    };

    this.els.openBtn.addEventListener("click", () => this.open());
    this.els.closeBtn.addEventListener("click", () => this.close());
    this.els.overlay.addEventListener("click", () => this.close());
    this.els.addBtn.addEventListener("click", () => { this.close(); this.onAdd(); });
    this.els.scanBtn.addEventListener("click", () => { this.close(); this.onScan(); });
    this.els.customizeBtn.addEventListener("click", () => { this.close(); this.onCustomize(); });
    this.els.bookmarksBtn.addEventListener("click", () => {
      this.els.bookmarkList.hidden = !this.els.bookmarkList.hidden;
      this.els.bookmarksBtn.classList.toggle("expanded", !this.els.bookmarkList.hidden);
    });
    window.addEventListener("nth:bookmarks-changed", () => {
      if (!this.els.panel.hidden) this.renderReading();
    });
  }

  open() {
    this.els.overlay.hidden = false;
    this.els.panel.hidden = false;
    requestAnimationFrame(() => {
      this.els.overlay.classList.add("visible");
      this.els.panel.classList.add("visible");
    });
    this.renderReading();
  }

  close() {
    this.els.overlay.classList.remove("visible");
    this.els.panel.classList.remove("visible");
    setTimeout(() => {
      this.els.overlay.hidden = true;
      this.els.panel.hidden = true;
    }, 220);
  }

  async renderReading() {
    this.els.current.innerHTML = '<div class="menu-empty">Loading…</div>';
    try {
      const [books, bookmarks] = await Promise.all([NthDB.all(), NthDB.bookmarks.all()]);
      const byId = new Map(books.map((book) => [book.id, book]));
      const current = books.filter((book) => book.lastReadAt).sort((a, b) => b.lastReadAt - a.lastReadAt)[0];
      this.renderCurrent(current);
      const validBookmarks = bookmarks.filter((bookmark) => byId.has(bookmark.bookId)).sort((a, b) => b.createdAt - a.createdAt);
      this.els.bookmarkCount.textContent = String(validBookmarks.length);
      this.els.bookmarkList.innerHTML = "";
      if (!validBookmarks.length) {
        this.els.bookmarkList.innerHTML = '<div class="menu-empty">No bookmarked pages yet.</div>';
      } else {
        validBookmarks.forEach((bookmark) => this.els.bookmarkList.appendChild(this.bookmarkRow(bookmark, byId.get(bookmark.bookId))));
      }
    } catch (error) {
      this.els.current.innerHTML = `<div class="menu-empty menu-error">${this.escape(error.message || error)}</div>`;
    }
  }

  renderCurrent(book) {
    this.els.current.innerHTML = "";
    if (!book) {
      this.els.current.innerHTML = '<div class="menu-empty">Open a book and it will appear here.</div>';
      return;
    }
    const button = document.createElement("button");
    button.className = "current-book-card";
    button.type = "button";
    const flow = ["epub","rtf","mobi","pdb","prc","fb2","docx","odt","txt","text","log","html","htm","xhtml","md","markdown","json","xml","opf","csv","tsv"].includes(book.format);
    const progress = flow ? `${Math.round((book.progress || 0) * 100)}% read` : `Page ${(book.progress || 0) + 1}`;
    button.innerHTML = `<span class="current-book-title">${this.escape(book.title)}</span><span class="current-book-progress">${progress} · Continue ›</span>`;
    button.addEventListener("click", () => { this.close(); this.onOpenBook(book.id); });
    this.els.current.appendChild(button);
  }

  bookmarkRow(bookmark, book) {
    const row = document.createElement("div");
    row.className = "bookmark-row";
    const open = document.createElement("button");
    open.className = "bookmark-open";
    open.type = "button";
    open.innerHTML = `<span>${this.escape(book.title)}</span><small>${this.escape(bookmark.label)}</small>`;
    open.addEventListener("click", () => { this.close(); this.onOpenBook(book.id, bookmark); });
    const remove = document.createElement("button");
    remove.className = "bookmark-remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove bookmark ${bookmark.label}`);
    remove.textContent = "×";
    remove.addEventListener("click", async () => {
      await NthDB.bookmarks.remove(bookmark.id);
      window.dispatchEvent(new CustomEvent("nth:bookmarks-changed"));
    });
    row.append(open, remove);
    return row;
  }

  escape(value) {
    const span = document.createElement("span");
    span.textContent = String(value);
    return span.innerHTML;
  }
};
