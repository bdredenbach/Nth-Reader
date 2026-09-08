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
    // Open immediately. Waiting for IndexedDB before starting the transition
    // made the first tap look broken on a cold mobile launch.
    this.els.overlay.hidden = false;
    this.els.panel.hidden = false;
    this.els.list.innerHTML = '<div class="menu-empty">Loading your books…</div>';
    requestAnimationFrame(() => {
      this.els.overlay.classList.add("visible");
      this.els.panel.classList.add("visible");
    });
    try {
      await this.renderList();
    } catch (error) {
      this.els.list.innerHTML = "";
      const message = document.createElement("div");
      message.className = "menu-empty menu-error";
      message.textContent = `Couldn't load your books: ${error.message || error}`;
      this.els.list.appendChild(message);
    }
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
      const bookmarks = await NthDB.bookmarks.forBook(book.id);
      await Promise.all(bookmarks.map((bookmark) => NthDB.bookmarks.remove(bookmark.id)));
      // Keep stack records consistent when one of their books is deleted.
      const stacks = await NthDB.stacks.all();
      for (const stack of stacks.filter((s) => (s.bookIds || []).includes(book.id))) {
        stack.bookIds = stack.bookIds.filter((id) => id !== book.id);
        if (stack.bookIds.length < 2) {
          for (const remainingId of stack.bookIds) {
            const remaining = await NthDB.get(remainingId);
            if (remaining) {
              delete remaining.stackId;
              delete remaining.stackOrder;
              await NthDB.put(remaining);
            }
          }
          await NthDB.stacks.remove(stack.id);
        } else {
          await NthDB.stacks.put(stack);
        }
      }
      await this.renderList();
      window.dispatchEvent(new CustomEvent("nth:bookmarks-changed"));
      this.onRemoved();
    });
    row.appendChild(removeBtn);

    return row;
  }
};
