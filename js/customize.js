/* Nth Reader — customize.js
 * The "make it aesthetic" layer: enter Customize mode from the shelf's
 * menu to add decor (bust/globe/plant/candle), reposition/resize/duplicate/
 * delete them, change the backdrop and shelf-wood style, and get an
 * undoable toast when a book gets dragged to a new spot.
 */
window.Customize = class {
  constructor(shelf, { onExit }) {
    this.shelf = shelf;
    this.onExit = onExit;
    this.active = false;
    this.tab = "arrange";
    this.selectedDecor = null;

    this.els = {
      topbar: document.getElementById("customize-topbar"),
      doneBtn: document.getElementById("customize-done-btn"),
      tabbar: document.getElementById("customize-tabbar"),
      panel: document.getElementById("customize-panel"),
      pickerSheet: document.getElementById("decor-picker-sheet"),
      pickerCancel: document.getElementById("decor-picker-cancel"),
      toast: document.getElementById("nth-toast"),
    };

    this.els.doneBtn.addEventListener("click", () => this.exit());
    this.els.tabbar.addEventListener("click", (e) => {
      const btn = e.target.closest(".customize-tab");
      if (btn) this.setTab(btn.dataset.tab);
    });
    this.els.pickerCancel.addEventListener("click", () => this.closeDecorPicker());
    this.els.pickerSheet.addEventListener("click", (e) => {
      const btn = e.target.closest(".decor-pick-btn");
      if (btn) this.addDecor(btn.dataset.type);
    });

    this.shelf.onDecorTap = (item) => {
      this.selectedDecor = item;
      this.setTab("decorate");
    };
  }

  async enter() {
    this.active = true;
    this.shelf.decorateActive = true;
    document.body.classList.add("customizing");
    this.els.topbar.hidden = false;
    this.els.tabbar.hidden = false;
    this.setTab("arrange");
  }

  exit() {
    this.active = false;
    this.shelf.decorateActive = false;
    this.shelf.selectDecor(null);
    this.selectedDecor = null;
    document.body.classList.remove("customizing");
    this.els.topbar.hidden = true;
    this.els.tabbar.hidden = true;
    this.els.panel.hidden = true;
    this.closeDecorPicker();
    this.onExit?.();
  }

  setTab(tab) {
    this.tab = tab;
    if (tab !== "decorate") { this.selectedDecor = null; this.shelf.selectDecor(null); }
    this.els.tabbar.querySelectorAll(".customize-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    this.renderPanel();
  }

  renderPanel() {
    this.els.panel.hidden = false;
    this.els.panel.innerHTML = "";
    if (this.tab === "arrange") this.renderArrangePanel();
    else if (this.tab === "decorate") this.renderDecoratePanel();
    else if (this.tab === "backdrop") this.renderSwatchPanel("backdrop", BACKDROP_PRESETS);
    else if (this.tab === "shelf") this.renderSwatchPanel("shelfTheme", SHELF_PRESETS);
  }

  renderArrangePanel() {
    const hint = document.createElement("div");
    hint.className = "customize-hint";
    hint.textContent = "Long-press a book, then drag it to any shelf to move it.";
    this.els.panel.appendChild(hint);
  }

  renderDecoratePanel() {
    if (this.selectedDecor) {
      this.els.panel.appendChild(this.itemControlsEl(this.selectedDecor));
      return;
    }
    const addBtn = document.createElement("button");
    addBtn.className = "customize-add-decor-btn";
    addBtn.type = "button";
    addBtn.textContent = "+ Add Decor";
    addBtn.addEventListener("click", () => this.openDecorPicker());
    this.els.panel.appendChild(addBtn);
    const hint = document.createElement("div");
    hint.className = "customize-hint";
    hint.textContent = "Tap a placed item to resize, reposition, duplicate, or remove it.";
    this.els.panel.appendChild(hint);
  }

  itemControlsEl(item) {
    const wrap = document.createElement("div");
    wrap.className = "decor-controls";

    const sizeRow = this.sliderRow("Size", 50, 160, Math.round((item.size || 1) * 100), (v) => {
      item.size = v / 100;
      this.shelf.render();
      NthDB.decor.put(item);
    });
    wrap.appendChild(sizeRow);

    const posRow = this.sliderRow("Position", 0, 100, Math.round(item.position ?? 50), (v) => {
      item.position = v;
      this.shelf.render();
      NthDB.decor.put(item);
    });
    wrap.appendChild(posRow);

    if (item.type === "candle") {
      const glowRow = this.sliderRow("Glow", 0, 100, item.glow ?? 60, (v) => {
        item.glow = v;
        this.shelf.render();
        NthDB.decor.put(item);
      });
      wrap.appendChild(glowRow);
    }

    const actions = document.createElement("div");
    actions.className = "decor-actions";

    const dupBtn = document.createElement("button");
    dupBtn.className = "decor-action-btn";
    dupBtn.type = "button";
    dupBtn.textContent = "⧉ Duplicate";
    dupBtn.addEventListener("click", async () => {
      const copy = { ...item, id: `decor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, position: Math.min(100, (item.position ?? 50) + 8) };
      await NthDB.decor.put(copy);
      this.shelf.setDecor([...this.shelf.decorItems, copy]);
      this.selectedDecor = copy;
      this.shelf.selectDecor(copy.id);
      this.renderPanel();
    });
    actions.appendChild(dupBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "decor-action-btn decor-action-danger";
    delBtn.type = "button";
    delBtn.textContent = "🗑 Remove";
    delBtn.addEventListener("click", async () => {
      await NthDB.decor.remove(item.id);
      this.selectedDecor = null;
      this.shelf.selectDecor(null);
      this.shelf.setDecor(this.shelf.decorItems.filter((d) => d.id !== item.id));
      this.renderPanel();
    });
    actions.appendChild(delBtn);

    const doneRow = document.createElement("button");
    doneRow.className = "decor-action-btn decor-action-done";
    doneRow.type = "button";
    doneRow.textContent = "Done";
    doneRow.addEventListener("click", () => {
      this.selectedDecor = null;
      this.shelf.selectDecor(null);
      this.renderPanel();
    });
    actions.appendChild(doneRow);

    wrap.appendChild(actions);
    return wrap;
  }

  sliderRow(label, min, max, value, onChange) {
    const row = document.createElement("div");
    row.className = "slider-row";
    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "slider-value";
    valueEl.textContent = value;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener("input", () => {
      valueEl.textContent = input.value;
      onChange(Number(input.value));
    });
    const top = document.createElement("div");
    top.className = "slider-row-top";
    top.appendChild(labelEl);
    top.appendChild(valueEl);
    row.appendChild(top);
    row.appendChild(input);
    return row;
  }

  renderSwatchPanel(settingKey, presets) {
    const row = document.createElement("div");
    row.className = "swatch-row";
    presets.forEach((preset) => {
      const btn = document.createElement("button");
      btn.className = "swatch-btn";
      btn.type = "button";
      btn.style.background = preset.preview;
      btn.title = preset.label;
      btn.addEventListener("click", async () => {
        await NthDB.settings.set(settingKey, preset.id);
        this.applyStoredStyle();
      });
      row.appendChild(btn);
    });
    this.els.panel.appendChild(row);
  }

  async openDecorPicker() {
    this.els.pickerSheet.hidden = false;
    requestAnimationFrame(() => this.els.pickerSheet.classList.add("visible"));
  }
  closeDecorPicker() {
    this.els.pickerSheet.classList.remove("visible");
    setTimeout(() => { this.els.pickerSheet.hidden = true; }, 200);
  }

  async addDecor(type) {
    this.closeDecorPicker();
    const item = {
      id: `decor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      shelfIndex: 0,
      position: 50,
      size: 1,
      glow: type === "candle" ? 60 : undefined,
      createdAt: Date.now(),
    };
    await NthDB.decor.put(item);
    this.shelf.setDecor([...this.shelf.decorItems, item]);
    this.selectedDecor = item;
    this.shelf.selectDecor(item.id);
    this.renderPanel();
  }

  async reloadDecor() {
    const items = await NthDB.decor.all();
    this.shelf.setDecor(items);
  }

  async applyStoredStyle() {
    const backdrop = await NthDB.settings.get("backdrop", "walnut");
    const shelfTheme = await NthDB.settings.get("shelfTheme", "walnut");
    document.getElementById("shelf-root").dataset.backdrop = backdrop;
    document.getElementById("shelf-root").dataset.shelfTheme = shelfTheme;
  }

  showMoveToast(book, previous) {
    this.els.toast.innerHTML = "";
    const msg = document.createElement("span");
    msg.textContent = "Book moved";
    this.els.toast.appendChild(msg);
    const undoBtn = document.createElement("button");
    undoBtn.className = "toast-undo-btn";
    undoBtn.type = "button";
    undoBtn.textContent = "Undo";
    undoBtn.addEventListener("click", async () => {
      book.shelfIndex = previous.shelfIndex;
      book.slot = previous.slot;
      await NthDB.put(book);
      const books = await NthDB.all();
      this.shelf.setBooks(books);
      this.hideToast();
    });
    this.els.toast.appendChild(undoBtn);
    this.els.toast.hidden = false;
    requestAnimationFrame(() => this.els.toast.classList.add("visible"));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.hideToast(), 4000);
  }

  hideToast() {
    this.els.toast.classList.remove("visible");
    setTimeout(() => { this.els.toast.hidden = true; }, 200);
  }
};

const BACKDROP_PRESETS = [
  { id: "walnut", label: "Walnut", preview: "#2a1a10" },
  { id: "espresso", label: "Espresso", preview: "#1a1310" },
  { id: "midnight", label: "Midnight", preview: "#141824" },
  { id: "rose", label: "Rose Dusk", preview: "#2a1620" },
  { id: "forest", label: "Forest", preview: "#141f18" },
];

const SHELF_PRESETS = [
  { id: "walnut", label: "Walnut", preview: "linear-gradient(180deg,#55341c,#2a1a10)" },
  { id: "oak", label: "Light Oak", preview: "linear-gradient(180deg,#c9a06a,#8a6238)" },
  { id: "espresso", label: "Espresso", preview: "linear-gradient(180deg,#3a2a20,#171008)" },
  { id: "lacquer", label: "Black Lacquer", preview: "linear-gradient(180deg,#3a3a3f,#0c0c0e)" },
  { id: "cherry", label: "Cherry", preview: "linear-gradient(180deg,#7a2c22,#3a120d)" },
];
