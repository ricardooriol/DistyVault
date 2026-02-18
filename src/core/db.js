(function () {
  /**
   * IndexedDB utility module providing a simple CRUD API and import/export helpers
   * for DistyVault data. Encapsulates database versioning, object stores, and
   * schema initialization. All methods return Promises and are safe to call from
   * the main thread.
   */
  const DB_NAME = 'distyvault';
  const DB_VER = 1;

  let dbPromise;

  /**
   * Open (and lazily initialize) the IndexedDB database. Reuses a shared promise
   * to ensure at-most-one open sequence is active and to avoid races.
   *
   * Stores:
   * - items: primary entity list, keyPath 'id'; indexes by status, createdAt, title.
   * - contents: HTML/files associated with items, keyPath 'id'.
   * - settings: application settings, keyPath 'key'.
   *
   * @returns {Promise<IDBDatabase>}
   */
  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('items')) {
            const s = db.createObjectStore('items', { keyPath: 'id' });
            s.createIndex('by_status', 'status', { unique: false });
            s.createIndex('by_created', 'createdAt', { unique: false });
            s.createIndex('by_title', 'title', { unique: false });
          }
          if (!db.objectStoreNames.contains('contents')) {
            db.createObjectStore('contents', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  /**
   * Start a transaction over one or more stores.
   * @param {string[]} storeNames
   * @param {'readonly'|'readwrite'} [mode='readonly']
   * @returns {Promise<IDBTransaction>}
   */
  function tx(storeNames, mode = 'readonly') {
    return open().then(db => db.transaction(storeNames, mode));
  }

  /**
   * Upsert a value into a store by keyPath.
   * Resolves when the transaction completes to ensure durability.
   * @template T
   * @param {string} store
   * @param {T} value
   * @returns {Promise<T>}
   */
  async function put(store, value) {
    const t = await tx([store], 'readwrite');
    await new Promise((res, rej) => {
      const r = t.objectStore(store).put(value);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise(res => t.oncomplete = res);
    return value;
  }

  /**
   * Retrieve a single value by key from a store.
   * @param {string} store
   * @param {IDBValidKey} key
   * @returns {Promise<any|null>}
   */
  async function get(store, key) {
    const t = await tx([store]);
    return await new Promise((res, rej) => {
      const r = t.objectStore(store).get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }

  /**
   * Delete a single record by key.
   * Resolves when the transaction completes.
   * @param {string} store
   * @param {IDBValidKey} key
   * @returns {Promise<void>}
   */
  async function del(store, key) {
    const t = await tx([store], 'readwrite');
    await new Promise((res, rej) => {
      const r = t.objectStore(store).delete(key);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise(res => t.oncomplete = res);
  }

  /**
   * Retrieve all records from a store.
   * @param {string} store
   * @returns {Promise<any[]>}
   */
  async function getAll(store) {
    const t = await tx([store]);
    return await new Promise((res, rej) => {
      const r = t.objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  /**
   * Export all stores into a ZIP archive. Large binary blobs from 'contents' are written
   * as separate files under blobs/ and referenced in contents.json via blobPath; the
   * JSON manifest omits the blob object to keep the metadata light.
   * @returns {Promise<Blob>} A ZIP file Blob suitable for download.
   */
  async function exportAllToZip() {
    const zip = new JSZip();
    const [items, contents, settings] = await Promise.all([
      getAll('items'), getAll('contents'), getAll('settings')
    ]);
    zip.file('items.json', JSON.stringify(items, null, 2));
    const manifest = [];
    for (const c of contents) {
      const entry = { ...c };
      if (c.blob) {
        const path = `blobs/${c.id}.bin`;
        manifest.push({ ...entry, blob: undefined, blobPath: path });
        zip.file(path, c.blob);
      } else {
        manifest.push(entry);
      }
    }
    zip.file('contents.json', JSON.stringify(manifest, null, 2));
    zip.file('settings.json', JSON.stringify(settings, null, 2));
    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Import a ZIP previously exported by exportAllToZip(). Recreates records across
   * items/contents/settings and reattaches Blob data from blobs/ entries.
   * The import is executed in a single readwrite transaction to maintain consistency.
   * @param {Blob|ArrayBuffer} file ZIP archive
   * @returns {Promise<void>}
   */
  async function importFromZip(file) {
    const zip = await JSZip.loadAsync(file);
    const parse = async (name) => zip.file(name) ? JSON.parse(await zip.file(name).async('string')) : [];
    const [items, contentsManifest, settings] = await Promise.all([
      parse('items.json'), parse('contents.json'), parse('settings.json')
    ]);

    const contents = [];
    for (const c of contentsManifest) {
      if (c.blobPath && zip.file(c.blobPath)) {
        const blob = await zip.file(c.blobPath).async('blob');
        const restored = { ...c, blob };
        delete restored.blobPath;
        contents.push(restored);
      } else {
        contents.push(c);
      }
    }

    const t = await tx(['items', 'contents', 'settings'], 'readwrite');
    const promises = [];
    const putAll = (store, arr) => arr.forEach(v => promises.push(new Promise((res, rej) => {
      const r = t.objectStore(store).put(v);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    })));
    putAll('items', items);
    putAll('contents', contents);
    putAll('settings', settings);
    await Promise.all(promises);
    await new Promise(res => t.oncomplete = res);
  }

  /**
   * Generate a compact unique id suitable as a keyPath for IndexedDB records.
   * Combines a random base36 suffix with a base36 timestamp to minimize collision risk.
   * @returns {string}
   */
  function uid() {
    return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  window.DV = window.DV || {};
  window.DV.db = { open, put, get, del, getAll, exportAllToZip, importFromZip, uid };
})();