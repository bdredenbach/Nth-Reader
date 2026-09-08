/* Nth Reader — durable IndexedDB wrapper.
 * Writes resolve only after the transaction commits. This matters on mobile:
 * request.onsuccess can fire before data is durable, so a quick refresh or
 * file-picker navigation could previously lose the newest shelf state.
 */
window.NthDB = (function () {
  const DB_NAME = "nth-reader-db";
  const DB_VERSION = 6;
  const BOOKS = "books", BOOK_FILES = "book-files", DECOR = "decor", STACKS = "stacks", SETTINGS = "settings", BOOKMARKS = "bookmarks";
  let dbPromise = null;
  const pendingWrites = new Set();

  const connectionChanged = (error) =>
    error?.name === "InvalidStateError" || /connection is (closing|closed)|database connection is closing/i.test(error?.message || "");

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of [BOOKS, DECOR, STACKS]) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: "id" });
            store.createIndex("shelfIndex", "shelfIndex");
          }
        }
        if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "key" });
        if (!db.objectStoreNames.contains(BOOKMARKS)) {
          const store = db.createObjectStore(BOOKMARKS, { keyPath: "id" });
          store.createIndex("bookId", "bookId");
          store.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains(BOOK_FILES)) {
          db.createObjectStore(BOOK_FILES, { keyPath: "id" });
        }

        // V-0.05 and earlier stored the source File inside each shelf record.
        // Reading or updating shelf metadata therefore cloned a 700-page CBZ
        // even when the UI only needed its title and position. Move those
        // heavyweight values into their own store once during this upgrade.
        if (req.oldVersion < 6 && db.objectStoreNames.contains(BOOKS)) {
          const transaction = req.transaction;
          const bookStore = transaction.objectStore(BOOKS);
          const fileStore = transaction.objectStore(BOOK_FILES);
          const cursorRequest = bookStore.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const book = cursor.value;
            if (book?.file) {
              const source = book.file;
              fileStore.put({ id: book.id, file: source });
              book.fileName ||= source.name || `${book.title || "book"}.${book.format || "bin"}`;
              book.fileType ||= source.type || "";
              book.fileSize ||= source.size || 0;
              delete book.file;
              cursor.update(book);
            }
            cursor.continue();
          };
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          // Another tab/build is upgrading the schema. Release this handle and
          // make the next operation open the upgraded database automatically.
          dbPromise = null;
          db.close();
        };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      req.onblocked = () => {
        dbPromise = null;
        reject(new Error("Shelf storage is waiting for an older tab to close."));
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  async function transactOnce(db, storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      let transaction;
      const storeNames = Array.isArray(storeName) ? storeName : [storeName];
      try {
        transaction = db.transaction(storeNames, mode, { durability: mode === "readwrite" ? "strict" : "default" });
      } catch (error) {
        // Older WebViews accept only the original two-argument signature.
        if (error?.name !== "TypeError") { reject(error); return; }
        try { transaction = db.transaction(storeNames, mode); }
        catch (fallbackError) { reject(fallbackError); return; }
      }
      const store = storeNames.length === 1 ? transaction.objectStore(storeNames[0]) : null;
      let request;
      try { request = operation(store, transaction); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || request?.error);
      transaction.onabort = () => reject(transaction.error || new Error("Shelf storage transaction was aborted."));
    });
  }

  async function transactInternal(storeName, mode, operation, attempt = 0) {
    const db = await open();
    try {
      return await transactOnce(db, storeName, mode, operation);
    } catch (error) {
      if (!connectionChanged(error) || attempt >= 3) throw error;
      // A service-worker reload or another tab can close the handle between
      // open() resolving and transaction() starting. Reopen instead of leaving
      // every drawer/import action broken until a manual refresh.
      dbPromise = null;
      try { db.close(); } catch (_) { /* already closed */ }
      await new Promise((resolve) => setTimeout(resolve, 45 * (attempt + 1)));
      return transactInternal(storeName, mode, operation, attempt + 1);
    }
  }

  function transact(storeName, mode, operation) {
    const work = transactInternal(storeName, mode, operation);
    if (mode === "readwrite") {
      pendingWrites.add(work);
      work.then(
        () => pendingWrites.delete(work),
        () => pendingWrites.delete(work),
      );
    }
    return work;
  }

  async function flush() {
    // A drag/slider handler intentionally does not block the UI while saving.
    // Before a refresh reads the shelf back, wait for every queued write so an
    // older persisted arrangement cannot visibly replace the newest one.
    while (pendingWrites.size) {
      await Promise.allSettled(Array.from(pendingWrites));
    }
  }

  function makeCrud(storeName) {
    return {
      async put(record) { await transact(storeName, "readwrite", (store) => store.put(record)); return record; },
      async get(id) { return (await transact(storeName, "readonly", (store) => store.get(id))) || null; },
      async all() { return (await transact(storeName, "readonly", (store) => store.getAll())) || []; },
      async remove(id) { await transact(storeName, "readwrite", (store) => store.delete(id)); },
    };
  }

  const bookMetaCrud = makeCrud(BOOKS);
  const fileCrud = makeCrud(BOOK_FILES);
  const books = {
    ...bookMetaCrud,
    async put(record) {
      const metadata = { ...record };
      const source = metadata.file;
      delete metadata.file;
      if (source) {
        metadata.fileName ||= source.name || `${metadata.title || "book"}.${metadata.format || "bin"}`;
        metadata.fileType ||= source.type || "";
        metadata.fileSize ||= source.size || 0;
        await transact([BOOKS, BOOK_FILES], "readwrite", (_, transaction) => {
          transaction.objectStore(BOOK_FILES).put({ id: metadata.id, file: source });
          return transaction.objectStore(BOOKS).put(metadata);
        });
      } else {
        await bookMetaCrud.put(metadata);
      }
      return metadata;
    },
    async getFile(id) {
      return (await fileCrud.get(id))?.file || null;
    },
    async getWithFile(id) {
      const [metadata, source] = await Promise.all([bookMetaCrud.get(id), fileCrud.get(id)]);
      return metadata ? { ...metadata, file: source?.file || null } : null;
    },
    async remove(id) {
      await transact([BOOKS, BOOK_FILES], "readwrite", (_, transaction) => {
        transaction.objectStore(BOOK_FILES).delete(id);
        return transaction.objectStore(BOOKS).delete(id);
      });
    },
  };

  async function saveArrangement({ books: changedBooks = [], stacksToPut = [], stackIdsToRemove = [] } = {}) {
    await transact([BOOKS, STACKS], "readwrite", (_, transaction) => {
      const bookStore = transaction.objectStore(BOOKS);
      const stackStore = transaction.objectStore(STACKS);
      changedBooks.forEach((book) => {
        const metadata = { ...book };
        delete metadata.file;
        bookStore.put(metadata);
      });
      stacksToPut.forEach((stack) => stackStore.put(stack));
      let lastRequest = null;
      stackIdsToRemove.forEach((id) => { lastRequest = stackStore.delete(id); });
      return lastRequest;
    });
  }
  const decor = makeCrud(DECOR);
  const stacks = makeCrud(STACKS);
  const bookmarkCrud = makeCrud(BOOKMARKS);
  const bookmarks = {
    ...bookmarkCrud,
    async forBook(bookId) {
      return (await transact(BOOKMARKS, "readonly", (store) => store.index("bookId").getAll(bookId))) || [];
    },
  };
  const settings = {
    async get(key, fallback) {
      const record = await transact(SETTINGS, "readonly", (store) => store.get(key));
      return record ? record.value : fallback;
    },
    async set(key, value) {
      await transact(SETTINGS, "readwrite", (store) => store.put({ key, value }));
      return value;
    },
  };

  async function requestPersistence() {
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch (_) { /* persistence is a best-effort browser capability */ }
    return false;
  }

  return { ...books, books, decor, stacks, bookmarks, settings, saveArrangement, flush, ready: open, requestPersistence };
})();
