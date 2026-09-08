/* Nth Reader — durable IndexedDB wrapper.
 * Writes resolve only after the transaction commits. This matters on mobile:
 * request.onsuccess can fire before data is durable, so a quick refresh or
 * file-picker navigation could previously lose the newest shelf state.
 */
window.NthDB = (function () {
  const DB_NAME = "nth-reader-db";
  const DB_VERSION = 5;
  const BOOKS = "books", DECOR = "decor", STACKS = "stacks", SETTINGS = "settings", BOOKMARKS = "bookmarks";
  let dbPromise = null;

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
      try {
        transaction = db.transaction(storeName, mode, { durability: mode === "readwrite" ? "strict" : "default" });
      } catch (error) {
        // Older WebViews accept only the original two-argument signature.
        if (error?.name !== "TypeError") { reject(error); return; }
        try { transaction = db.transaction(storeName, mode); }
        catch (fallbackError) { reject(fallbackError); return; }
      }
      const store = transaction.objectStore(storeName);
      let request;
      try { request = operation(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || request?.error);
      transaction.onabort = () => reject(transaction.error || new Error("Shelf storage transaction was aborted."));
    });
  }

  async function transact(storeName, mode, operation, attempt = 0) {
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
      return transact(storeName, mode, operation, attempt + 1);
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

  const books = makeCrud(BOOKS);
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

  return { ...books, books, decor, stacks, bookmarks, settings, ready: open, requestPersistence };
})();
