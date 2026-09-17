/* Nth Reader — native-device read-aloud controller.
 * Uses the browser's Speech Synthesis voices and reads only text rendered
 * inside the current page's clipped paper window. Nth Reader never uploads
 * book text; the selected browser/OS voice service performs synthesis.
 */
window.VoiceReader = class {
  constructor(reader) {
    this.reader = reader;
    this.synth = window.NthNativeSpeech ? null : (window.speechSynthesis || null);
    this.native = window.NthNativeNarrator || null;
    this.nativeAvailable = Boolean(this.native?.available());
    this.nativeActive = false;
    this.nativePreparing = false;
    this.nativePageSync = false;
    this.supported = this.nativeAvailable || Boolean(this.synth && window.SpeechSynthesisUtterance);
    this.els = {
      bar: document.getElementById("voice-reader-bar"),
      play: document.getElementById("voice-play-btn"),
      prev: document.getElementById("voice-prev-btn"),
      next: document.getElementById("voice-next-btn"),
      rate: document.getElementById("voice-rate-btn"),
      rateSlider: document.getElementById("voice-rate-slider"),
      rateValue: document.getElementById("voice-rate-value"),
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
    this.nativeVoiceName = "";
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
      if (this.nativeAvailable) {
        this.nativeVoiceName = this.els.voice.value;
        this.native.setVoice(this.nativeVoiceName);
      } else {
        this.voiceUri = this.els.voice.value;
      }
      this.saveSettings();
      if (!this.nativeAvailable && (this.playing || this.paused)) this.restartSentence();
    });
    this.els.rateSlider.addEventListener("input", () => this.showRate(Number(this.els.rateSlider.value)));
    this.els.rateSlider.addEventListener("change", () => this.setRate(Number(this.els.rateSlider.value)));
    this.els.autoTurn.addEventListener("change", () => this.saveSettings());

    window.addEventListener("nth-native-narration", (event) => this.onNativeState(event.detail));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.nativeAvailable) this.native.getState();
    });

    if (this.nativeAvailable) {
      const option = document.createElement("option");
      option.value = "android-system";
      option.textContent = "Loading Android voices…";
      this.els.voice.replaceChildren(option);
      this.els.voice.disabled = true;
    } else if (this.supported) {
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
    this.setStatus(this.nativeAvailable ? "Android background narration ready" : "Checking this page for readable text…");
    await this.refreshPage(false);
    if (this.nativeAvailable) {
      const state = this.native.getState();
      if (state?.active && state.bookId && String(state.bookId) !== String(book.id)) this.native.stop();
    }
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
    this.nativeVoiceName = String(saved.nativeVoiceName || "");
    this.els.autoTurn.checked = saved.autoTurn !== false;
    this.showRate(this.rateValue);
    this.settingsLoaded = true;
    if (this.nativeAvailable) this.populateNativeVoices();
    else this.populateVoices();
  }

  validRate(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= .5 && number <= 2;
  }

  saveSettings() {
    NthDB.settings.set("narrationSettings", {
      rate: this.rateValue,
      voiceUri: this.voiceUri,
      nativeVoiceName: this.nativeVoiceName,
      autoTurn: this.els.autoTurn.checked,
    });
  }

  populateVoices() {
    if (!this.supported || this.nativeAvailable || !this.synth) return;
    const voices = this.synth.getVoices() || [];
    const localVoices = voices.filter((voice) => voice.localService === true);
    this.voices = [...localVoices].sort((a, b) => {
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
    this.els.voice.disabled = !selected;
    if (!selected) {
      this.voiceUri = "";
      this.showNoOfflineVoice();
    }
    if (selected) {
      this.voiceUri = selected.voiceURI;
      this.els.voice.value = selected.voiceURI;
    }
  }

  selectedVoice() {
    return (this.synth?.getVoices() || []).find((voice) => voice.localService === true && voice.voiceURI === this.voiceUri) || null;
  }

  populateNativeVoices(voices = this.native?.getVoices() || []) {
    if (!this.nativeAvailable || !Array.isArray(voices)) return;
    voices = voices.filter((voice) => voice.local === true);
    const previous = this.nativeVoiceName;
    this.els.voice.replaceChildren(...voices.map((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.label}${voice.local ? " · device" : " · online"}`;
      return option;
    }));
    const selected = voices.find((voice) => voice.name === previous)
      || voices.find((voice) => voice.local)
      || voices[0];
    this.nativeVoiceName = selected?.name || "";
    this.els.voice.value = this.nativeVoiceName;
    this.els.voice.disabled = !selected;
    if (!selected) this.showNoOfflineVoice();
  }

  showNoOfflineVoice() {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No offline voices installed";
    this.els.voice.replaceChildren(option);
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
    this.els.play.disabled = !this.available || this.nativePreparing;
    this.els.prev.disabled = !this.available || (!this.nativeActive && this.sentenceIndex <= 0);
    this.els.next.disabled = !this.available || (!this.nativeActive && !this.sentences[this.sentenceIndex + 1] && !this.hasNextPage());
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
    if (this.nativeAvailable && this.nativeActive) {
      await this.refreshPage(false);
      if (this.nativePageSync) {
        this.nativePageSync = false;
        this.native.getState();
      }
      else this.native.seekProgress(this.readerProgress());
      return;
    }
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

  async toggle() {
    this.reader.showChrome();
    if (!this.available) return;
    if (this.nativeAvailable) {
      if (this.playing) this.native.pause();
      else if (this.paused && this.nativeActive) this.native.resume();
      else await this.startNative();
      return;
    }
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
    this.populateVoices();
    const voice = this.selectedVoice();
    if (!voice) {
      this.playing = false;
      this.paused = false;
      this.clearHighlight();
      this.setStatus("Install an offline voice in your device's text-to-speech settings, then reopen Nth Reader.");
      this.updateControls();
      return;
    }
    const token = this.generation;
    const utterance = new SpeechSynthesisUtterance(sentence.text);
    utterance.rate = this.rateValue;
    utterance.voice = voice;
    utterance.lang = voice.lang;
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
    if (this.nativeAvailable && this.nativeActive) {
      this.native.skip(delta);
      this.reader.showChrome();
      return;
    }
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
    const rates = [.8, 1, 1.2, 1.4, 1.6, 1.8, 2];
    const current = rates.findIndex((rate) => Math.abs(rate - this.rateValue) < .01);
    this.setRate(rates[(current + 1) % rates.length]);
    this.reader.showChrome();
  }

  showRate(rate) {
    const text = `${Number(rate).toFixed(1)}×`;
    this.els.rate.textContent = text;
    this.els.rateValue.textContent = text;
    this.els.rateSlider.value = String(rate);
  }

  setRate(rate) {
    if (!this.validRate(rate)) return;
    this.rateValue = Number(rate);
    this.showRate(this.rateValue);
    this.saveSettings();
    if (this.nativeAvailable && this.nativeActive) this.native.setRate(this.rateValue);
    else if (this.playing || this.paused) this.restartSentence();
    else this.updateControls();
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
    if (this.nativeAvailable && this.nativeActive) this.native.stop();
    this.nativeActive = false;
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
    if (!sentence?.ranges?.length) return;
    if (window.CSS?.highlights && window.Highlight) {
      try { CSS.highlights.set("nth-narration", new Highlight(...sentence.ranges)); return; }
      catch (_) { /* use the geometry overlay below */ }
    }
    const pageNode = this.currentPageNode();
    const windowEl = pageNode?.querySelector(".epub-page-window");
    if (!windowEl) return;
    const clip = windowEl.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "nth-narration-overlay";
    for (const range of sentence.ranges) {
      for (const rect of range.getClientRects()) {
        if (rect.right <= clip.left || rect.left >= clip.right || rect.bottom <= clip.top || rect.top >= clip.bottom) continue;
        const mark = document.createElement("span");
        mark.style.left = `${Math.max(0, rect.left - clip.left)}px`;
        mark.style.top = `${Math.max(0, rect.top - clip.top)}px`;
        mark.style.width = `${Math.min(clip.right, rect.right) - Math.max(clip.left, rect.left)}px`;
        mark.style.height = `${Math.min(clip.bottom, rect.bottom) - Math.max(clip.top, rect.top)}px`;
        overlay.appendChild(mark);
      }
    }
    if (overlay.childElementCount) windowEl.appendChild(overlay);
  }

  clearHighlight() {
    try { window.CSS?.highlights?.delete("nth-narration"); } catch (_) { /* unsupported */ }
    document.querySelectorAll(".nth-narration-overlay").forEach((overlay) => overlay.remove());
  }

  highlightNativeText(text) {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const wanted = normalize(text);
    if (!wanted || !this.sentences.length) { this.clearHighlight(); return; }
    let index = this.sentences.findIndex((sentence) => normalize(sentence.text) === wanted);
    if (index < 0) {
      index = this.sentences.findIndex((sentence) => {
        const local = normalize(sentence.text);
        return local && (local.includes(wanted) || wanted.includes(local));
      });
    }
    if (index < 0) { this.clearHighlight(); return; }
    this.sentenceIndex = index;
    this.highlight(this.sentences[index]);
  }

  readerProgress() {
    const count = this.reader.comic?.pageCount || this.reader.epubPages?.pages?.length || 1;
    return count > 1 ? this.reader.index / (count - 1) : 0;
  }

  async startNative() {
    if (this.nativePreparing) return;
    this.nativePreparing = true;
    this.setStatus("Preparing this book for background narration…");
    this.els.play.disabled = true;
    try {
      const units = await this.buildNativeUnits();
      if (!units.length) throw new Error("No readable text was found in this book.");
      const progress = this.readerProgress();
      let startIndex = units.findIndex((unit) =>
        unit.pageIndex >= 0 ? unit.pageIndex >= this.reader.index : unit.progress >= progress
      );
      if (startIndex < 0) startIndex = units.length - 1;
      this.nativeActive = true;
      await this.native.begin({
        bookId: String(this.book?.id || ""),
        title: this.book?.title || "Nth Reader",
        author: this.book?.author || "",
        rate: this.rateValue,
        voiceName: this.nativeVoiceName,
      }, units, startIndex);
      this.nativePreparing = false;
      this.updateControls();
    } catch (error) {
      this.nativePreparing = false;
      this.nativeActive = false;
      this.playing = false;
      this.paused = false;
      this.setStatus(error?.message || "Background narration could not start.");
      this.updateControls();
    }
  }

  async buildNativeUnits() {
    const units = [];
    if (this.content?.kind === "flow") {
      const pages = this.reader.epubPages?.pages || [];
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        for (const sentence of this.sentencesFromText(pages[pageIndex].text || "")) {
          units.push({
            text: sentence.text,
            progress: pages.length > 1 ? pageIndex / (pages.length - 1) : 0,
            pageIndex,
          });
        }
      }
    } else if (typeof this.content?.getPageText === "function") {
      const count = this.content.pageCount || this.reader.comic?.pageCount || 0;
      for (let pageIndex = 0; pageIndex < count; pageIndex++) {
        const text = await this.content.getPageText(pageIndex).catch(() => "");
        for (const sentence of this.sentencesFromText(text)) {
          units.push({
            text: sentence.text,
            progress: count > 1 ? pageIndex / (count - 1) : 0,
            pageIndex,
          });
        }
        if (pageIndex % 4 === 3) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return units;
  }

  onNativeState(state) {
    if (!this.nativeAvailable || !state || !this.book) return;
    if (Array.isArray(state.voices)) this.populateNativeVoices(state.voices);
    if (state.bookId && String(state.bookId) !== String(this.book.id)) return;
    this.nativeActive = Boolean(state.active);
    this.playing = Boolean(state.playing);
    this.paused = Boolean(state.paused);
    this.available = this.available || this.nativeActive;
    if (state.error) this.setStatus(state.error);
    else if (state.playing && state.text) this.setStatus(state.text.length > 115 ? `${state.text.slice(0, 112)}…` : state.text);
    else if (state.paused) this.setStatus("Background narration paused");
    else if (state.finished) this.setStatus("End of book");
    else if (this.nativeActive) this.setStatus("Android background narration ready");
    this.updateControls();
    if (this.nativeActive && document.visibilityState === "visible") {
      this.reader.syncNativeNarration(state);
      const targetPage = Number(state.pageIndex);
      if ((!Number.isFinite(targetPage) || targetPage === this.reader.index) && state.text) this.highlightNativeText(state.text);
    }
    if (!this.nativeActive || state.finished) this.clearHighlight();
  }
};
