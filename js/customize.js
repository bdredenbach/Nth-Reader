/* Nth Reader — customize.js
 * The "make it aesthetic" layer: enter Customize mode from the shelf's
 * menu to add decor, drag decor to any shelf, resize/reposition/duplicate/
 * delete it, group books into a flat-lying stack (with book-length and
 * whole-stack position controls), change backdrop/shelf-wood style, and get an
 * undoable toast when a book gets dragged to a new spot.
 */
window.Customize = class {
  constructor(shelf, { onExit }) {
    this.shelf = shelf;
    this.onExit = onExit;
    this.active = false;
    this.tab = "arrange";
    this.selectedDecor = null;
    this.selectedStack = null;
    this.stackPickMode = false;

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
    this.els.pickerSheet.querySelectorAll(".decor-pick-preview").forEach((el) => {
      const type = el.dataset.type;
      if (DECOR_ART[type]) el.innerHTML = DECOR_ART[type]();
    });

    this.shelf.onDecorTap = (item) => {
      this.selectedDecor = item;
      this.setTab("decorate");
    };
    this.shelf.onStackTap = (stack) => {
      this.selectedStack = stack;
      this.shelf.selectStack(stack.id);
      this.renderPanel();
    };
    this.shelf.onStackSelectionChanged = () => this.renderPanel();
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
    this.shelf.selectStack(null);
    this.shelf.setStackSelectMode(false);
    this.selectedDecor = null;
    this.selectedStack = null;
    this.stackPickMode = false;
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
    if (tab !== "arrange") {
      this.selectedStack = null; this.shelf.selectStack(null);
      this.stackPickMode = false; this.shelf.setStackSelectMode(false);
    }
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

  // ---------- Arrange tab: drag, Stack Books, stack controls ----------
  renderArrangePanel() {
    if (this.selectedStack) { this.els.panel.appendChild(this.stackControlsEl(this.selectedStack)); return; }

    if (this.stackPickMode) {
      const count = this.shelf.selectedForStack.size;
      const info = document.createElement("div");
      info.className = "customize-hint";
      info.textContent = count === 0
        ? "Tap 2 or more books on one shelf to stack them flat."
        : `${count} book${count === 1 ? "" : "s"} selected.`;
      this.els.panel.appendChild(info);

      const row = document.createElement("div");
      row.className = "decor-actions";
      const stackBtn = document.createElement("button");
      stackBtn.className = "decor-action-btn decor-action-done";
      stackBtn.type = "button";
      stackBtn.textContent = `Stack Selected${count ? ` (${count})` : ""}`;
      stackBtn.disabled = count < 2;
      stackBtn.addEventListener("click", () => this.createStack());
      row.appendChild(stackBtn);
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "decor-action-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        this.stackPickMode = false;
        this.shelf.setStackSelectMode(false);
        this.renderPanel();
      });
      row.appendChild(cancelBtn);
      this.els.panel.appendChild(row);
      return;
    }

    const hint = document.createElement("div");
    hint.className = "customize-hint";
    hint.textContent = "Long-press a book, then drag it to any shelf to move it. Tap an existing stack to edit it.";
    this.els.panel.appendChild(hint);

    const stackBtn = document.createElement("button");
    stackBtn.className = "customize-add-decor-btn";
    stackBtn.type = "button";
    stackBtn.textContent = "📚 Stack Books";
    stackBtn.addEventListener("click", () => {
      this.stackPickMode = true;
      this.shelf.setStackSelectMode(true);
      this.renderPanel();
    });
    this.els.panel.appendChild(stackBtn);
  }

  stackControlsEl(stack) {
    const wrap = document.createElement("div");
    wrap.className = "decor-controls";

    const sizeRow = this.sliderRow("Book length", 80, 180, Math.round((stack.size || 1.2) * 100), (v) => {
      stack.size = v / 100;
      this.shelf.render();
      NthDB.stacks.put(stack);
    });
    wrap.appendChild(sizeRow);

    const padRow = this.sliderRow("Stack position", -40, 180, stack.offset ?? 0, (v) => {
      stack.offset = v;
      this.shelf.render();
      NthDB.stacks.put(stack);
    });
    wrap.appendChild(padRow);

    const actions = document.createElement("div");
    actions.className = "decor-actions";
    const unstackBtn = document.createElement("button");
    unstackBtn.className = "decor-action-btn decor-action-danger";
    unstackBtn.type = "button";
    unstackBtn.textContent = "Unstack";
    unstackBtn.addEventListener("click", () => this.unstack(stack));
    actions.appendChild(unstackBtn);
    const doneBtn = document.createElement("button");
    doneBtn.className = "decor-action-btn decor-action-done";
    doneBtn.type = "button";
    doneBtn.textContent = "Done";
    doneBtn.addEventListener("click", () => {
      this.selectedStack = null;
      this.shelf.selectStack(null);
      this.renderPanel();
    });
    actions.appendChild(doneBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  async createStack() {
    const ids = Array.from(this.shelf.selectedForStack);
    if (ids.length < 2) return;
    const books = ids
      .map((id) => this.shelf.books.find((b) => b.id === id))
      .filter(Boolean)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    const shelfIndex = books[0].shelfIndex ?? 0;
    const stack = {
      id: `stack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shelfIndex,
      slot: books[0].slot ?? Date.now(),
      size: 1.2,
      offset: 0,
      bookIds: books.map((b) => b.id),
      createdAt: Date.now(),
    };
    books.forEach((b, i) => { b.stackId = stack.id; b.stackOrder = i; });
    await NthDB.stacks.put(stack);
    await Promise.all(books.map((b) => NthDB.put(b)));

    this.stackPickMode = false;
    this.shelf.setStackSelectMode(false);
    this.shelf.setAll(this.shelf.books, this.shelf.decorItems, [...this.shelf.stacks, stack]);
    this.selectedStack = stack;
    this.shelf.selectStack(stack.id);
    this.renderPanel();
  }

  async unstack(stack) {
    const books = this.shelf.booksInStack(stack);
    books.forEach((b) => { delete b.stackId; delete b.stackOrder; });
    await Promise.all(books.map((b) => NthDB.put(b)));
    await NthDB.stacks.remove(stack.id);

    this.selectedStack = null;
    this.shelf.selectStack(null);
    this.shelf.setAll(this.shelf.books, this.shelf.decorItems, this.shelf.stacks.filter((s) => s.id !== stack.id));
    this.renderPanel();
  }

  // ---------- Decorate tab ----------
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
    hint.textContent = "Tap a placed item for controls, or long-press and drag it to any shelf.";
    this.els.panel.appendChild(hint);
  }

  itemControlsEl(item) {
    const wrap = document.createElement("div");
    wrap.className = "decor-controls";

    const defaults = DECOR_DEFAULTS[item.type] || { width: 72, height: 84 };
    if (!item.width) item.width = Math.round(defaults.width * (item.size || 1));
    if (!item.height) item.height = Math.round(defaults.height * (item.size || 1));

    const widthRow = this.sliderRow("Width", 36, 160, item.width, (v) => {
      item.width = v;
      this.shelf.render();
      NthDB.decor.put(item);
    });
    wrap.appendChild(widthRow);

    const heightMax = item.type === "vine" ? 300 : 180;
    const heightRow = this.sliderRow(item.type === "vine" ? "Vine length" : "Height", 40, heightMax, item.height, (v) => {
      item.height = v;
      this.shelf.render();
      NthDB.decor.put(item);
    });
    wrap.appendChild(heightRow);

    if (!DECOR_HANGING[item.type]) {
      const contact = Math.abs(item.baseline ?? defaults.baseline ?? -6);
      const contactRow = this.sliderRow("Shelf contact", 0, 18, contact, (v) => {
        item.baseline = -v;
        this.shelf.render();
        NthDB.decor.put(item);
      });
      wrap.appendChild(contactRow);
    }

    const posRow = this.sliderRow("Position", 0, 100, Math.round(item.position ?? 50), (v) => {
      item.position = v;
      this.shelf.render();
      NthDB.decor.put(item);
    });
    wrap.appendChild(posRow);

    const spacingRow = this.sliderRow("Space around object", 4, 28, item.bookSpacing ?? 9, (v) => {
      item.bookSpacing = v;
      this.shelf.render();
      NthDB.decor.put(item);
    });
    wrap.appendChild(spacingRow);

    if (item.type === "candle" || item.type === "lamp") {
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
    delBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await NthDB.decor.remove(item.id);
      const remaining = this.shelf.decorItems.filter((d) => d.id !== item.id);
      this.selectedDecor = null;
      this.shelf.selectDecor(null);
      this.shelf.setDecor(remaining);
      this.renderPanel();
    });
    actions.appendChild(delBtn);

    const doneBtn = document.createElement("button");
    doneBtn.className = "decor-action-btn decor-action-done";
    doneBtn.type = "button";
    doneBtn.textContent = "Done";
    doneBtn.addEventListener("click", () => {
      this.selectedDecor = null;
      this.shelf.selectDecor(null);
      this.renderPanel();
    });
    actions.appendChild(doneBtn);

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

  openDecorPicker() {
    this.els.pickerSheet.hidden = false;
    requestAnimationFrame(() => this.els.pickerSheet.classList.add("visible"));
  }
  closeDecorPicker() {
    this.els.pickerSheet.classList.remove("visible");
    setTimeout(() => { this.els.pickerSheet.hidden = true; }, 200);
  }

  async addDecor(type) {
    this.closeDecorPicker();
    const defaults = DECOR_DEFAULTS[type] || { width: 72, height: 84 };
    const item = {
      id: `decor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      shelfIndex: 0,
      position: 50,
      width: defaults.width,
      height: defaults.height,
      glow: (type === "candle" || type === "lamp") ? 60 : undefined,
      createdAt: Date.now(),
    };
    await NthDB.decor.put(item);
    this.shelf.setDecor([...this.shelf.decorItems, item]);
    this.selectedDecor = item;
    this.shelf.selectDecor(item.id);
    this.renderPanel();
  }

  async applyStoredStyle() {
    const backdrop = await NthDB.settings.get("backdrop", "walnut");
    const shelfTheme = await NthDB.settings.get("shelfTheme", "walnut");
    document.getElementById("shelf-root").dataset.backdrop = backdrop;
    document.getElementById("shelf-root").dataset.shelfTheme = shelfTheme;
    document.documentElement.dataset.backdrop = backdrop;
    document.documentElement.dataset.shelfTheme = shelfTheme;
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
