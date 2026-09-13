/* Nth Reader Android narration bridge.
 * The object named NthNativeSpeech exists only inside the native Android app.
 * Browser/PWA installs simply report unavailable and keep using speechSynthesis.
 */
window.NthNativeNarrator = new (class {
  constructor() {
    this.state = null;
  }

  available() {
    try { return window.NthNativeSpeech?.isAvailable() === true; }
    catch (_) { return false; }
  }

  async begin(metadata, units, startIndex) {
    if (!this.available()) throw new Error("Android narration is unavailable");
    window.NthNativeSpeech.beginSession(JSON.stringify(metadata || {}));
    for (let offset = 0; offset < units.length; offset += 40) {
      window.NthNativeSpeech.appendBatch(JSON.stringify(units.slice(offset, offset + 40)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    window.NthNativeSpeech.commitAndPlay(Math.max(0, startIndex | 0));
  }

  pause() { window.NthNativeSpeech?.pause(); }
  resume() { window.NthNativeSpeech?.resume(); }
  stop() { window.NthNativeSpeech?.stop(); }
  skip(delta) { window.NthNativeSpeech?.skip(delta | 0); }
  seekProgress(progress) { window.NthNativeSpeech?.seekProgress(Math.max(0, Math.min(1, Number(progress) || 0))); }
  setRate(rate) { window.NthNativeSpeech?.setRate(Number(rate) || 1); }

  getState() {
    try { this._receive(window.NthNativeSpeech?.getState() || "{}"); }
    catch (_) { /* Activity may be between lifecycle states */ }
    return this.state;
  }

  _receive(raw) {
    try {
      const state = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!state || typeof state !== "object") return;
      this.state = state;
      window.dispatchEvent(new CustomEvent("nth-native-narration", { detail: state }));
    } catch (_) { /* Ignore malformed platform messages. */ }
  }
})();
