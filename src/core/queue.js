
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
      mode: '', 
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
    queue: [], 
    processing: new Set(),
    stopRequested: new Set(),
    settings: defaultSettings
  };

  function setSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
    
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
    tick();
    return record;
  }

  async function updateItem(id, patch) {
    const existing = await DV.db.get('items', id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await DV.db.put('items', updated);
    DV.bus.emit('items:updated', updated);
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
  
  item = await updateItem(id, { status: STATUS.EXTRACTING, error: null, startedAt: start, durationMs: 0 });

  
      const extracted = await DV.extractors.extract(item);
      
      try {
        const newTitle = extracted?.title || item.title;
        const newUrl = extracted?.url || item.url;
        if (newTitle !== item.title || newUrl !== item.url) {
          item = await updateItem(id, { title: newTitle, url: newUrl });
        }
      } catch (_) {  }

      if (state.stopRequested.has(id)) throw new Error('Stopped by user');
      item = await updateItem(id, { status: STATUS.DISTILLING });

  
      const html = await DV.ai.distill(extracted, state.settings.ai);

  const durationMs = Date.now() - (item.startedAt || start);

  
  const stillExists = await DV.db.get('items', id);
  if (!stillExists) {
    return; 
  }

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
    
    const active = state.processing.size;
    const want = Math.max(0, state.concurrency - active);
    if (want <= 0) return;

    
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
    cleanupOrphans();
    tick();
  }

  
  async function cleanupOrphans() {
    try {
      const [items, contents] = await Promise.all([DV.db.getAll('items'), DV.db.getAll('contents')]);
      const ids = new Set(items.map(i => i.id).concat(items.map(i => i.id + ':file')));
      const toDelete = contents.filter(c => !ids.has(c.id)).map(c => DV.db.del('contents', c.id));
      if (toDelete.length) await Promise.allSettled(toDelete);
    } catch {}
  }

  async function clearAll() {
    
    await DV.db.clear('items');
    await DV.db.clear('contents');
    state.queue = [];
    DV.bus.emit('items:loaded', []);
    
    cleanupOrphans();
  }

  window.DV = window.DV || {};
  window.DV.queue = { STATUS, addItem, updateItem, requestStop, setConcurrency, loadQueue, clearAll, setSettings, loadSettings, getSettings, cleanupOrphans };
})();