// Concurrency-controlled queue for extraction + distillation
(function(){
  const STATUS = {
    PENDING: 'pending',
    EXTRACTING: 'extracting',
    DISTILLING: 'distilling',
    COMPLETED: 'completed',
    ERROR: 'error',
    STOPPED: 'stopped'
  };

  const defaultSettings = {
    ai: {
      mode: '', // none selected by default
      provider: '',
      model: '',
      apiKey: ''
    },
  concurrency: 1,
    theme: localStorage.getItem('dv.theme') || 'system'
  };

  const state = {
    running: false,
  concurrency: 1,
    slots: 0,
    queue: [], // array of item ids in order
    processing: new Set(),
    stopRequested: new Set(),
    settings: defaultSettings
  };

  // Maintain a lightweight localStorage mirror of item ids and counts so UI and storage stay in sync
  function computeCounts(items){
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

  async function syncLocalSummary(itemsArg){
    try {
      const items = itemsArg || await DV.db.getAll('items');
      const ids = items.map(i => i.id);
      const counts = computeCounts(items);
      localStorage.setItem('dv.items.ids', JSON.stringify(ids));
      localStorage.setItem('dv.items.counts', JSON.stringify(counts));
      localStorage.setItem('dv.items.updatedAt', String(Date.now()));
    } catch (e) {
      // best effort; ignore quota or serialization errors
      // Optionally clean up if quota exceeded
      try { if (e && /quota|storage/i.test(String(e))) localStorage.removeItem('dv.items.ids'); } catch {}
    }
  }

  function setSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
    // persist in idb
    DV.db.put('settings', { key: 'app', value: state.settings });
    DV.bus.emit('settings:update', state.settings);
  }

  function getSettings() { return state.settings; }

  async function loadSettings() {
    const s = await DV.db.get('settings', 'app');
    if (s && s.value) {
      state.settings = { ...defaultSettings, ...s.value };
    }
  state.concurrency = Number(state.settings.concurrency || 1);
    DV.bus.emit('settings:update', state.settings);
  }

  // Items lifecycle helpers
  async function addItem(item) {
    const now = Date.now();
    const id = item.id || DV.db.uid();
    const record = {
      id,
      kind: item.kind, // 'url' | 'youtube' | 'file'
      parentId: item.parentId || null,
      title: item.title || item.name || item.url || 'Untitled',
      url: item.url || null,
      fileName: item.fileName || null,
      fileType: item.fileType || null,
      size: item.size || 0,
      hasFile: !!item.file,
      createdAt: now,
      updatedAt: now,
      // playlist is a grouping item; do not enqueue for processing and leave status blank
      status: item.kind === 'playlist' ? null : STATUS.PENDING,
      error: null,
      durationMs: 0,
      queueIndex: state.queue.length,
    };
    await DV.db.put('items', record);
    // Persist file blob if present for later extraction
    if (item.file) {
      try {
        await DV.db.put('contents', { id: id + ':file', blob: item.file, name: item.file.name, type: item.file.type, size: item.file.size });
      } catch (e) { console.warn('Failed to store file blob', e); }
    }
    state.queue.push(id);
    DV.bus.emit('items:added', record);
    // Update localStorage mirror
    syncLocalSummary();
    tick();
    return record;
  }

  async function updateItem(id, patch) {
    const existing = await DV.db.get('items', id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await DV.db.put('items', updated);
    DV.bus.emit('items:updated', updated);
    // Update localStorage mirror
    syncLocalSummary();
    return updated;
  }

  function requestStop(id) {
    state.stopRequested.add(id);
  }

  function setConcurrency(n) {
    state.concurrency = Math.max(1, Math.min(10, Number(n||1)));
    state.settings.concurrency = state.concurrency;
    DV.db.put('settings', { key: 'app', value: state.settings });
    tick();
  }

  async function processOne(id) {
    if (state.processing.has(id)) return;
    state.processing.add(id);

  const start = Date.now();
    let item = await DV.db.get('items', id);
    if (!item) { state.processing.delete(id); return; }

    try {
      if (state.stopRequested.has(id)) throw new Error('Stopped by user');
  // Mark extracting start and reset timers
  item = await updateItem(id, { status: STATUS.EXTRACTING, error: null, startedAt: start, durationMs: 0 });

      // extract
      const extracted = await DV.extractors.extract(item);
      // Update item with extracted title/url ASAP so UI shows the real name
      try {
        const newTitle = extracted?.title || item.title;
        const newUrl = extracted?.url || item.url;
        if (newTitle !== item.title || newUrl !== item.url) {
          item = await updateItem(id, { title: newTitle, url: newUrl });
        }
      } catch (_) { /* non-blocking */ }

      if (state.stopRequested.has(id)) throw new Error('Stopped by user');
      item = await updateItem(id, { status: STATUS.DISTILLING });

  // distill
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

  async function tick() {
    // fill available slots
    const active = state.processing.size;
    const want = Math.max(0, state.concurrency - active);
    if (want <= 0) return;

    // get latest items from db to pick pending
    const items = await DV.db.getAll('items');
    const pending = items
      .filter(i => i.status === STATUS.PENDING && i.kind !== 'playlist')
      .sort((a,b) => (a.queueIndex ?? 0) - (b.queueIndex ?? 0));

    for (const itm of pending.slice(0, want)) {
      processOne(itm.id);
    }
  }

  async function loadQueue() {
    const items = await DV.db.getAll('items');
    state.queue = items.sort((a,b)=> (a.queueIndex??0)-(b.queueIndex??0)).map(i=>i.id);
    DV.bus.emit('items:loaded', items);
    // Ensure localStorage mirror reflects current DB contents
    syncLocalSummary(items);
    tick();
  }

  async function clearAll() {
    const items = await DV.db.getAll('items');
    await Promise.all(items.map(i => DV.db.del('items', i.id)));
    await Promise.all(items.map(i => DV.db.del('contents', i.id)));
    state.queue = [];
    DV.bus.emit('items:loaded', []);
    // Wipe localStorage mirror
    try {
      localStorage.removeItem('dv.items.ids');
      localStorage.setItem('dv.items.counts', JSON.stringify({ total:0, completed:0, inProgress:0, pending:0, extracting:0, distilling:0, errors:0, stopped:0, playlists:0 }));
      localStorage.setItem('dv.items.updatedAt', String(Date.now()));
    } catch {}
  }

  window.DV = window.DV || {};
  window.DV.queue = { STATUS, addItem, updateItem, requestStop, setConcurrency, loadQueue, clearAll, setSettings, loadSettings, getSettings, syncLocalSummary };
})();