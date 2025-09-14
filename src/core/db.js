// IndexedDB wrapper for DistyVault
// Stores: items (sources), contents (distilled html/pdf), settings
(function() {
  const DB_NAME = 'distyvault';
  const DB_VER = 1;

  let dbPromise;

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

  function tx(storeNames, mode = 'readonly') {
    return open().then(db => db.transaction(storeNames, mode));
  }

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

  async function get(store, key) {
    const t = await tx([store]);
    return await new Promise((res, rej) => {
      const r = t.objectStore(store).get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }

  async function del(store, key) {
    const t = await tx([store], 'readwrite');
    await new Promise((res, rej) => {
      const r = t.objectStore(store).delete(key);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise(res => t.oncomplete = res);
  }

  async function getAll(store) {
    const t = await tx([store]);
    return await new Promise((res, rej) => {
      const r = t.objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  async function clear(store) {
    const t = await tx([store], 'readwrite');
    await new Promise((res, rej) => {
      const r = t.objectStore(store).clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise(res => t.oncomplete = res);
  }

  async function exportAllToZip() {
    const zip = new JSZip();
    const [items, contents, settings] = await Promise.all([
      getAll('items'), getAll('contents'), getAll('settings')
    ]);
    zip.file('items.json', JSON.stringify(items, null, 2));
    // contents: move blobs into files and write a manifest
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
        contents.push({ ...c, blob });
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

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  window.DV = window.DV || {};
  window.DV.db = { open, put, get, del, getAll, clear, exportAllToZip, importFromZip, uid };
})();
