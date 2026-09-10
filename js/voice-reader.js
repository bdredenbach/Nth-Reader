/* Nth Reader — native-device read-aloud controller.
 * Uses the browser's Speech Synthesis voices and reads only text rendered
 * inside the current page's clipped paper window. Nth Reader never uploads
 * book text; the selected browser/OS voice service performs synthesis.
 */
window.VoiceReader = class {
  constructor(reader) {
    this.reader = reader;
    this.synth = window.speechSynthesis || null;
    this.supported = Boolean(this.synth && window.SpeechSynthesisUtterance);
    this.els = {
      bar: document.getElementById("voice-reader-bar"),
      play: document.getElementById("voice-play-btn"),
      prev: document.getElementById("voice-prev-btn"),
      next: document.getElementById("voice-next-btn"),
      rate: document.getElementById("voice-rate-btn"),
      settingsButton: document.getElementById("voice-settings-btn"),
      settings: document.getElementById("voice-reader-settings"),
      voice: document.getElementById("voice-select"),
      autoTurn: document.getElementById("voice-auto-turn"),
      status: document.getElementById("voice-reader-status"),
    };
    this.book = null;
    this.content = null;
    this.sentences = [];
    this.sentenceIndex = 0;
    this.playing = false;
    this.paused = false;
    this.waitingForPage = false;
    this.generation = 0;
    this.rateValue = 1;
    this.voiceUri = "";
    this.voices = [];
    this.settingsLoaded = false;
    this.available = false;
    this.turnTimer = null;

    this.els.play.addEventListener("click", () => this.toggle());
    this.els.prev.addEventListener("click", () => this.moveSentence(-1));
    this.els.next.addEventListener("click", () => this.moveSentence(1));
    this.els.rate.addEventListener("click", () => this.cycleRate());
    this.els.settingsButton.addEventListener("click", () => this.toggleSettings());
    this.els.voice.addEventListener("change", () => {
      this.voiceUri = this.els.voice.value;
      this.saveSettings();
      if (this.playing || this.paused) this.restartSentence();
    });
    this.els.autoTurn.addEventListener("change", () => this.saveSettings());

    if (this.supported) {
      this.populateVoices();
      this.synth.addEventListener?.("voiceschanged", () => this.populateVoices());
    }
  }

  async open(book, content) {
    this.stop(false);
    this.book = book;
    this.content = content;
    await this.loadSettings();
    const potentiallyReadable = content?.kind === "flow" || typeof content?.getPageText === "function";
    this.els.bar.hidden = !this.supported || !potentiallyReadable;
    this.available = false;
    if (this.els.bar.hidden) return;
    this.setStatus("Checking this page for readable text…");
    await this.refreshPage(false);
    this.setVisible(true);
  }

  close() {
    this.stop(false);
    this.clearHighlight();
    this.book = null;
    this.content = null;
    this.sentences = [];
    this.available = false;
    this.els.bar.hidden = true;
    this.els.settings.hidden = true;
    this.els.settingsButton.setAttribute("aria-expanded", "false");
  }

  async loadSettings() {
    if (this.settingsLoaded) return;
    let saved = {};
    try { saved = await NthDB.settings.get("narrationSettings", {}); }
    catch (_) { /* narration settings must never prevent a book from opening */ }
    this.rateValue = this.validRate(saved.rate) ? Number(saved.rate) : 1;
    this.voiceUri = String(saved.voiceUri || "");
    this.els.autoTurn.checked = saved.autoTurn !== false;
    this.els.rate.textContent = `${this.rateValue.toFixed(1)}×`;
    this.settingsLoaded = true;
    this.populateVoices();
  }

  validRate(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= .6 && number <= 1.6;
  }

  saveSettings() {
    NthDB.settings.set("narrationSettings", {
      rate: this.rateValue,
      voiceUri: this.voiceUri,
      autoTurn: this.els.autoTurn.checked,
    });
  }

  populateVoices() {
    if (!this.supported) return;
    const voices = this.synth.getVoices() || [];
    if (!voices.length) return;
    const localVoices = voices.filter((voice) => voice.localService);
    this.voices = [...(localVoices.length ? localVoices : voices)].sort((a, b) => {
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      if (a.default !== b.default) return a.default ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const previous = this.voiceUri || this.els.voice.value;
    this.els.voice.replaceChildren(...this.voices.map((voice) => {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} · ${voice.lang}${voice.localService ? " · device" : ""}`;
      return option;
    }));
    const selected = this.voices.find((voice) => voice.voiceURI === previous)
      || this.voices.find((voice) => voice.default)
      || this.voices[0];
    if (selected) {
      this.voiceUri = selected.voiceURI;
      this.els.voice.value = selected.voiceURI;
    }
  }

  selectedVoice() {
    return this.voices.find((voice) => voice.voiceURI === this.voiceUri) || null;
  }

  setVisible(visible) {
    if (this.els.bar.hidden) return;
    this.els.bar.classList.toggle("visible", visible);
  }

  isVisible() { return !this.els.bar.hidden && this.els.bar.classList.contains("visible"); }

  settingsOpen() { return !this.els.settings.hidden; }

  toggleSettings() {
    const opening = this.els.settings.hidden;
    this.els.settings.hidden = !opening;
    this.els.settingsButton.setAttribute("aria-expanded", String(opening));
    this.reader.showChrome();
  }

  setStatus(text) { this.els.status.textContent = text || ""; }

  updateControls() {
    this.els.play.innerHTML = this.playing ? "Ⅱ <span>Pause</span>" : "▶ <span>Read</span>";
    this.els.play.setAttribute("aria-label", this.playing ? "Pause read aloud" : "Read this page aloud");
    this.els.play.disabled = !this.available;
    this.els.prev.disabled = !this.available || this.sentenceIndex <= 0;
    this.els.next.disabled = !this.available || (!this.sentences[this.sentenceIndex + 1] && !this.hasNextPage());
    this.els.rate.textContent = `${this.rateValue.toFixed(1)}×`;
  }

  async refreshPage(continueReading = this.playing) {
    const token = ++this.generation;
    this.clearHighlight();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (token !== this.generation || !this.book) return;
    let sentences = [];
    if (this.content?.kind === "flow") {
      sentences = this.extractVisibleSentences();
    } else if (typeof this.content?.getPageText === "function") {
      const text = await this.content.getPageText(this.reader.index).catch(() => "");
      if (token !== this.generation) return;
      sentences = this.sentencesFromText(text);
    }
    this.sentences = sentences;
    this.sentenceIndex = 0;
    this.available = sentences.length > 0;
    this.waitingForPage = false;
    if (!this.available) {
      this.playing = false;
      this.paused = false;
      this.setStatus("No readable text was found on this page.");
      this.updateControls();
      return;
    }
    this.setStatus(`${sentences.length} sentence${sentences.length === 1 ? "" : "s"} on this page`);
    this.updateControls();
    if (continueReading) {
      this.playing = true;
      this.speakCurrent();
    }
  }

  async onPageChanged() {
    if (!this.book || this.els.bar.hidden) return;
    clearTimeout(this.turnTimer);
    this.turnTimer = null;
    const continueReading = this.playing || this.waitingForPage;
    this.cancelSpeech(false);
    this.paused = false;
    await this.refreshPage(continueReading);
  }

  currentPageNode() {
    if (this.reader._flowUsingTurn && this.reader.turnPageMode?.book) {
      const stored = this.reader.turnPageMode.book.data()?.pageObjs?.[this.reader.index + 1];
      if (stored?.[0]) return stored[0];
    }
    return this.reader.els.flowInner.querySelector(".epub-page-paper")
      || this.reader.els.viewport.querySelector(`.longbox-turn-page[data-source-index="${this.reader.index}"]`);
  }

  extractVisibleSentences() {
    const pageNode = this.currentPageNode();
    const windowEl = pageNode?.querySelector(".epub-page-window");
    const columns = windowEl?.querySelector(".epub-page-columns");
    if (!windowEl || !columns) return [];
    const clip = windowEl.getBoundingClientRect();
    if (clip.width < 10 || clip.height < 10) return [];
    const walker = document.createTreeWalker(columns, NodeFilter.SHOW_TEXT);
    const tokens = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue?.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,noscript,[aria-hidden='true']")) continue;
      const block = parent.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div,section") || parent;
      const expression = /\S+(?:\s+|$)/g;
      let match;
      while ((match = expression.exec(node.nodeValue))) {
        const start = match.index;
        const end = Math.min(node.nodeValue.length, start + match[0].length);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        const visible = Array.from(range.getClientRects()).some((rect) =>
          rect.right > clip.left + .5 && rect.left < clip.right - .5 &&
          rect.bottom > clip.top + .5 && rect.top < clip.bottom - .5
        );
        if (visible) tokens.push({ text: match[0].trim(), range, block });
      }
    }
    return this.groupTokens(tokens);
  }

  groupTokens(tokens) {
    const sentences = [];
    let current = [], length = 0, block = null;
    const flush = () => {
      if (!current.length) return;
      sentences.push({
        text: current.map((token) => token.text).join(" ").replace(/\s+/g, " ").trim(),
        ranges: current.map((token) => token.range).filter(Boolean),
      });
      current = []; length = 0;
    };
    for (const token of tokens) {
      if (block && token.block !== block && current.length) flush();
      block = token.block;
      current.push(token);
      length += token.text.length + 1;
      if (/[.!?][\]})"'’”]*$/.test(token.text) || length >= 260) flush();
    }
    flush();
    return sentences.filter((sentence) => sentence.text);
  }

  sentencesFromText(text) {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    return this.groupTokens(words.map((word) => ({ text: word, range: null, block: null })));
  }

  toggle() {
    this.reader.showChrome();
    if (!this.available) return;
    if (this.playing) {
      // Mobile WebViews disagree about pause/resume state. Canceling the
      // short utterance and restarting that sentence is much more reliable.
      this.cancelSpeech(false);
      this.playing = false;
      this.paused = true;
      this.setStatus("Narration paused");
      this.updateControls();
      return;
    }
    if (this.paused) {
      this.playing = true;
      this.paused = false;
      this.speakCurrent();
      return;
    }
    this.playing = true;
    this.paused = false;
    this.speakCurrent();
  }

  speakCurrent() {
    const sentence = this.sentences[this.sentenceIndex];
    if (!sentence || !this.playing) return;
    this.cancelSpeech(false);
    this.playing = true;
    const token = this.generation;
    const utterance = new SpeechSynthesisUtterance(sentence.text);
    utterance.rate = this.rateValue;
    const voice = this.selectedVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.onend = () => {
      if (token !== this.generation || !this.playing) return;
      if (this.sentences[this.sentenceIndex + 1]) {
        this.sentenceIndex++;
        this.speakCurrent();
      } else {
        this.finishPage();
      }
    };
    utterance.onerror = (event) => {
      if (token !== this.generation || ["canceled", "interrupted"].includes(event.error)) return;
      this.playing = false;
      this.paused = false;
      this.setStatus(`Narration stopped${event.error ? `: ${event.error}` : "."}`);
      this.updateControls();
    };
    this.highlight(sentence);
    this.setSentenceStatus();
    this.updateControls();
    this.synth.speak(utterance);
  }

  finishPage() {
    this.clearHighlight();
    if (this.els.autoTurn.checked && this.hasNextPage()) {
      this.waitingForPage = true;
      this.setStatus("Turning the page…");
      if (!this.reader.narrationNext()) {
        this.stop(false);
      } else {
        clearTimeout(this.turnTimer);
        this.turnTimer = setTimeout(() => {
          if (!this.waitingForPage) return;
          this.waitingForPage = false;
          this.playing = false;
          this.paused = false;
          this.setStatus("Page turn was interrupted. Tap Read to continue.");
          this.updateControls();
        }, 3000);
      }
      return;
    }
    this.playing = false;
    this.paused = false;
    this.setStatus(this.hasNextPage() ? "End of page" : "End of book");
    this.updateControls();
  }

  hasNextPage() {
    const count = this.reader.comic?.pageCount || this.reader.epubPages?.pages?.length || 0;
    return this.reader.index + 1 < count;
  }

  moveSentence(delta) {
    if (!this.available) return;
    const target = this.sentenceIndex + delta;
    if (target < 0) return;
    if (target >= this.sentences.length) {
      if (delta > 0 && this.hasNextPage()) {
        const resume = this.playing;
        this.waitingForPage = resume;
        this.cancelSpeech(false);
        if (!this.reader.narrationNext()) this.stop(false);
      }
      return;
    }
    const resume = this.playing;
    this.cancelSpeech(false);
    this.sentenceIndex = target;
    this.playing = resume;
    this.paused = false;
    if (resume) this.speakCurrent();
    else {
      this.highlight(this.sentences[target]);
      this.setSentenceStatus();
      this.updateControls();
    }
  }

  cycleRate() {
    const rates = [.8, 1, 1.2, 1.4, 1.6];
    const current = rates.findIndex((rate) => Math.abs(rate - this.rateValue) < .01);
    this.rateValue = rates[(current + 1) % rates.length];
    this.saveSettings();
    if (this.playing || this.paused) this.restartSentence();
    else this.updateControls();
    this.reader.showChrome();
  }

  restartSentence() {
    const resume = this.playing;
    this.cancelSpeech(false);
    this.paused = false;
    this.playing = resume;
    if (resume) this.speakCurrent();
    else this.updateControls();
  }

  cancelSpeech(clearPlaying = true) {
    this.generation++;
    try {
      if (this.synth?.paused) this.synth.resume();
      this.synth?.cancel();
    } catch (_) { /* optional platform service */ }
    if (clearPlaying) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
      this.playing = false;
      this.paused = false;
      this.waitingForPage = false;
    }
  }

  stop(update = true) {
    this.cancelSpeech(true);
    this.clearHighlight();
    if (update) {
      this.setStatus(this.available ? "Ready to read" : "");
      this.updateControls();
    }
  }

  setSentenceStatus() {
    const text = this.sentences[this.sentenceIndex]?.text || "";
    this.setStatus(text.length > 115 ? `${text.slice(0, 112)}…` : text);
  }

  highlight(sentence) {
    this.clearHighlight();
    if (!sentence?.ranges?.length || !window.CSS?.highlights || !window.Highlight) return;
    try { CSS.highlights.set("nth-narration", new Highlight(...sentence.ranges)); }
    catch (_) { /* the spoken-text status remains as a fallback */ }
  }

  clearHighlight() {
    try { window.CSS?.highlights?.delete("nth-narration"); } catch (_) { /* unsupported */ }
  }
};
