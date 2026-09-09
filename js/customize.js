/* Nth Reader — customize.js
 * The "make it aesthetic" layer: enter Customize mode from the shelf's
 * menu to add decor, drag decor to any shelf, resize/reposition/flip/
 * delete it, face books out, group books into a flat-lying stack (with book-length and
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
    this.selectedFaceOut = null;
    this.selectedLeanBooks = null;
    this.stackPickMode = false;
    this.faceOutPickMode = false;
    this.leanPickMode = false;

    this.els = {
      topbar: document.getElementById("customize-topbar"),
      doneBtn: document.getElementById("customize-done-btn"),
      tabbar: document.getElementById("customize-tabbar"),
      panel: document.getElementById("customize-panel"),
      pickerSheet: document.getElementById("decor-picker-sheet"),
      pickerCancel: document.getElementById("decor-picker-cancel"),
      pickerSearch: document.getElementById("decor-picker-search"),
      pickerTabs: document.getElementById("decor-category-tabs"),
      photoInput: document.getElementById("decor-photo-input"),
      toast: document.getElementById("nth-toast"),
    };

    this.els.doneBtn.addEventListener("click", () => this.exit());
    this.els.tabbar.addEventListener("click", (e) => {
      const btn = e.target.closest(".customize-tab");
      if (btn) this.setTab(btn.dataset.tab);
    });
    this.els.pickerCancel.addEventListener("click", () => this.closeDecorPicker());
    this.decorCategory = "all";
    this.buildDecorPicker();
    this.els.pickerSheet.addEventListener("click", (e) => {
      const btn = e.target.closest(".decor-pick-btn");
      if (btn) this.addDecor(btn.dataset.type);
    });
    this.els.pickerSearch.addEventListener("input", () => this.filterDecorPicker());
    this.els.photoInput.addEventListener("change", () => this.finishPhotoChoice());
    if (window.ResizeObserver) {
      this._panelObserver = new ResizeObserver(() => this.updateShelfPanelSpace());
      this._panelObserver.observe(this.els.panel);
    }

    this.shelf.onDecorTap = (item) => {
      this.selectedDecor = item;
      this.setTab("decorate");
    };
    this.shelf.onPhotoFrameTap = (item) => this.choosePhoto(item);
    this.shelf.onStackTap = (stack) => {
      if (!this.active) return;
      if (this.tab !== "arrange") this.setTab("arrange");
      this.stackPickMode = false;
      this.faceOutPickMode = false;
      this.leanPickMode = false;
      this.shelf.setStackSelectMode(false);
      this.shelf.setFaceOutSelectMode(false);
      this.shelf.setLeanSelectMode(false);
      this.selectedFaceOut = null;
      this.selectedLeanBooks = null;
      this.shelf.selectFaceOut(null);
      this.selectedStack = stack;
      this.shelf.selectStack(stack.id);
      this.renderPanel();
    };
    this.shelf.onFaceOutTap = (book) => this.selectFaceOut(book);
    this.shelf.onLeanTap = (book) => this.openLeanGroup(book);
    this.shelf.onStackSelectionChanged = () => this.renderPanel();
    this.shelf.onLeanSelectionChanged = () => this.renderPanel();
  }

  buildDecorPicker() {
    const grid = this.els.pickerSheet.querySelector(".decor-picker-grid");
    grid.replaceChildren();
    this.els.pickerTabs.replaceChildren();
    [{ id: "all", label: "All" }, ...DECOR_CATEGORIES].forEach((category) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "decor-category-tab";
      tab.dataset.category = category.id;
      tab.textContent = category.label;
      tab.addEventListener("click", () => {
        this.decorCategory = category.id;
        this.filterDecorPicker();
      });
      this.els.pickerTabs.appendChild(tab);
    });
    DECOR_CATEGORIES.forEach((category) => {
      const section = document.createElement("section");
      section.className = "decor-category";
      section.dataset.category = category.id;
      const heading = document.createElement("h3");
      heading.textContent = `${category.label} · ${category.types.length}`;
      const items = document.createElement("div");
      items.className = "decor-category-grid";
      category.types.forEach((type) => {
        const button = document.createElement("button");
        button.className = "decor-pick-btn";
        button.type = "button";
        button.dataset.type = type;
        button.dataset.label = (DECOR_LABELS[type] || type).toLowerCase();
        const preview = document.createElement("span");
        preview.className = "decor-pick-preview";
        preview.dataset.type = type;
        preview.innerHTML = DECOR_ART[type]?.() || "";
        const label = document.createElement("span");
        label.className = "decor-pick-label";
        label.textContent = DECOR_LABELS[type] || type;
        button.append(preview, label);
        items.appendChild(button);
      });
      section.append(heading, items);
      grid.appendChild(section);
    });
    this.filterDecorPicker();
  }

  filterDecorPicker() {
    const query = this.els.pickerSearch.value.trim().toLowerCase();
    this.els.pickerTabs.querySelectorAll(".decor-category-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.category === this.decorCategory);
    });
    this.els.pickerSheet.querySelectorAll(".decor-category").forEach((section) => {
      let visible = 0;
      section.querySelectorAll(".decor-pick-btn").forEach((button) => {
        const matchesCategory = this.decorCategory === "all" || section.dataset.category === this.decorCategory;
        const matchesQuery = !query || button.dataset.label.includes(query);
        button.hidden = !(matchesCategory && matchesQuery);
        if (!button.hidden) visible += 1;
      });
      section.hidden = visible === 0;
    });
  }

  choosePhoto(item) {
    if (!item || !DECOR_PHOTO_FRAMES[item.type]) return;
    this.pendingPhotoDecorId = item.id;
    this.els.photoInput.value = "";
    this.els.photoInput.click();
  }

  async finishPhotoChoice() {
    const file = this.els.photoInput.files?.[0];
    const id = this.pendingPhotoDecorId;
    this.pendingPhotoDecorId = null;
    if (!file || !id) return;
    const item = this.shelf.decorItems.find((decor) => decor.id === id);
    if (!item) return;
    try {
      item.photoData = await this.compactPhoto(file);
      await NthDB.decor.put(item);
      this.shelf.render();
      if (this.active && this.selectedDecor?.id === id) this.renderPanel();
    } catch (error) {
      console.error("Could not add frame photo", error);
      this.showSimpleToast("That photo could not be opened");
    }
  }

  compactPhoto(file) {
    return new Promise((resolve, reject) => {
      const source = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const max = 1000;
        const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(source);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("Image decode failed")); };
      image.src = source;
    });
  }

  showSimpleToast(message) {
    this.els.toast.textContent = message;
    this.els.toast.hidden = false;
    requestAnimationFrame(() => this.els.toast.classList.add("visible"));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.hideToast(), 3500);
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
    this.shelf.selectFaceOut(null);
    this.shelf.setStackSelectMode(false);
    this.shelf.setFaceOutSelectMode(false);
    this.shelf.setLeanSelectMode(false);
    this.selectedDecor = null;
    this.selectedStack = null;
    this.selectedFaceOut = null;
    this.selectedLeanBooks = null;
    this.stackPickMode = false;
    this.faceOutPickMode = false;
    this.leanPickMode = false;
    document.body.classList.remove("customizing");
    this.els.topbar.hidden = true;
    this.els.tabbar.hidden = true;
        this.els.panel.hidden = true;
    document.documentElement.style.removeProperty("--customize-panel-height");
    this.closeDecorPicker();
    this.onExit?.();
  }

  setTab(tab) {
    this.tab = tab;
    if (tab !== "decorate") { this.selectedDecor = null; this.shelf.selectDecor(null); }
    if (tab !== "arrange") {
      this.selectedStack = null; this.shelf.selectStack(null);
      this.stackPickMode = false; this.shelf.setStackSelectMode(false);
      this.selectedFaceOut = null; this.shelf.selectFaceOut(null);
      this.faceOutPickMode = false; this.shelf.setFaceOutSelectMode(false);
      this.selectedLeanBooks = null;
      this.leanPickMode = false; this.shelf.setLeanSelectMode(false);
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
    requestAnimationFrame(() => {
      this.updateShelfPanelSpace();
      this.focusWorkingShelf("smooth");
    });
  }

  updateShelfPanelSpace() {
    if (!this.active || this.els.panel.hidden) return;
    const height = Math.ceil(this.els.panel.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty("--customize-panel-height", `${height}px`);
  }

  workingShelfIndex() {
    if (this.selectedDecor) return this.selectedDecor.shelfIndex ?? 0;
    if (this.selectedStack) return this.selectedStack.shelfIndex ?? 0;
    if (this.selectedFaceOut) return this.selectedFaceOut.shelfIndex ?? 0;
    if (this.selectedLeanBooks?.length) return this.selectedLeanBooks[0].shelfIndex ?? 0;
    return null;
  }

  focusWorkingShelf(behavior = "auto") {
    if (!this.active || this.els.panel.hidden) return;
    const shelfIndex = this.workingShelfIndex();
    if (shelfIndex === null) return;
    const row = this.shelf.root.querySelector(`.shelf-row[data-shelf-index="${shelfIndex}"]`);
    if (!row) return;

    const panelTop = this.els.panel.getBoundingClientRect().top;
    const rootRect = this.shelf.root.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    // Put the working shelf's ledge just above the controls. Bottom padding on
    // the scroll area leaves enough travel even for the final occupied shelf.
    const desiredBottom = Math.min(panelTop, rootRect.bottom) - 8;
    const delta = rowRect.bottom - desiredBottom;
    if (Math.abs(delta) < 3) return;
    const maxScroll = Math.max(0, this.shelf.root.scrollHeight - this.shelf.root.clientHeight);
    const top = Math.max(0, Math.min(maxScroll, this.shelf.root.scrollTop + delta));
    this.shelf.root.scrollTo({ top, behavior });
  }

  // ---------- Arrange tab: drag, Stack Books, stack controls ----------
  renderArrangePanel() {
    if (this.selectedStack) { this.els.panel.appendChild(this.stackControlsEl(this.selectedStack)); return; }
    if (this.selectedFaceOut) { this.els.panel.appendChild(this.faceOutControlsEl(this.selectedFaceOut)); return; }
    if (this.selectedLeanBooks?.length) { this.els.panel.appendChild(this.leanControlsEl(this.selectedLeanBooks)); return; }

    if (this.leanPickMode) {
      const count = this.shelf.selectedForLean.size;
      const info = document.createElement("div");
      info.className = "customize-hint";
      info.textContent = count ? `${count} book${count === 1 ? "" : "s"} selected to lean.` : "Tap one or more books on the same shelf.";
      this.els.panel.appendChild(info);
      const row = document.createElement("div");
      row.className = "decor-actions";
      const apply = document.createElement("button");
      apply.className = "decor-action-btn decor-action-done";
      apply.type = "button";
      apply.textContent = `Lean Selected${count ? ` (${count})` : ""}`;
      apply.disabled = count < 1;
      apply.addEventListener("click", () => this.createLean());
      row.appendChild(apply);
      const cancel = document.createElement("button");
      cancel.className = "decor-action-btn";
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        this.leanPickMode = false;
        this.shelf.setLeanSelectMode(false);
        this.renderPanel();
      });
      row.appendChild(cancel);
      this.els.panel.appendChild(row);
      return;
    }

    if (this.faceOutPickMode) {
      const info = document.createElement("div");
      info.className = "customize-hint face-out-pick-hint";
      info.textContent = "Faced-Out selected: tap one book to display its full cover.";
      this.els.panel.appendChild(info);
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "decor-action-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        this.faceOutPickMode = false;
        this.shelf.setFaceOutSelectMode(false);
        this.renderPanel();
      });
      this.els.panel.appendChild(cancelBtn);
      return;
    }

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
    hint.textContent = "Long-press a book to move it. Tap an existing stack, leaning book, or face-out cover to edit it.";
    this.els.panel.appendChild(hint);

    const buttonRow = document.createElement("div");
    buttonRow.className = "arrange-mode-actions";
    const stackBtn = document.createElement("button");
    stackBtn.className = "customize-add-decor-btn";
    stackBtn.type = "button";
    stackBtn.textContent = "📚 Stack Books";
    stackBtn.addEventListener("click", () => {
      this.stackPickMode = true;
      this.faceOutPickMode = false;
      this.leanPickMode = false;
      this.shelf.setStackSelectMode(true);
      this.shelf.setFaceOutSelectMode(false);
      this.shelf.setLeanSelectMode(false);
      this.renderPanel();
    });
    buttonRow.appendChild(stackBtn);

    const leanBtn = document.createElement("button");
    leanBtn.className = "customize-add-decor-btn";
    leanBtn.type = "button";
    leanBtn.textContent = "📐 Lean";
    leanBtn.addEventListener("click", () => {
      this.leanPickMode = true;
      this.stackPickMode = false;
      this.faceOutPickMode = false;
      this.shelf.setStackSelectMode(false);
      this.shelf.setFaceOutSelectMode(false);
      this.shelf.setLeanSelectMode(true);
      this.renderPanel();
    });
    buttonRow.appendChild(leanBtn);

    const faceOutBtn = document.createElement("button");
    faceOutBtn.className = "customize-add-decor-btn";
    faceOutBtn.type = "button";
    faceOutBtn.textContent = "🖼 Face-Out";
    faceOutBtn.addEventListener("click", () => {
      this.faceOutPickMode = true;
      this.stackPickMode = false;
      this.leanPickMode = false;
      this.shelf.setStackSelectMode(false);
      this.shelf.setFaceOutSelectMode(true);
      this.shelf.setLeanSelectMode(false);
      this.renderPanel();
    });
    buttonRow.appendChild(faceOutBtn);
    this.els.panel.appendChild(buttonRow);
  }

  async createLean() {
    const books = [...this.shelf.selectedForLean]
      .map((id) => this.shelf.books.find((book) => book.id === id))
      .filter(Boolean)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    if (!books.length) return;
    const groupId = `lean-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    books.forEach((book) => {
      book.facedOut = false;
      book.leaned = true;
      book.leanGroupId = groupId;
      book.leanAngle = 8;
      book.leanDirection = "right";
      book.leanOffset = 0;
      book.leanSpacing = -40;
    });
    await NthDB.saveArrangement({ books });
    this.leanPickMode = false;
    this.shelf.setLeanSelectMode(false);
    this.selectedLeanBooks = books;
    this.shelf.render();
    this.renderPanel();
  }

  openLeanGroup(book) {
    if (!this.active) return;
    if (this.tab !== "arrange") this.setTab("arrange");
    this.stackPickMode = false;
    this.faceOutPickMode = false;
    this.leanPickMode = false;
    this.shelf.setStackSelectMode(false);
    this.shelf.setFaceOutSelectMode(false);
    this.shelf.setLeanSelectMode(false);
    this.selectedStack = null;
    this.selectedFaceOut = null;
    this.shelf.selectStack(null);
    this.shelf.selectFaceOut(null);
    this.selectedLeanBooks = this.shelf.books
      .filter((candidate) => candidate.leanGroupId === book.leanGroupId)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    this.renderPanel();
  }

  leanControlsEl(books) {
    const wrap = document.createElement("div");
    wrap.className = "decor-controls lean-controls";
    const heading = document.createElement("div");
    heading.className = "customize-selection-title";
    heading.textContent = `${books.length} Leaning selected`;
    wrap.appendChild(heading);
    const first = books[0];
    const saveAll = () => NthDB.saveArrangement({ books });
    wrap.appendChild(this.sliderRow("Angle", 1, 18, first.leanAngle ?? 8, (value) => {
      books.forEach((book) => { book.leanAngle = value; }); this.shelf.render(); saveAll();
    }));
    wrap.appendChild(this.sliderRow("Position", -50, 180, first.leanOffset ?? 0, (value) => {
      books.forEach((book) => { book.leanOffset = value; }); this.shelf.render(); saveAll();
    }));
    wrap.appendChild(this.sliderRow("Space around objects", -40, 28, first.leanSpacing ?? -40, (value) => {
      books.forEach((book) => { book.leanSpacing = value; }); this.shelf.render(); saveAll();
    }));
    const actions = document.createElement("div");
    actions.className = "decor-actions";
    const direction = document.createElement("button");
    direction.className = "decor-action-btn";
    direction.type = "button";
    direction.textContent = first.leanDirection === "left" ? "Lean Right" : "Lean Left";
    direction.addEventListener("click", async () => {
      const next = first.leanDirection === "left" ? "right" : "left";
      books.forEach((book) => { book.leanDirection = next; });
      await saveAll(); this.shelf.render(); this.renderPanel();
    });
    actions.appendChild(direction);
    const stand = document.createElement("button");
    stand.className = "decor-action-btn decor-action-danger";
    stand.type = "button";
    stand.textContent = "Stand Up";
    stand.addEventListener("click", async () => {
      books.forEach((book) => {
        delete book.leaned; delete book.leanGroupId; delete book.leanAngle;
        delete book.leanDirection; delete book.leanOffset; delete book.leanSpacing;
      });
      await saveAll(); this.selectedLeanBooks = null; this.shelf.render(); this.renderPanel();
    });
    actions.appendChild(stand);
    const done = document.createElement("button");
    done.className = "decor-action-btn decor-action-done";
    done.type = "button";
    done.textContent = "Done";
    done.addEventListener("click", () => { this.selectedLeanBooks = null; this.renderPanel(); });
    actions.appendChild(done);
    wrap.appendChild(actions);
    return wrap;
  }

  async selectFaceOut(book) {
    if (!this.active) return;
    if (this.tab !== "arrange") this.setTab("arrange");
    this.stackPickMode = false;
    this.faceOutPickMode = false;
    this.leanPickMode = false;
    this.shelf.setStackSelectMode(false);
    this.shelf.setFaceOutSelectMode(false);
    this.shelf.setLeanSelectMode(false);
    this.selectedStack = null;
    this.selectedLeanBooks = null;
    this.shelf.selectStack(null);
    if (book.facedOut) {
      this.selectedFaceOut = book;
      this.shelf.selectFaceOut(book.id);
      this.renderPanel();
      return;
    }
    delete book.leaned;
    delete book.leanGroupId;
    delete book.leanAngle;
    delete book.leanDirection;
    delete book.leanOffset;
    delete book.leanSpacing;
    book.facedOut = true;
    book.faceWidth ||= 88;
    book.faceHeight ||= 118;
    book.faceOffset ??= 0;
    if (!book.faceCover) {
      let content = null;
      try {
        const sourceFile = book.file || await NthDB.getFile(book.id);
        if (!sourceFile) throw new Error("Saved source file is missing.");
        const readableFile = sourceFile.name
          ? sourceFile
          : new File([sourceFile], book.fileName || `${book.title}.${book.format}`, { type: book.fileType || sourceFile.type });
        content = await NthFormats.load(readableFile);
        if (content.coverUrl) book.faceCover = await this.makeFaceCover(await content.coverUrl());
      } catch (_) { /* the existing thumbnail/fallback title remains usable */ }
      finally { await content?.dispose?.(); }
    }
    await NthDB.put(book);
    this.faceOutPickMode = false;
    this.shelf.setFaceOutSelectMode(false);
    this.selectedFaceOut = book;
    this.shelf.selectFaceOut(book.id);
    this.renderPanel();
  }

  makeFaceCover(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const width = 260;
        const height = Math.max(1, Math.round((image.naturalHeight / Math.max(1, image.naturalWidth)) * width));
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", .84));
      };
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  faceOutControlsEl(book) {
    const wrap = document.createElement("div");
    wrap.className = "decor-controls face-out-controls";
    const heading = document.createElement("div");
    heading.className = "customize-selection-title";
    heading.textContent = "Faced-Out selected";
    wrap.appendChild(heading);

    wrap.appendChild(this.sliderRow("Length", 58, 170, book.faceWidth || 88, (value) => {
      book.faceWidth = value; this.shelf.render(); NthDB.put(book);
    }));
    wrap.appendChild(this.sliderRow("Height", 76, 180, book.faceHeight || 118, (value) => {
      book.faceHeight = value; this.shelf.render(); NthDB.put(book);
    }));
    wrap.appendChild(this.sliderRow("Position", -50, 180, book.faceOffset ?? 0, (value) => {
      book.faceOffset = value; this.shelf.render(); NthDB.put(book);
    }));

    const actions = document.createElement("div");
    actions.className = "decor-actions";
    const cancel = document.createElement("button");
    cancel.className = "decor-action-btn decor-action-danger";
    cancel.type = "button";
    cancel.textContent = "Cancel Face-Out";
    cancel.addEventListener("click", async () => {
      book.facedOut = false;
      await NthDB.put(book);
      this.selectedFaceOut = null;
      this.shelf.selectFaceOut(null);
      this.renderPanel();
    });
    actions.appendChild(cancel);
    const done = document.createElement("button");
    done.className = "decor-action-btn decor-action-done";
    done.type = "button";
    done.textContent = "Done";
    done.addEventListener("click", () => {
      this.selectedFaceOut = null;
      this.shelf.selectFaceOut(null);
      this.renderPanel();
    });
    actions.appendChild(done);
    wrap.appendChild(actions);
    return wrap;
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
    books.forEach((b, i) => {
      b.stackId = stack.id; b.stackOrder = i;
      delete b.leaned; delete b.leanGroupId; delete b.leanAngle;
      delete b.leanDirection; delete b.leanOffset; delete b.leanSpacing;
    });
    await NthDB.saveArrangement({ books, stacksToPut: [stack] });

    this.stackPickMode = false;
    this.shelf.setStackSelectMode(false);
    this.shelf.setAll(this.shelf.books, this.shelf.decorItems, [...this.shelf.stacks, stack]);
    this.selectedStack = stack;
    this.shelf.selectStack(stack.id);
    this.renderPanel();
  }

  async unstack(stack) {
    const books = this.shelf.booksInStack(stack);
    books.forEach((b) => {
      delete b.stackId; delete b.stackOrder;
      b.shelfIndex = stack.shelfIndex ?? b.shelfIndex ?? 0;
    });
    await NthDB.saveArrangement({ books, stackIdsToRemove: [stack.id] });

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

    if (!DECOR_HANGING[item.type] || item.type === "vine") {
      const contact = item.type === "vine"
        ? Math.abs(item.topOffset ?? defaults.topOffset ?? -2)
        : Math.abs(item.baseline ?? defaults.baseline ?? -6);
      const contactRow = this.sliderRow("Shelf contact", 0, 18, contact, (v) => {
        if (item.type === "vine") item.topOffset = -v;
        else item.baseline = -v;
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

    const spacingRow = this.sliderRow("Space around object", -40, 28, item.bookSpacing ?? 9, (v) => {
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

    if (DECOR_PHOTO_FRAMES[item.type]) {
      const photoBtn = document.createElement("button");
      photoBtn.className = "decor-action-btn decor-photo-action";
      photoBtn.type = "button";
      photoBtn.textContent = item.photoData ? "Change Photo" : "Choose Photo";
      photoBtn.addEventListener("click", () => this.choosePhoto(item));
      actions.appendChild(photoBtn);
      if (item.photoData) {
        const clearPhotoBtn = document.createElement("button");
        clearPhotoBtn.className = "decor-action-btn";
        clearPhotoBtn.type = "button";
        clearPhotoBtn.textContent = "Clear Photo";
        clearPhotoBtn.addEventListener("click", async () => {
          delete item.photoData;
          await NthDB.decor.put(item);
          this.shelf.render();
          this.renderPanel();
        });
        actions.appendChild(clearPhotoBtn);
      }
    }

    const facingBtn = document.createElement("button");
    facingBtn.className = "decor-action-btn";
    facingBtn.type = "button";
    facingBtn.textContent = item.facing === "left" ? "Face Right" : "Face Left";
    facingBtn.addEventListener("click", async () => {
      item.facing = item.facing === "left" ? "right" : "left";
      await NthDB.decor.put(item);
      this.shelf.render();
      this.renderPanel();
    });
    actions.appendChild(facingBtn);

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
    input.addEventListener("pointerdown", () => this.focusWorkingShelf("auto"));
    input.addEventListener("focus", () => this.focusWorkingShelf("auto"));
    input.addEventListener("input", () => {
      valueEl.textContent = input.value;
      onChange(Number(input.value));
      // The change handler may rebuild the shelf DOM. Re-anchor the newly
      // rendered working row while this slider is actively being adjusted.
      requestAnimationFrame(() => this.focusWorkingShelf("auto"));
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
    const shelfIndex = this.shelf.firstEmptyShelfInActiveBookcase();
    const item = {
      id: `decor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      shelfIndex,
      position: 50,
      width: 100,
      height: 100,
      baseline: defaults.baseline,
      topOffset: defaults.topOffset,
      bookSpacing: -40,
      facing: defaults.facing || "right",
      glow: (type === "candle" || type === "lamp") ? 60 : undefined,
      createdAt: Date.now(),
    };
    await NthDB.decor.put(item);
    this.shelf.setActiveBookcase(Math.floor(shelfIndex / 5), { render: false });
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
