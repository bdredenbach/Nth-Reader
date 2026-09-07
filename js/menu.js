/* Nth Reader — menu.js
 * The right slide-out panel: add books, and jump into Customize mode
 * (decorate the shelf, change backdrop/shelf style). Book removal lives
 * in the separate left panel (remove-panel.js).
 */
window.Menu = class {
  constructor({ onAdd, onCustomize }) {
    this.onAdd = onAdd;
    this.onCustomize = onCustomize;
    this.els = {
      openBtn: document.getElementById("menu-open-btn"),
      closeBtn: document.getElementById("menu-close-btn"),
      overlay: document.getElementById("menu-overlay"),
      panel: document.getElementById("menu-panel"),
      addBtn: document.getElementById("menu-add-btn"),
      customizeBtn: document.getElementById("menu-customize-btn"),
    };

    this.els.openBtn.addEventListener("click", () => this.open());
    this.els.closeBtn.addEventListener("click", () => this.close());
    this.els.overlay.addEventListener("click", () => this.close());
    this.els.addBtn.addEventListener("click", () => {
      this.close();
      this.onAdd();
    });
    this.els.customizeBtn.addEventListener("click", () => {
      this.close();
      this.onCustomize();
    });
  }

  open() {
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
};
