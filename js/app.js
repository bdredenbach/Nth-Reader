/* Nth Reader — app.js */
(async function () {
  const shelfRoot = document.getElementById("shelf-root");
  const fileInput = document.getElementById("file-input");
  const importStatus = document.getElementById("import-status");
  const reader = new Reader();

  const shelf = new Shelf(shelfRoot, {
    onOpen: async (id) => {
      const book = await NthDB.get(id);
      if (!book) return;
      try {
        importStatus.textContent = "";
        const content = await NthFormats.load(book.file);
        await reader.open(book, content);
      } catch (err) {
        showStatus(err.message || String(err), true);
      }
    },
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
  });

  const removePanel = new RemovePanel({
    onRemoved: refresh,
  });

  window.addEventListener("nth:reader-closed", refresh);

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    for (const file of files) await addBook(file);
    refresh();
  });

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
        const w = 90, h = Math.round((img.naturalHeight / img.naturalWidth) * w) || 130;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function refresh() {
    const books = await NthDB.all();
    const decorItems = await NthDB.decor.all();
    const stacks = await NthDB.stacks.all();
    shelf.setAll(books, decorItems, stacks);
  }

  await customize.applyStoredStyle();
  refresh();
})();
