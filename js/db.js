/* Nth Reader — durable IndexedDB wrapper.
 * Writes resolve only after the transaction commits. This matters on mobile:
 * request.onsuccess can fire before data is durable, so a quick refresh or
 * file-picker navigation could previously lose the newest shelf state.
 */
window.NthDB = (function () {
  const DB_NAME = "nth-reader-db";
  const DB_VERSION = 4;
  const BOOKS = "books", DECOR = "decor", STACKS = "stacks", SETTINGS = "settings";
  let dbPromise = null;

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
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onblocked = () => reject(new Error("Shelf storage is waiting for an older tab to close."));
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  async function transact(storeName, mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction(storeName, mode, { durability: mode === "readwrite" ? "strict" : "default" });
      } catch (_) {
        // Older WebViews accept only the original two-argument signature.
        transaction = db.transaction(storeName, mode);
      }
      const store = transaction.objectStore(storeName);
      let request;
      try { request = operation(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || request?.error);
      transaction.onabort = () => reject(transaction.error || new Error("Shelf storage transaction was aborted."));
    });
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

  return { ...books, books, decor, stacks, settings, ready: open, requestPersistence };
})();
