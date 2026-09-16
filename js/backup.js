/* Nth Reader — visible, cancellable library transfers for PWA and Android. */
window.NthBackupManager = class {
  constructor({ input, onStatus }) {
    this.input = input;
    this.onStatus = onStatus;
    this.busy = false;
    this.cancelRequested = false;
    this.waitingForNativeSave = false;
    this.els = {
      overlay: document.getElementById("transfer-overlay"),
      dialog: document.getElementById("transfer-dialog"),
      emblem: document.querySelector("#transfer-dialog .transfer-emblem"),
      title: document.getElementById("transfer-title"),
      message: document.getElementById("transfer-message"),
      track: document.querySelector("#transfer-dialog .transfer-progress-track"),
      bar: document.getElementById("transfer-progress-bar"),
      detail: document.getElementById("transfer-detail"),
      percent: document.getElementById("transfer-percent"),
      action: document.getElementById("transfer-action"),
    };
    input.addEventListener("change", () => this.restoreSelected());
    this.els.action.addEventListener("click", () => {
      if (this.busy) {
        this.cancelRequested = true;
        this.els.action.disabled = true;
        this.els.action.textContent = "Cancelling…";
        this.els.detail.textContent = "Finishing the current file safely…";
      } else this.hide();
    });
    window.addEventListener("nth-native-backup-result", (event) => {
      this.waitingForNativeSave = false;
      const success = Boolean(event.detail?.success);
      this.finish(success ? "Saved" : "Not saved", event.detail?.message || (success ? "The file was saved." : "The file was not saved."), !success);
    });
  }

  status(message, error = false) { this.onStatus?.(message, error); }

  begin(title, message, emblem = "⇩") {
    this.busy = true;
    this.cancelRequested = false;
    this.waitingForNativeSave = false;
    this.els.overlay.hidden = false;
    this.els.dialog.hidden = false;
    this.els.emblem.textContent = emblem;
    this.els.title.textContent = title;
    this.els.message.textContent = message;
    this.els.action.disabled = false;
    this.els.action.textContent = "Cancel";
    this.progress(0, "Please keep Nth Reader open.", true);
  }

  progress(percent, detail, indeterminate = false) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    this.els.track.classList.toggle("indeterminate", indeterminate);
    this.els.track.setAttribute("aria-valuenow", String(Math.round(value)));
    this.els.bar.style.width = indeterminate ? "" : `${value}%`;
    this.els.percent.textContent = indeterminate ? "Working…" : `${Math.round(value)}%`;
    if (detail) this.els.detail.textContent = detail;
  }

  finish(title, message, error = false) {
    this.busy = false;
    this.cancelRequested = false;
    this.els.title.textContent = title;
    this.els.message.textContent = message;
    this.els.emblem.textContent = error ? "!" : "✓";
    this.progress(error ? 0 : 100, error ? "Nothing was changed." : "Transfer complete.");
    this.els.action.disabled = false;
    this.els.action.textContent = "Done";
    this.status(message, error);
  }

  hide() {
    if (this.busy) return;
    this.els.overlay.hidden = true;
    this.els.dialog.hidden = true;
  }

  checkCancelled() {
    if (!this.cancelRequested) return;
    const error = new Error("Transfer cancelled.");
    error.cancelled = true;
    throw error;
  }

  async create() {
    if (this.busy) return;
    if (!window.JSZip) { this.begin("Backup unavailable", "The backup tools did not load. Refresh Nth Reader and try again."); this.finish("Backup unavailable", "The backup tools did not load.", true); return; }
    this.begin("Backing up Nth Reader", "Gathering your books, shelves, artwork, and reading history…");
    try {
      NthDB.requestPersistence();
      const snapshot = await NthDB.exportSnapshot();
      this.checkCancelled();
      const zip = new JSZip();
      const books = [];
      const digitalBooks = snapshot.books.filter((book) => book.format !== "physical");
      const totalBytes = digitalBooks.reduce((sum, book) => sum + Math.max(1, Number(book.fileSize) || 1), 0);
      let packedBytes = 0;
      for (let index = 0; index < snapshot.books.length; index++) {
        this.checkCancelled();
        const book = { ...snapshot.books[index] };
        this.els.message.textContent = `Adding “${book.title || "Untitled"}”`;
        if (book.format !== "physical") {
          const source = await NthDB.getFile(book.id);
          this.checkCancelled();
          if (!source) throw new Error(`“${book.title || book.fileName || "A book"}” is missing its source file. Repair it with Add Books before backing up.`);
          const path = `sources/${index}-${this.safeName(source.name || book.fileName || "book.bin")}`;
          // These formats are already compressed. STORE avoids burning CPU
          // and battery attempting to compress their bytes a second time.
          zip.file(path, source, { binary: true, compression: "STORE" });
          book.backupSource = { path, name: source.name || book.fileName || "book.bin", type: source.type || book.fileType || "" };
          packedBytes += Math.max(1, source.size);
        }
        books.push(book);
        this.progress(5 + 35 * (packedBytes / Math.max(1, totalBytes)), `Book ${index + 1} of ${snapshot.books.length}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      zip.file("nth-reader-backup.json", JSON.stringify({
        format: "nth-reader-backup", version: 1, createdAt: new Date().toISOString(), appVersion: "0.38.03",
        data: { ...snapshot, books },
      }), { compression: "DEFLATE" });
      this.els.message.textContent = "Building the portable backup file…";
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (update) => {
        this.checkCancelled();
        this.progress(40 + update.percent * .5, update.currentFile ? `Packing ${this.shortName(update.currentFile)}` : "Packing library data");
      });
      this.checkCancelled();
      this.els.message.textContent = `Saving ${this.fileSize(blob.size)} backup…`;
      const destination = await this.saveBlob(blob, `nth-reader-backup-${new Date().toISOString().slice(0, 10)}.nthbackup`, "application/zip", (fraction) => {
        this.checkCancelled();
        this.progress(90 + fraction * 10, "Writing backup file");
      });
      if (destination === "native") {
        this.busy = false;
        this.waitingForNativeSave = true;
        this.els.message.textContent = "Choose where Android should save your backup.";
        this.progress(100, "Waiting for Android’s Save dialog");
        this.els.action.textContent = "Close";
      } else this.finish("Backup downloaded", `${this.fileSize(blob.size)} · Your complete library backup is ready.`);
    } catch (error) {
      if (error.cancelled) this.finish("Backup cancelled", "No backup file was created.", true);
      else this.finish("Backup failed", error.message || String(error), true);
    }
  }

  chooseRestore() {
    if (this.busy) return;
    this.input.value = "";
    this.input.click();
  }

  async restoreSelected() {
    const file = this.input.files?.[0];
    this.input.value = "";
    if (!file || this.busy) return;
    if (!window.JSZip) { this.begin("Restore unavailable", "The restore tools did not load.", "⇧"); this.finish("Restore unavailable", "Refresh Nth Reader and try again.", true); return; }
    if (!confirm(`Restore “${file.name}”? Matching books and settings will be updated; unrelated books will remain.`)) return;
    this.begin("Restoring Nth Reader", `Opening “${file.name}”…`, "⇧");
    try {
      const zip = await JSZip.loadAsync(file);
      this.checkCancelled();
      const manifestFile = zip.file("nth-reader-backup.json");
      if (!manifestFile) throw new Error("This file is not an Nth Reader backup.");
      const manifest = JSON.parse(await manifestFile.async("string"));
      if (manifest?.format !== "nth-reader-backup" || !manifest.data) throw new Error("This backup format is not recognized.");
      const books = Array.isArray(manifest.data.books) ? manifest.data.books : [];
      for (let index = 0; index < books.length; index++) {
        this.checkCancelled();
        const book = { ...books[index] };
        this.els.message.textContent = `Restoring “${book.title || "Untitled"}”`;
        let source = null;
        if (book.backupSource) {
          const entry = zip.file(book.backupSource.path);
          if (!entry) throw new Error(`The source file for “${book.title || "a book"}” is missing from this backup.`);
          const blob = await entry.async("blob", (update) => {
            this.progress(5 + ((index + update.percent / 100) / Math.max(1, books.length)) * 80, `Book ${index + 1} of ${books.length}`);
          });
          source = new File([blob], book.backupSource.name || book.fileName || "book.bin", {
            type: book.backupSource.type || book.fileType || blob.type || "", lastModified: Date.now(),
          });
          delete book.backupSource;
        }
        await NthDB.put(source ? { ...book, file: source } : book);
        this.checkCancelled();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      this.els.message.textContent = "Restoring shelf layout, decor, bookmarks, and preferences…";
      this.progress(90, "Finishing library records");
      await NthDB.importSnapshot({ ...manifest.data, books: [] });
      this.checkCancelled();
      this.finish("Library restored", `${books.length} book${books.length === 1 ? "" : "s"}, shelves, decor, progress, and settings restored.`);
      setTimeout(() => location.reload(), 1200);
    } catch (error) {
      if (error.cancelled) this.finish("Restore stopped", "Items already restored are safe. You can run Restore again to finish.", true);
      else this.finish("Restore failed", error.message || String(error), true);
    }
  }

  async downloadBook(book) {
    if (this.busy || !book || book.format === "physical") return;
    this.begin("Downloading original book", `Preparing “${book.title || book.fileName || "book"}”…`, "⇩");
    try {
      const source = await NthDB.getFile(book.id);
      this.checkCancelled();
      if (!source) throw new Error("The original source file is missing. Use Add Books to repair this shelf entry.");
      this.progress(15, `${this.fileSize(source.size)} original file`);
      const destination = await this.saveBlob(source, source.name || book.fileName || `${book.title || "book"}.${book.format || "bin"}`, source.type || book.fileType || "application/octet-stream", (fraction) => {
        this.checkCancelled();
        this.progress(15 + fraction * 85, "Writing original book file");
      });
      if (destination === "native") {
        this.busy = false;
        this.waitingForNativeSave = true;
        this.els.message.textContent = "Choose where Android should save the original book.";
        this.progress(100, "Waiting for Android’s Save dialog");
        this.els.action.textContent = "Close";
      } else this.finish("Book downloaded", `Saved the original “${source.name || book.fileName}” file.`);
    } catch (error) {
      if (error.cancelled) this.finish("Download cancelled", "No file was created.", true);
      else this.finish("Download failed", error.message || String(error), true);
    }
  }

  async saveBlob(blob, filename, mime, onProgress = () => {}) {
    const native = window.NthNativeBackup;
    if (native?.isAvailable?.()) {
      if (!native.beginExport(filename, mime || "application/octet-stream")) throw new Error("Android could not start the file export.");
      const chunkSize = 192 * 1024;
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        this.checkCancelled();
        const bytes = new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + chunkSize)).arrayBuffer());
        let binary = "";
        for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        if (!native.appendChunk(btoa(binary))) throw new Error("Android could not write the file.");
        onProgress(Math.min(blob.size, offset + chunkSize) / Math.max(1, blob.size));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      native.finishExport();
      return "native";
    }
    onProgress(.95);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.hidden = true;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    onProgress(1);
    return "browser";
  }

  safeName(name) { return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(-160); }
  shortName(name) { const value = String(name || "library data"); return value.length > 42 ? `…${value.slice(-41)}` : value; }
  fileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
};
