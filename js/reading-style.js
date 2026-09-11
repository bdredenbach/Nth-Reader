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
      alegreya: '"Nth Alegreya",Georgia,serif',
      atkinson: '"Nth Atkinson",Verdana,sans-serif',
      cormorant: '"Nth Cormorant",Georgia,serif',
      "crimson-pro": '"Nth Crimson Pro",Georgia,serif',
      "eb-garamond": '"Nth EB Garamond",Georgia,serif',
      lexend: '"Nth Lexend",Verdana,sans-serif',
      "libre-baskerville": '"Nth Libre Baskerville",Georgia,serif',
      literata: '"Nth Literata",Georgia,serif',
      lora: '"Nth Lora",Georgia,serif',
      merriweather: '"Nth Merriweather",Georgia,serif',
      "noto-sans": '"Nth Noto Sans",Arial,sans-serif',
      "nunito-sans": '"Nth Nunito Sans",Arial,sans-serif',
      "roboto-slab": '"Nth Roboto Slab",Georgia,serif',
      "source-serif": '"Nth Source Serif",Georgia,serif',
      vollkorn: '"Nth Vollkorn",Georgia,serif',
    };
    this.fontNames = {
      book:"Book", classic:"Classic", modern:"Modern", clear:"Clear",
      alegreya:"Alegreya", atkinson:"Atkinson", cormorant:"Cormorant", "crimson-pro":"Crimson Pro",
      "eb-garamond":"EB Garamond", lexend:"Lexend", "libre-baskerville":"Libre Baskerville",
      literata:"Literata", lora:"Lora", merriweather:"Merriweather", "noto-sans":"Noto Sans",
      "nunito-sans":"Nunito Sans", "roboto-slab":"Roboto Slab", "source-serif":"Source Serif", vollkorn:"Vollkorn",
    };
    this.webFontNames = {
      alegreya:"Nth Alegreya", atkinson:"Nth Atkinson", cormorant:"Nth Cormorant", "crimson-pro":"Nth Crimson Pro",
      "eb-garamond":"Nth EB Garamond", lexend:"Nth Lexend", "libre-baskerville":"Nth Libre Baskerville",
      literata:"Nth Literata", lora:"Nth Lora", merriweather:"Nth Merriweather", "noto-sans":"Nth Noto Sans",
      "nunito-sans":"Nth Nunito Sans", "roboto-slab":"Nth Roboto Slab", "source-serif":"Nth Source Serif", vollkorn:"Nth Vollkorn",
    };
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
    if (available) {
      await this.ensureFontLoaded();
      this.setVisible(true);
    }
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
      this.ensureFontLoaded()
        .then(() => this.reader.applyReadingStyle())
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

  async ensureFontLoaded() {
    const family = this.webFontNames[this.settings.font];
    if (!family || !document.fonts?.load) return;
    await Promise.race([
      document.fonts.load(`${this.settings.size}px "${family}"`),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]);
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
