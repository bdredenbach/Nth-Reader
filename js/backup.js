/* Nth Reader — portable full-library backups for PWA and Android. */
window.NthBackupManager = class {
  constructor({ input, onStatus }) {
    this.input = input;
    this.onStatus = onStatus;
    this.busy = false;
    input.addEventListener("change", () => this.restoreSelected());
    window.addEventListener("nth-native-backup-result", (event) => {
      this.status(event.detail?.message || (event.detail?.success ? "Backup saved." : "Backup was not saved."), !event.detail?.success);
    });
  }

  status(message, error = false) { this.onStatus?.(message, error); }

  async create() {
    if (this.busy) return;
    if (!window.JSZip) { this.status("Backup tools are not available yet. Please refresh and try again.", true); return; }
    this.busy = true;
    try {
      NthDB.requestPersistence();
      this.status("Preparing your Nth Reader backup…");
      const snapshot = await NthDB.exportSnapshot();
      const zip = new JSZip();
      const books = [];
      for (let index = 0; index < snapshot.books.length; index++) {
        const book = { ...snapshot.books[index] };
        if (book.format !== "physical") {
          this.status(`Packing book ${index + 1} of ${snapshot.books.length}: “${book.title || "Untitled"}”…`);
          const source = await NthDB.getFile(book.id);
          if (!source) throw new Error(`“${book.title || book.fileName || "A book"}” is missing its source file. Repair it with Add Books before backing up.`);
          const path = `sources/${index}-${this.safeName(source.name || book.fileName || "book.bin")}`;
          zip.file(path, source, { binary: true });
          book.backupSource = { path, name: source.name || book.fileName || "book.bin", type: source.type || book.fileType || "" };
        }
        books.push(book);
      }
      zip.file("nth-reader-backup.json", JSON.stringify({
        format: "nth-reader-backup", version: 1, createdAt: new Date().toISOString(), appVersion: "0.33.00",
        data: { ...snapshot, books },
      }));
      this.status("Compressing backup…");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } }, (progress) => {
        this.status(`Compressing backup… ${Math.round(progress.percent)}%`);
      });
      const stamp = new Date().toISOString().slice(0, 10);
      await this.saveBlob(blob, `nth-reader-backup-${stamp}.nthbackup`);
      this.status(`Backup ready · ${this.fileSize(blob.size)}`);
    } catch (error) {
      this.status(`Backup failed: ${error.message || error}`, true);
    } finally { this.busy = false; }
  }

  chooseRestore() { if (!this.busy) this.input.click(); }

  async restoreSelected() {
    const file = this.input.files?.[0];
    this.input.value = "";
    if (!file || this.busy) return;
    if (!window.JSZip) { this.status("Restore tools are not available yet. Please refresh and try again.", true); return; }
    this.busy = true;
    try {
      this.status(`Opening “${file.name}”…`);
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file("nth-reader-backup.json");
      if (!manifestFile) throw new Error("This file is not an Nth Reader backup.");
      const manifest = JSON.parse(await manifestFile.async("string"));
      if (manifest?.format !== "nth-reader-backup" || !manifest.data) throw new Error("This backup format is not recognized.");
      const books = Array.isArray(manifest.data.books) ? manifest.data.books : [];
      if (!confirm(`Restore ${books.length} book${books.length === 1 ? "" : "s"} and this backup's shelves, decor, progress, bookmarks, and preferences? Matching items will be updated; other items will remain.`)) return;
      const sources = new Map();
      for (let index = 0; index < books.length; index++) {
        const book = books[index];
        if (!book.backupSource) continue;
        this.status(`Restoring book ${index + 1} of ${books.length}: “${book.title || "Untitled"}”…`);
        const entry = zip.file(book.backupSource.path);
        if (!entry) throw new Error(`The source file for “${book.title || "a book"}” is missing from this backup.`);
        const blob = await entry.async("blob");
        sources.set(String(book.id), new File([blob], book.backupSource.name || book.fileName || "book.bin", {
          type: book.backupSource.type || book.fileType || blob.type || "", lastModified: Date.now(),
        }));
        delete book.backupSource;
      }
      this.status("Restoring shelves, artwork, progress, and settings…");
      await NthDB.importSnapshot(manifest.data, sources);
      this.status(`Restore complete · ${books.length} book${books.length === 1 ? "" : "s"}`);
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      this.status(`Restore failed: ${error.message || error}`, true);
    } finally { this.busy = false; }
  }

  async saveBlob(blob, filename) {
    const native = window.NthNativeBackup;
    if (native?.isAvailable?.()) {
      if (!native.beginExport(filename, "application/zip")) throw new Error("Android could not start the backup export.");
      const chunkSize = 192 * 1024;
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const bytes = new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + chunkSize)).arrayBuffer());
        let binary = "";
        for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        if (!native.appendChunk(btoa(binary))) throw new Error("Android could not write the backup file.");
        this.status(`Sending backup to Android… ${Math.round(Math.min(blob.size, offset + chunkSize) / blob.size * 100)}%`);
      }
      native.finishExport();
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.hidden = true;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  safeName(name) { return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(-160); }
  fileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
};
