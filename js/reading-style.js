/* Nth Reader — persistent typography and page appearance controls. */
window.ReadingStyleController = class {
  constructor(reader) {
    this.reader = reader;
    this.defaults = {
      font: "book",
      size: 17,
      lineHeight: 1.55,
      paragraph: .85,
      align: "left",
      theme: "paper",
    };
    this.fonts = {
      book: 'Georgia,"Times New Roman",serif',
      classic: 'Baskerville,"Palatino Linotype",Palatino,serif',
      modern: '-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
      clear: 'Verdana,Tahoma,Arial,sans-serif',
    };
    this.fontNames = { book: "Book", classic: "Classic", modern: "Modern", clear: "Clear" };
    this.themeNames = { paper: "Paper", sepia: "Sepia", night: "Night" };
    this.settings = { ...this.defaults };
    this.loaded = false;
    this.reflowTimer = null;
    this.saveTimer = null;
    this.els = {
      bar: document.getElementById("reading-style-bar"),
      toggle: document.getElementById("reading-style-toggle"),
      panel: document.getElementById("reading-style-panel"),
      smaller: document.getElementById("reading-style-smaller"),
      larger: document.getElementById("reading-style-larger"),
      summary: document.getElementById("reading-style-summary"),
      themeQuick: document.getElementById("reading-style-theme-quick"),
      font: document.getElementById("reading-font"),
      size: document.getElementById("reading-font-size"),
      sizeValue: document.getElementById("reading-font-size-value"),
      line: document.getElementById("reading-line-height"),
      lineValue: document.getElementById("reading-line-height-value"),
      paragraph: document.getElementById("reading-paragraph-gap"),
      paragraphValue: document.getElementById("reading-paragraph-gap-value"),
      align: document.getElementById("reading-align-toggle"),
      themes: Array.from(document.querySelectorAll("[data-reading-theme-choice]")),
      reset: document.getElementById("reading-style-reset"),
    };

    this.els.toggle.addEventListener("click", () => this.togglePanel());
    this.els.smaller.addEventListener("click", () => this.nudgeSize(-1));
    this.els.larger.addEventListener("click", () => this.nudgeSize(1));
    this.els.themeQuick.addEventListener("click", () => this.cycleTheme());
    this.els.font.addEventListener("change", () => this.change("font", this.els.font.value, true));
    this.els.size.addEventListener("input", () => this.change("size", Number(this.els.size.value), true));
    this.els.line.addEventListener("input", () => this.change("lineHeight", Number(this.els.line.value) / 100, true));
    this.els.paragraph.addEventListener("input", () => this.change("paragraph", Number(this.els.paragraph.value) / 100, true));
    this.els.align.addEventListener("click", () => this.change("align", this.settings.align === "left" ? "justify" : "left", true));
    this.els.themes.forEach((button) => button.addEventListener("click", () => this.change("theme", button.dataset.readingThemeChoice, false)));
    this.els.reset.addEventListener("click", () => this.reset());
    this.applyVariables();
    this.updateUI();
  }

  async open(content) {
    await this.load();
    const available = content?.kind === "flow";
    this.els.bar.hidden = !available;
    this.els.panel.hidden = true;
    this.els.toggle.setAttribute("aria-expanded", "false");
    if (available) this.setVisible(true);
  }

  close() {
    clearTimeout(this.reflowTimer);
    this.reflowTimer = null;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      NthDB.settings.set("readingStyle", this.settings).catch(() => {});
    }
    this.els.bar.hidden = true;
    this.els.panel.hidden = true;
    this.els.toggle.setAttribute("aria-expanded", "false");
  }

  async load() {
    if (this.loaded) return;
    let saved = {};
    try { saved = await NthDB.settings.get("readingStyle", {}); }
    catch (_) { /* appearance settings must never prevent opening a book */ }
    this.settings = this.validate({ ...this.defaults, ...saved });
    this.loaded = true;
    this.applyVariables();
    this.updateUI();
  }

  validate(value) {
    return {
      font: this.fonts[value.font] ? value.font : this.defaults.font,
      size: Math.max(14, Math.min(26, Number(value.size) || this.defaults.size)),
      lineHeight: Math.max(1.3, Math.min(2, Number(value.lineHeight) || this.defaults.lineHeight)),
      paragraph: Math.max(.4, Math.min(1.4, Number(value.paragraph) || this.defaults.paragraph)),
      align: value.align === "justify" ? "justify" : "left",
      theme: this.themeNames[value.theme] ? value.theme : this.defaults.theme,
    };
  }

  change(key, value, reflow) {
    this.settings = this.validate({ ...this.settings, [key]: value });
    this.applyVariables();
    this.updateUI();
    this.scheduleSave();
    if (reflow) this.scheduleReflow();
    this.reader.showChrome();
  }

  nudgeSize(delta) {
    this.change("size", this.settings.size + delta, true);
  }

  cycleTheme() {
    const themes = ["paper", "sepia", "night"];
    const index = themes.indexOf(this.settings.theme);
    this.change("theme", themes[(index + 1) % themes.length], false);
  }

  reset() {
    this.settings = { ...this.defaults };
    this.applyVariables();
    this.updateUI();
    this.scheduleSave();
    this.scheduleReflow();
    this.reader.showChrome();
  }

  applyVariables() {
    const root = document.documentElement;
    root.style.setProperty("--reader-font-family", this.fonts[this.settings.font]);
    root.style.setProperty("--reader-font-size", `${this.settings.size}px`);
    root.style.setProperty("--reader-line-height", String(this.settings.lineHeight));
    root.style.setProperty("--reader-paragraph-gap", `${this.settings.paragraph}em`);
    root.style.setProperty("--reader-text-align", this.settings.align);
    document.getElementById("reader-view")?.setAttribute("data-reading-theme", this.settings.theme);
  }

  updateUI() {
    this.els.font.value = this.settings.font;
    this.els.size.value = String(this.settings.size);
    this.els.line.value = String(Math.round(this.settings.lineHeight * 100));
    this.els.paragraph.value = String(Math.round(this.settings.paragraph * 100));
    this.els.sizeValue.textContent = `${this.settings.size}px`;
    this.els.lineValue.textContent = this.settings.lineHeight.toFixed(2).replace(/0$/, "");
    this.els.paragraphValue.textContent = `${Math.round(this.settings.paragraph * 100)}%`;
    this.els.summary.textContent = `${this.fontNames[this.settings.font]} · ${this.settings.size}px`;
    this.els.themeQuick.textContent = this.settings.theme === "night" ? "☾" : this.settings.theme === "sepia" ? "◐" : "☀";
    this.els.themeQuick.setAttribute("aria-label", `Page theme: ${this.themeNames[this.settings.theme]}. Change theme`);
    this.els.align.textContent = this.settings.align === "justify" ? "Justified" : "Left aligned";
    this.els.themes.forEach((button) => {
      const selected = button.dataset.readingThemeChoice === this.settings.theme;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  scheduleReflow() {
    clearTimeout(this.reflowTimer);
    this.els.summary.textContent = "Updating pages…";
    this.reflowTimer = setTimeout(() => {
      this.reflowTimer = null;
      this.reader.applyReadingStyle()
        .then(() => this.updateUI())
        .catch(() => { this.els.summary.textContent = "Could not update pages"; });
    }, 320);
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      NthDB.settings.set("readingStyle", this.settings).catch(() => {});
    }, 180);
  }

  setVisible(visible) {
    if (this.els.bar.hidden) return;
    this.els.bar.classList.toggle("visible", visible);
  }

  panelOpen() { return !this.els.panel.hidden; }

  togglePanel() {
    const opening = this.els.panel.hidden;
    this.els.panel.hidden = !opening;
    this.els.toggle.setAttribute("aria-expanded", String(opening));
    this.reader.showChrome();
  }
};
