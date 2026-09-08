/* Nth Reader — app.js */
(async function () {
  const shelfRoot = document.getElementById("shelf-root");
  const fileInput = document.getElementById("file-input");
  const importStatus = document.getElementById("import-status");
  const reader = new Reader();
  let refreshToken = 0;
  shelfRoot.classList.add("shelf-loading");

  const shelf = new Shelf(shelfRoot, {
    onOpen: (id) => openBook(id),
  });

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
      for (let i = 0; i < files.length; i++) {
        showStatus(`Adding ${i + 1} of ${files.length}: "${files[i].name}"…`);
        await addBook(files[i]);
      }
      if (ignored.length) showStatus(`Added ${files.length} item${files.length === 1 ? "" : "s"}; skipped ${ignored.length} unsupported archive entr${ignored.length === 1 ? "y" : "ies"}.`);
      await refresh();
    } catch (error) {
      fileInput.value = "";
      showStatus(`Import stopped: ${error.message || error}. You can try Add Books again without refreshing.`, true);
    }
  });

  async function openBook(id, bookmark = null) {
    const book = await NthDB.get(id);
    if (!book) return;
    try {
      importStatus.textContent = "";
      book.lastReadAt = Date.now();
      await NthDB.put(book);
      const content = await NthFormats.load(book.file);
      await reader.open(book, content, bookmark);
    } catch (err) {
      showStatus(err.message || String(err), true);
    }
  }

  async function addBook(file) {
    try {
      showStatus(`Adding "${file.name}"…`);
      const content = await NthFormats.load(file);
      const book = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: content.title || file.name.replace(/\.[^.]+$/, ""),
        format: NthFormats.extOf(file.name),
        file,
        addedAt: Date.now(),
        shelfIndex: 0,
        slot: Date.now(),
        progress: 0,
      };
      if (content.coverUrl) {
        try {
          book.coverThumb = await makeThumb(await content.coverUrl());
        } catch { /* cover is a nice-to-have; skip silently if it fails */ }
      }
      await NthDB.put(book);
      showStatus("");
    } catch (err) {
      showStatus(`Couldn't add "${file.name}": ${err.message || err}`, true);
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
    const [books, decorItems, stacks] = await Promise.all([
      NthDB.all(), NthDB.decor.all(), NthDB.stacks.all(),
    ]);
    if (token !== refreshToken) return;
    shelf.setAll(books, decorItems, stacks);
    shelfRoot.classList.remove("shelf-loading");
  }

  try {
    await NthDB.ready();
    NthDB.requestPersistence();
    await customize.applyStoredStyle();
    await refresh();
  } catch (err) {
    shelfRoot.classList.remove("shelf-loading");
    showStatus(`Shelf storage couldn't open: ${err.message || err}`, true);
  }
})();
