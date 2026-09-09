/* Nth Reader — app.js */
(async function () {
  const shelfRoot = document.getElementById("shelf-root");
  const fileInput = document.getElementById("file-input");
  const importStatus = document.getElementById("import-status");
  const reader = new Reader();
  let refreshToken = 0;
  let pendingRepairBookId = null;
  shelfRoot.classList.add("shelf-loading");

  const shelf = new Shelf(shelfRoot, {
    onOpen: (id) => openBook(id),
  });
  const carousel = new BookcaseCarousel(shelf);
  shelf.onBookcaseChanged = (index, scrollPositions) => {
    NthDB.settings.set("activeBookcase", index);
    NthDB.settings.set("bookcaseScrollPositions", scrollPositions);
  };
  shelf.onBookcaseScrollChanged = (scrollPositions) => {
    NthDB.settings.set("bookcaseScrollPositions", scrollPositions);
  };

  const customize = new Customize(shelf, {
    onExit: refresh,
  });

  shelf.onBookMoved = (book, previous) => {
    if (customize.active) customize.showMoveToast(book, previous);
  };

  const menu = new Menu({
    onAdd: () => fileInput.click(),
    onCustomize: () => customize.enter(),
    onOpenBook: (id, bookmark) => openBook(id, bookmark),
  });

  const removePanel = new RemovePanel({
    onRemoved: refresh,
  });

  window.addEventListener("nth:reader-closed", refresh);

  fileInput.addEventListener("change", async () => {
    try {
      // A file-picker selection is a fresh user gesture, which gives browsers
      // another opportunity to grant durable origin storage.
      NthDB.requestPersistence();
      const selectedFiles = Array.from(fileInput.files || []);
      fileInput.value = "";
      const files = [];
      const ignored = [];
      for (const selected of selectedFiles) {
        showStatus(`Inspecting "${selected.name}"…`);
        const expanded = await NthFormats.expandImport(selected);
        files.push(...expanded.files);
        ignored.push(...expanded.ignored);
      }
      const existingBooks = await NthDB.all();
      let added = 0, repaired = 0;
      for (let i = 0; i < files.length; i++) {
        const repairedBook = await repairMissingBook(files[i], existingBooks);
        if (repairedBook) {
          repaired++;
          continue;
        }
        showStatus(`Adding ${i + 1} of ${files.length}: "${files[i].name}"…`);
        if (await addBook(files[i])) added++;
      }
      if (repaired || ignored.length) {
        const parts = [`Added ${added}`];
        if (repaired) parts.push(`repaired ${repaired} missing source${repaired === 1 ? "" : "s"}`);
        if (ignored.length) parts.push(`skipped ${ignored.length} unsupported archive entr${ignored.length === 1 ? "y" : "ies"}`);
        showStatus(parts.join("; ") + ".");
      }
      await refresh();
    } catch (error) {
      fileInput.value = "";
      showStatus(`Import stopped: ${error.message || error}. You can try Add Books again without refreshing.`, true);
    }
  });

  async function openBook(id, bookmark = null) {
    const [book, sourceFile] = await Promise.all([NthDB.get(id), NthDB.getFile(id)]);
    if (!book) return;
    try {
      shelf.setActiveBookcase(Math.floor((Number(book.shelfIndex) || 0) / 5));
      if (!sourceFile) {
        pendingRepairBookId = id;
        throw new Error(`The shelf entry is safe, but its source file is missing. Use Add Books and select "${book.fileName || book.title}" to repair it in place; your shelf arrangement and progress will be preserved.`);
      }
      importStatus.textContent = "";
      book.lastReadAt = Date.now();
      await NthDB.put(book);
      const readableFile = sourceFile.name
        ? sourceFile
        : new File([sourceFile], book.fileName || `${book.title}.${book.format}`, { type: book.fileType || sourceFile.type });
      const content = await NthFormats.load(readableFile);
      await reader.open(book, content, bookmark);
    } catch (err) {
      showStatus(err.message || String(err), true);
    }
  }

  async function addBook(file) {
    let content = null;
    try {
      showStatus(`Adding "${file.name}"…`);
      content = await NthFormats.load(file);
      const shelfIndex = await firstEmptyShelfIndex();
      const book = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: content.title || file.name.replace(/\.[^.]+$/, ""),
        format: NthFormats.extOf(file.name),
        file,
        fileName: file.name,
        fileType: file.type || "",
        fileSize: file.size || 0,
        addedAt: Date.now(),
        shelfIndex,
        slot: Date.now(),
        progress: 0,
      };
      if (content.coverUrl) {
        try {
          book.coverThumb = await makeThumb(await content.coverUrl());
        } catch { /* cover is a nice-to-have; skip silently if it fails */ }
      }
      await NthDB.put(book);
      if (!await NthDB.verifySource(book.id, file.size)) {
        await NthDB.remove(book.id);
        throw new Error("The source could not be verified after saving, so no incomplete shelf entry was created.");
      }
      const targetBookcase = Math.floor(shelfIndex / 5);
      // Archive entries are saved before the final shelf refresh. Keep the
      // in-memory carousel range moving with them so a large archive can span
      // several new cabinets and finish on the cabinet it most recently used.
      shelf.bookcaseCount = Math.max(shelf.bookcaseCount, targetBookcase + 2);
      shelf.shelfCount = shelf.bookcaseCount * 5;
      shelf.setActiveBookcase(targetBookcase, { render: false });
      showStatus("");
      return true;
    } catch (err) {
      showStatus(`Couldn't add "${file.name}": ${err.message || err}`, true);
      return false;
    } finally {
      // Import only needs metadata and a thumbnail. Do not leave JSZip/PDF
      // holding the complete source archive in RAM while the shelf is open.
      await content?.dispose?.();
    }
  }

  async function repairMissingBook(file, existingBooks) {
    const normalizedName = String(file.name || "").toLowerCase();
    const candidates = existingBooks.filter((book) => {
      const nameMatches = String(book.fileName || "").toLowerCase() === normalizedName;
      const sizeMatches = !book.fileSize || !file.size || Number(book.fileSize) === Number(file.size);
      return nameMatches && sizeMatches;
    }).sort((a, b) => Number(b.id === pendingRepairBookId) - Number(a.id === pendingRepairBookId));

    for (const book of candidates) {
      if (await NthDB.verifySource(book.id, book.fileSize || null)) continue;
      showStatus(`Repairing "${book.title}" without changing its shelf…`);
      await NthDB.put({
        ...book,
        file,
        fileName: file.name,
        fileType: file.type || book.fileType || "",
        fileSize: file.size || 0,
      });
      if (!await NthDB.verifySource(book.id, file.size)) {
        throw new Error(`The replacement source for "${book.title}" could not be verified.`);
      }
      pendingRepairBookId = null;
      return book;
    }
    return null;
  }

  async function firstEmptyShelfIndex() {
    const [books, decorItems, stacks] = await Promise.all([
      NthDB.all(), NthDB.decor.all(), NthDB.stacks.all(),
    ]);
    const occupied = new Set([...books.filter((book) => !book.stackId), ...decorItems, ...stacks]
      .map((item) => Math.max(0, Number(item.shelfIndex) || 0)));
    let bookcase = shelf.activeBookcase;
    while (true) {
      const first = bookcase * 5;
      for (let shelfIndex = first; shelfIndex < first + 5; shelfIndex++) {
        if (!occupied.has(shelfIndex)) return shelfIndex;
      }
      bookcase++;
    }
  }

  function showStatus(msg, isError) {
    importStatus.textContent = msg;
    importStatus.classList.toggle("error", !!isError);
  }

  async function makeThumb(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = 240, h = Math.round((img.naturalHeight / img.naturalWidth) * w) || 347;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function refresh() {
    const token = ++refreshToken;
    await NthDB.flush();
    if (token !== refreshToken) return;
    const [books, decorItems, stacks] = await Promise.all([
      NthDB.all(), NthDB.decor.all(), NthDB.stacks.all(),
    ]);
    if (token !== refreshToken) return;
    shelf.setAll(books, decorItems, stacks);
    carousel.updateButton();
    shelfRoot.classList.remove("shelf-loading");
  }

  try {
    await NthDB.ready();
    NthDB.requestPersistence();
    const [activeBookcase, bookcaseScrollPositions] = await Promise.all([
      NthDB.settings.get("activeBookcase", 0),
      NthDB.settings.get("bookcaseScrollPositions", {}),
    ]);
    shelf.restoreBookcaseState(activeBookcase, bookcaseScrollPositions);
    await customize.applyStoredStyle();
    await refresh();
  } catch (err) {
    shelfRoot.classList.remove("shelf-loading");
    showStatus(`Shelf storage couldn't open: ${err.message || err}`, true);
  }
})();
