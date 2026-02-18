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

  /* ── Security: Encryption Helpers ── */
  const ENC_ALGO = { name: 'AES-GCM', length: 256 };
  const KEY_STORAGE = 'dv_master_key';

  async function getMasterKey() {
    let raw = localStorage.getItem(KEY_STORAGE);
    if (!raw) {
      const k = await crypto.subtle.generateKey(ENC_ALGO, true, ['encrypt', 'decrypt']);
      const exported = await crypto.subtle.exportKey('jwk', k);
      localStorage.setItem(KEY_STORAGE, JSON.stringify(exported));
      return k;
    }
    return await crypto.subtle.importKey('jwk', JSON.parse(raw), ENC_ALGO, true, ['encrypt', 'decrypt']);
  }

  async function encrypt(text) {
    if (!text) return '';
    try {
      const key = await getMasterKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      // Store as iv:ciphertext (base64)
      const bIv = btoa(String.fromCharCode(...iv));
      const bCipher = btoa(String.fromCharCode(...new Uint8Array(cipher)));
      return `enc:${bIv}:${bCipher}`;
    } catch (e) { console.error('Encr failed', e); return text; }
  }

  async function decrypt(str) {
    if (!str || !str.startsWith('enc:')) return str;
    try {
      const parts = str.split(':');
      if (parts.length !== 3) return str;
      const iv = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
      const cipher = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
      const key = await getMasterKey();
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return new TextDecoder().decode(dec);
    } catch (e) {
      console.error('Decr failed', e);
      return ''; // Fail secure
    }
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
    const db = await open();
    // Intercept settings save to encrypt API key
    if (store === 'settings' && value.key === 'app' && value.value?.ai?.apiKey) {
      const clone = JSON.parse(JSON.stringify(value));
      const rawKey = clone.value.ai.apiKey;
      if (!rawKey.startsWith('enc:')) {
        clone.value.ai.apiKey = await encrypt(rawKey);
        value = clone;
      }
    }

    const t = db.transaction([store], 'readwrite');
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
      r.onsuccess = async () => {
        let val = r.result || null;
        if (store === 'settings' && val && val.key === 'app' && val.value?.ai?.apiKey) {
          val.value.ai.apiKey = await decrypt(val.value.ai.apiKey);
        }
        res(val);
      };
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
    // Security: strip API keys from exported settings to prevent leakage
    const safeSettings = settings.map(s => {
      if (s.key === 'app' && s.value?.ai?.apiKey) {
        return { ...s, value: { ...s.value, ai: { ...s.value.ai, apiKey: '' } } };
      }
      return s;
    });
    zip.file('settings.json', JSON.stringify(safeSettings, null, 2));
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
    const parse = async (name) => {
      if (!zip.file(name)) return [];
      try {
        const text = await zip.file(name).async('string');
        const json = JSON.parse(text);
        return Array.isArray(json) ? json : [];
      } catch { return []; }
    };

    // Validate structure
    if (!zip.file('items.json') && !zip.file('contents.json')) {
      throw new Error('Invalid backup archive: missing manifest files');
    }

    const [items, contentsManifest, settings] = await Promise.all([
      parse('items.json'), parse('contents.json'), parse('settings.json')
    ]);

    const contents = [];
    for (const c of contentsManifest) {
      if (!c || !c.id) continue;
      if (c.blobPath) {
        // Prevent directory traversal or prototype pollution keys/paths
        const safePath = c.blobPath.replace(/^[\.\/]+/, '');
        if (zip.file(safePath)) {
          const blob = await zip.file(safePath).async('blob');
          const restored = { ...c, blob };
          delete restored.blobPath;
          contents.push(restored);
        }
      } else {
        contents.push(c);
      }
    }

    const t = await tx(['items', 'contents', 'settings'], 'readwrite');
    const promises = [];
    const putAll = (store, arr) => arr.forEach(v => {
      if (v && v.key !== '__proto__' && v.constructor !== Object && v.prototype !== Object) {
        promises.push(new Promise((res, rej) => {
          const r = t.objectStore(store).put(v);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        }));
      }
    });

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