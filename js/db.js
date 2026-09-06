/* Nth Reader — db.js
 * Minimal promise-based IndexedDB wrapper.
 * Stores: books (metadata + original file blob + reading progress + shelf position)
 */
window.NthDB = (function () {
  const DB_NAME = "nth-reader-db";
  const DB_VERSION = 1;
  const STORE = "books";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("shelfIndex", "shelfIndex");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode) {
    const db = await open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  return {
    async put(book) {
      const store = await tx("readwrite");
      return new Promise((resolve, reject) => {
        const r = store.put(book);
        r.onsuccess = () => resolve(book);
        r.onerror = () => reject(r.error);
      });
    },
    async get(id) {
      const store = await tx("readonly");
      return new Promise((resolve, reject) => {
        const r = store.get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    },
    async all() {
      const store = await tx("readonly");
      return new Promise((resolve, reject) => {
        const r = store.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    },
    async remove(id) {
      const store = await tx("readwrite");
      return new Promise((resolve, reject) => {
        const r = store.delete(id);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    },
  };
})();
