/* Nth Reader — db.js
 * Minimal promise-based IndexedDB wrapper.
 * Stores:
 *   books    — metadata + original file blob + reading progress + shelf position
 *   decor    — decorative items placed on shelves (bust, globe, plant, candle...)
 *   settings — small global key/value bag (backdrop choice, shelf theme choice)
 */
window.NthDB = (function () {
  const DB_NAME = "nth-reader-db";
  const DB_VERSION = 2;
  const BOOKS = "books";
  const DECOR = "decor";
  const SETTINGS = "settings";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(BOOKS)) {
          const store = db.createObjectStore(BOOKS, { keyPath: "id" });
          store.createIndex("shelfIndex", "shelfIndex");
        }
        if (!db.objectStoreNames.contains(DECOR)) {
          const store = db.createObjectStore(DECOR, { keyPath: "id" });
          store.createIndex("shelfIndex", "shelfIndex");
        }
        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function makeCrud(storeName) {
    return {
      async put(record) {
        const store = await tx(storeName, "readwrite");
        return new Promise((resolve, reject) => {
          const r = store.put(record);
          r.onsuccess = () => resolve(record);
          r.onerror = () => reject(r.error);
        });
      },
      async get(id) {
        const store = await tx(storeName, "readonly");
        return new Promise((resolve, reject) => {
          const r = store.get(id);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => reject(r.error);
        });
      },
      async all() {
        const store = await tx(storeName, "readonly");
        return new Promise((resolve, reject) => {
          const r = store.getAll();
          r.onsuccess = () => resolve(r.result || []);
          r.onerror = () => reject(r.error);
        });
      },
      async remove(id) {
        const store = await tx(storeName, "readwrite");
        return new Promise((resolve, reject) => {
          const r = store.delete(id);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
        });
      },
    };
  }

  const books = makeCrud(BOOKS);
  const decor = makeCrud(DECOR);

  const settings = {
    async get(key, fallback) {
      const store = await tx(SETTINGS, "readonly");
      return new Promise((resolve, reject) => {
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result ? r.result.value : fallback);
        r.onerror = () => reject(r.error);
      });
    },
    async set(key, value) {
      const store = await tx(SETTINGS, "readwrite");
      return new Promise((resolve, reject) => {
        const r = store.put({ key, value });
        r.onsuccess = () => resolve(value);
        r.onerror = () => reject(r.error);
      });
    },
  };

  // Top-level put/get/all/remove keep existing callers (books) working unchanged.
  return { ...books, books, decor, settings };
})();
