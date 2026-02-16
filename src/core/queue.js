(function () {
  /**
   * Queue status codes for items. Only non-playlist items progress through these states.
   */
  const STATUS = {
    PENDING: 'pending',
    EXTRACTING: 'extracting',
    DISTILLING: 'distilling',
    COMPLETED: 'completed',
    ERROR: 'error',
    STOPPED: 'stopped'
  };

  /**
   * Default application settings persisted to IndexedDB and mirrored in memory.
   */
  const defaultSettings = {
    ai: {
      mode: '',
      model: '',
      apiKey: ''
    },
    concurrency: 1,
    theme: localStorage.getItem('dv.theme') || 'system'
  };

  /**
   * In-memory queue and runtime state. `processing` tracks currently active item IDs to
   * avoid duplicate work; `stopRequested` is an advisory set to abort politely.
   */
  const state = {
    concurrency: 1,
    queue: [],
    processing: new Set(),
    stopRequested: new Set(),
    settings: defaultSettings
  };

  /**
   * Compute aggregate counts for UI summary and quick metrics.
   * Playlists are counted separately and excluded from progress states.
   * @param {Array<any>} items
   * @returns {{total:number,completed:number,inProgress:number,pending:number,extracting:number,distilling:number,errors:number,stopped:number,playlists:number}}
   */
  function computeCounts(items) {
    const c = { total: 0, completed: 0, inProgress: 0, pending: 0, extracting: 0, distilling: 0, errors: 0, stopped: 0, playlists: 0 };
    for (const it of items) {
      c.total++;
      if (it.kind === 'playlist') { c.playlists++; continue; }
      switch (it.status) {
        case STATUS.COMPLETED: c.completed++; break;
        case STATUS.PENDING: c.pending++; c.inProgress++; break;
        case STATUS.EXTRACTING: c.extracting++; c.inProgress++; break;
        case STATUS.DISTILLING: c.distilling++; c.inProgress++; break;
        case STATUS.ERROR: c.errors++; break;
        case STATUS.STOPPED: c.stopped++; break;
      }
    }
    return c;
  }

  /**
   * Persist a lightweight summary to localStorage for quick dashboard reads without
   * hitting IndexedDB, handling quota failures gracefully.
   * @param {Array<any>} [itemsArg]
   */
  async function syncLocalSummary(itemsArg) {
    try {
      const items = itemsArg || await DV.db.getAll('items');
      const ids = items.map(i => i.id);
      const counts = computeCounts(items);
      localStorage.setItem('dv.items.ids', JSON.stringify(ids));
      localStorage.setItem('dv.items.counts', JSON.stringify(counts));
      localStorage.setItem('dv.items.updatedAt', String(Date.now()));
    } catch (e) {
      try { if (e && /quota|storage/i.test(String(e))) localStorage.removeItem('dv.items.ids'); } catch { }
    }
  }

  /** Update settings both in memory and durable storage, and notify listeners. */
  function setSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
    DV.db.put('settings', { key: 'app', value: state.settings });
    DV.bus.emit('settings:update', state.settings);
  }

  /** Get the current effective settings. */
  function getSettings() { return state.settings; }

  /**
   * Load persisted settings at startup and emit an update. Normalizes concurrency.
   */
  async function loadSettings() {
    const s = await DV.db.get('settings', 'app');
    if (s && s.value) {
      state.settings = { ...defaultSettings, ...s.value };
    }
    state.concurrency = Number(state.settings.concurrency || 1);
    DV.bus.emit('settings:update', state.settings);
  }

  /**
   * Enqueue a new item and persist it. For file-backed items, stores the Blob under
   * contents with an id-suffixed key. Emits items:added and kicks the scheduler.
   * @param {{id?:string,kind:string,parentId?:string,title?:string,name?:string,url?:string,file?:File,fileName?:string,fileType?:string,size?:number}} item
   * @returns {Promise<any>}
   */
  async function addItem(item) {
    const now = Date.now();
    const id = item.id || DV.db.uid();
    const record = {
      id,
      kind: item.kind,
      parentId: item.parentId || null,
      title: item.title || item.name || item.url || 'Untitled',
      url: item.url || null,
      fileName: item.fileName || null,
      fileType: item.fileType || null,
      size: item.size || 0,
      hasFile: !!item.file,
      createdAt: now,
      updatedAt: now,
      status: item.kind === 'playlist' ? null : STATUS.PENDING,
      error: null,
      durationMs: 0,
      queueIndex: state.queue.length,
    };
    await DV.db.put('items', record);
    if (item.file) {
      try {
        await DV.db.put('contents', { id: id + ':file', blob: item.file, name: item.file.name, type: item.file.type, size: item.file.size });
      } catch (e) { console.warn('Failed to store file blob', e); }
    }
    state.queue.push(id);
    DV.bus.emit('items:added', record);
    syncLocalSummary();
    tick();
    return record;
  }

  /**
   * Patch an existing item atomically and emit an update.
   * @param {string} id
   * @param {object} patch
   * @returns {Promise<any|undefined>}
   */
  async function updateItem(id, patch) {
    const existing = await DV.db.get('items', id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await DV.db.put('items', updated);
    DV.bus.emit('items:updated', updated);
    syncLocalSummary();
    return updated;
  }

  /**
   * Request graceful stop for a specific item. The request is honored at safe points
   * in the pipeline (between extract/distill).
   * @param {string} id
   */
  function requestStop(id) {
    state.stopRequested.add(id);
    // Immediately update item status to STOPPED for UI feedback
    updateItem(id, { status: STATUS.STOPPED });
    DV.bus.emit('queue:progress');
  }

  /**
   * Adjust concurrency (1..10), persist the new value, and prompt the scheduler.
   * @param {number} n
   */
  function setConcurrency(n) {
    state.concurrency = Math.max(1, Math.min(10, Number(n || 1)));
    state.settings.concurrency = state.concurrency;
    DV.db.put('settings', { key: 'app', value: state.settings });
    tick();
  }

  /**
   * Process a single item through extract → distill, handling user stop requests and
   * error capture. Always emits progress and schedules the next tick on completion.
   * @param {string} id
   */
  async function processOne(id) {
    if (state.processing.has(id)) return;
    state.processing.add(id);

    const start = Date.now();
    let item = await DV.db.get('items', id);
    if (!item) { state.processing.delete(id); return; }

    try {
      if (state.stopRequested.has(id)) throw new Error('Stopped by user');
      item = await updateItem(id, { status: STATUS.EXTRACTING, error: null, startedAt: start, durationMs: 0 });

      const extracted = await DV.extractors.extract(item);
      try {
        const newTitle = extracted?.title || item.title;
        const newUrl = extracted?.url || item.url;
        if (newTitle !== item.title || newUrl !== item.url) {
          item = await updateItem(id, { title: newTitle, url: newUrl });
        }
      } catch (_) { /* non-blocking */ }

      if (state.stopRequested.has(id)) throw new Error('Stopped by user');
      item = await updateItem(id, { status: STATUS.DISTILLING });
      const html = await DV.ai.distill(extracted, state.settings.ai);

      const durationMs = Date.now() - (item.startedAt || start);

      await DV.db.put('contents', { id, html, meta: { ...extracted, durationMs } });
      await updateItem(id, { status: STATUS.COMPLETED, durationMs });
    } catch (err) {
      const durationMs = Date.now() - (item.startedAt || start);
      await updateItem(id, { status: state.stopRequested.has(id) ? STATUS.STOPPED : STATUS.ERROR, error: String(err?.message || err), durationMs });
    } finally {
      state.processing.delete(id);
      state.stopRequested.delete(id);
      DV.bus.emit('queue:progress');
      tick();
    }
  }

  /**
   * Scheduler: fills available concurrency slots with oldest pending items.
   */
  async function tick() {
    const active = state.processing.size;
    const want = Math.max(0, state.concurrency - active);
    if (want <= 0) return;

    const items = await DV.db.getAll('items');
    const pending = items
      .filter(i => i.status === STATUS.PENDING && i.kind !== 'playlist')
      .sort((a, b) => (a.queueIndex ?? 0) - (b.queueIndex ?? 0));

    for (const itm of pending.slice(0, want)) {
      processOne(itm.id);
    }
  }

  /**
   * Load items, rebuild the in-memory queue order, notify listeners, and schedule work.
   */
  async function loadQueue() {
    const items = await DV.db.getAll('items');
    state.queue = items.sort((a, b) => (a.queueIndex ?? 0) - (b.queueIndex ?? 0)).map(i => i.id);
    DV.bus.emit('items:loaded', items);
    syncLocalSummary(items);
    tick();
  }

  /**
   * Clear all items and contents from storage, reset local summary, and notify listeners.
   */
  async function clearAll() {
    const items = await DV.db.getAll('items');
    await Promise.all(items.map(i => DV.db.del('items', i.id)));
    await Promise.all(items.flatMap(i => [DV.db.del('contents', i.id), DV.db.del('contents', i.id + ':file')]));
    state.queue = [];
    DV.bus.emit('items:loaded', []);
    try {
      localStorage.removeItem('dv.items.ids');
      localStorage.setItem('dv.items.counts', JSON.stringify({ total: 0, completed: 0, inProgress: 0, pending: 0, extracting: 0, distilling: 0, errors: 0, stopped: 0, playlists: 0 }));
      localStorage.setItem('dv.items.updatedAt', String(Date.now()));
    } catch { }
  }

  window.DV = window.DV || {};
  window.DV.queue = { STATUS, addItem, updateItem, requestStop, setConcurrency, loadQueue, clearAll, setSettings, loadSettings, getSettings, syncLocalSummary };
})();