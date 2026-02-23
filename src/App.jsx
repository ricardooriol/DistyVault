/**
 * DistyVault — React application shell and UI logic.
 * No-build, client-side only architecture.
 *
 * Responsibilities:
 * - Application state management (items, settings, selection).
 * - UI Orchestration (TopBar, Capture, Stats, Table, Modals).
 * - Process coordination (bulk retry/stop, export/import).
 * - Theme and standard utility propagation.
 */
const { useState, useEffect, useMemo, useRef } = React;
const { classNames, yieldToBrowser, saveBlob, formatDuration, sanitizeFilename } = DV.utils;
const STATUS = DV.queue.STATUS;

// --- Sub-components (Generic UI) ---

/** Standard Icon component wrapping Lucide/Feather */
function Icon({ name, size = 20, className, strokeWidth = 2 }) {
  const wrapRef = useRef(null);
  useEffect(() => {
    try {
      const wrap = wrapRef.current;
      if (!wrap) return;
      wrap.innerHTML = `<i data-lucide="${name}" style="width:100%;height:100%;display:block" aria-hidden="true"></i>`;
      if (window.lucide?.createIcons) {
        window.lucide.createIcons({ attrs: { 'stroke-width': String(strokeWidth) } });
      } else if (window.feather?.replace) {
        wrap.firstChild.setAttribute('data-feather', name);
        window.feather.replace({ 'stroke-width': strokeWidth });
      }
      const svg = wrap.querySelector('svg');
      if (svg) {
        Object.assign(svg.style, { width: size + 'px', height: size + 'px', display: 'block' });
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
      }
    } catch { }
  }, [name, size, strokeWidth]);
  return <span ref={wrapRef} className={classNames('dv-icon pointer-events-none inline-flex items-center justify-center', className)} style={{ width: size, height: size }} />;
}

/** Standard Modal component */
function Modal({ open, onClose, title, children, hideHeader }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative max-w-3xl w-full p-6 sm:p-8 rounded-[2rem] border border-slate-200/50 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in duration-300">
        {!hideHeader && (
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</h3>
            <button onClick={onClose} className="p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors"><Icon name="x" size={24} /></button>
          </div>
        )}
        {hideHeader && (
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur z-50 shadow-sm border border-slate-200 dark:border-white/10 hover:scale-110 transition-all">
            <Icon name="x" size={24} />
          </button>
        )}
        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

/** Status badge with distinct branding */
function StatusChip({ status, onClick }) {
  const map = {
    [STATUS.PENDING]: 'bg-slate-100 text-slate-500 border-slate-200',
    [STATUS.EXTRACTING]: 'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-900/10 dark:text-brand-400 dark:border-brand-800/30',
    [STATUS.DISTILLING]: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/10 dark:text-indigo-400 dark:border-indigo-800/30',
    [STATUS.COMPLETED]: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30 font-bold',
    [STATUS.ERROR]: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-800/30',
    [STATUS.STOPPED]: 'bg-slate-100 text-slate-400 border-slate-200 animate-pulse'
  };
  return (
    <span onClick={onClick} className={classNames('px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-[0.1em] border transition-all cursor-default select-none shadow-sm', map[status] || 'bg-slate-100')}>
      {status}
    </span>
  );
}

// --- Layout Fragments ---

function TopBar({ theme, setTheme, openSettings }) {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <nav className="sticky top-0 z-40 glass bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <img src={isDark ? 'logos/logo_no_bg_w.png' : 'logos/logo_no_bg_w.png'} className="w-7 h-7" alt="Logo" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white leading-none">DISTYVAULT</h1>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 uppercase font-bold tracking-[0.2em]">Inference Powered Repository</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-800 hover:scale-110 active:scale-95 transition-all shadow-sm">
            <Icon name={isDark ? 'sun' : 'moon'} size={20} />
          </button>
          <button onClick={openSettings} className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-800 hover:scale-110 active:scale-95 transition-all shadow-sm">
            <Icon name="settings" size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}

function CapturePanel({ onSubmit }) {
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState([]);
  const dropRef = useRef(null);

  const submit = async () => {
    const u = url.trim();
    if (!u && !files.length) return;
    await onSubmit(u, files);
    setUrl(''); setFiles([]);
  };

  const onDrop = (e) => { e.preventDefault(); setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); onLeave(); };
  const onOver = (e) => { e.preventDefault(); dropRef.current?.classList.add('ring-4', 'ring-brand-500/20', 'bg-brand-500/5'); };
  const onLeave = () => dropRef.current?.classList.remove('ring-4', 'ring-brand-500/20', 'bg-brand-500/5');

  return (
    <section ref={dropRef} onDrop={onDrop} onDragOver={onOver} onDragLeave={onLeave} className="max-w-6xl mx-auto mt-8 p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-800/20 glass transition-all shadow-xl shadow-slate-200/20 dark:shadow-none">
      <div className="flex gap-4 flex-wrap sm:flex-nowrap">
        <div className="flex-1 min-w-0 relative group">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Capture URL, YouTube Video or Playlist..."
            className="w-full h-14 pl-14 pr-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 focus:ring-4 focus:ring-brand-500/20 outline-none text-slate-900 dark:text-white font-medium transition-all group-hover:border-slate-300 dark:group-hover:border-white/20"
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-600 dark:text-brand-400"><Icon name="globe" size={24} /></div>
        </div>
        <div className="flex gap-3">
          <label className="h-14 w-14 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 hover:scale-105 transition-all shadow-sm">
            <input type="file" multiple className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
            <Icon name="upload-cloud" size={24} className="text-slate-400" />
          </label>
          <button onClick={submit} className="h-14 px-8 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black tracking-widest uppercase text-xs shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
            <Icon name="zap" size={20} className="fill-current" />
            <span>Process</span>
          </button>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {files.map((f, i) => (
            <div key={i} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-black/20 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-3 border border-slate-200 dark:border-white/5 group">
              <Icon name="file-text" size={14} className="opacity-50" />
              <span className="truncate max-w-[150px]">{f.name}</span>
              <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500 transition-colors"><Icon name="trash-2" size={14} /></button>
            </div>
          ))}
          <button onClick={() => setFiles([])} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all ml-auto">Clear Queue</button>
        </div>
      )}
    </section>
  );
}

// --- Refined Logic Helpers ---

const pdfFileName = (title) => `${sanitizeFilename(title || 'distilled_result')}.pdf`;

async function makePdfBlobFromHtml(html, title = 'DistyVault Result') {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return new Blob([html], { type: 'text/html' });

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const points = (window.DV && DV.parseFormattedPoints) ? DV.parseFormattedPoints(html) : null;
  const rawText = points ? '' : html.replace(/<[^>]+>/g, ' ').trim();
  const margin = 50, pw = doc.internal.pageSize.getWidth(), mw = pw - margin * 2;

  // Header
  doc.setFillColor(79, 70, 229); // brand-600
  doc.rect(0, 0, pw, 80, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold').setFontSize(24).text(title.slice(0, 40), margin, 50);

  let y = 130;
  doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(40);

  if (points) {
    for (const p of points) {
      if (y > 750) { doc.addPage(); y = 60; }
      doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(79, 70, 229).text(p.head, margin, y); y += 22;
      doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(60);
      for (const para of p.paras) {
        const lines = doc.splitTextToSize(para, mw);
        for (const l of lines) {
          if (y > 780) { doc.addPage(); y = 60; }
          doc.text(l, margin, y); y += 16;
        }
        y += 10;
      }
      y += 15;
    }
  } else {
    const lines = doc.splitTextToSize(rawText, mw);
    for (const l of lines) {
      if (y > 780) { doc.addPage(); y = 60; }
      doc.text(l, margin, y); y += 16;
    }
  }

  // Footer on last page
  doc.setFontSize(9).setTextColor(160).text(`Generated by DistyVault · ${new Date().toLocaleDateString()}`, margin, doc.internal.pageSize.getHeight() - 40);

  return doc.output('blob');
}

// --- Main Application ---

function App() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(localStorage.getItem('dv.sort') || 'queue');
  const [theme, setThemeState] = useState(localStorage.getItem('dv.theme') || 'system');
  const [viewItem, setViewItem] = useState(null);
  const [errorItem, setErrorItem] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ ai: { mode: '', model: '', apiKey: '' }, concurrency: 1 });
  const [tagFilter, setTagFilter] = useState('');
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [contentIndex, setContentIndex] = useState(new Map());
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Initialization & Centralized Sync
  useEffect(() => {
    const refresh = async () => setItems(await DV.db.getAll('items'));
    const off1 = DV.bus.on('items:loaded', (loaded) => setItems(loaded));
    const off2 = DV.bus.on('items:added', refresh);
    const off3 = DV.bus.on('items:updated', refresh);
    const off4 = DV.bus.on('ui:openError', setErrorItem);

    DV.queue.loadSettings().then(() => setSettings(DV.queue.getSettings()));
    DV.queue.loadQueue();

    return () => { off1(); off2(); off3(); off4(); };
  }, []);

  // Theme Core
  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('dv.theme', t);
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    window.postMessage({ type: 'dv-theme', isDark }, '*');
    document.querySelectorAll('iframe').forEach(fr => { try { fr.contentWindow.postMessage({ type: 'dv-theme', isDark }, '*'); } catch { } });
  };

  // searchable index (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      const contents = await DV.db.getAll('contents');
      const idx = new Map();
      contents.forEach(c => {
        if (c.html && !c.id.endsWith(':file')) {
          const cleanText = c.html.replace(/<[^>]+>/g, ' ').toLowerCase().slice(0, 8000);
          idx.set(c.id, cleanText);
        }
      });
      setContentIndex(idx);
    }, 1200);
    return () => clearTimeout(t);
  }, [items.length]);

  // Derived: Filtering & Sorting
  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const filteredSortedItems = useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter(i => {
        if (filter !== 'all' && i.kind !== filter && !(filter === 'youtube' && i.kind === 'playlist')) return false;
        if (tagFilter && !(i.tags || []).includes(tagFilter)) return false;
        if (!q) return true;
        const bodyMatch = contentIndex.get(i.id)?.includes(q);
        return i.title?.toLowerCase().includes(q) || i.url?.toLowerCase().includes(q) || i.fileName?.toLowerCase().includes(q) || bodyMatch;
      })
      .sort((a, b) => {
        if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
        if (sort === 'status') return (a.status || '').localeCompare(b.status || '');
        if (sort === 'duration') return (a.durationMs || 0) - (b.durationMs || 0);
        if (sort === 'queue') return (a.queueIndex || 0) - (b.queueIndex || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [items, filter, tagFilter, search, sort, contentIndex]);

  // Visibility: Flat View with Grouped Children
  const displayItems = useMemo(() => {
    const out = [];
    const parents = filteredSortedItems.filter(i => !i.parentId);
    const children = filteredSortedItems.filter(i => i.parentId);
    parents.forEach(p => {
      out.push(p);
      if (expandedIds.has(p.id)) {
        children.filter(c => c.parentId === p.id).forEach(c => out.push(c));
      }
    });
    return out;
  }, [filteredSortedItems, expandedIds]);

  // Feature Handlers
  const handleCapture = async (url, files) => {
    try {
      if (url) {
        const isPl = DV.extractors.isYouTubePlaylist?.(url);
        if (isPl) {
          const pl = await DV.extractors.extractYouTubePlaylist(url);
          const parent = await DV.queue.addItem({ kind: 'playlist', url, title: pl.title });
          for (const v of pl.items.slice(0, 100)) await DV.queue.addItem({ kind: 'youtube', url: v.url, title: v.title, parentId: parent.id });
        } else {
          const kind = DV.extractors.isYouTube?.(url) ? 'youtube' : 'url';
          const rec = await DV.queue.addItem({ kind, url, title: url });
          const peek = kind === 'youtube' ? await DV.extractors.peekYouTubeTitle?.(url) : await DV.extractors.peekTitle?.(url);
          if (peek?.title) await DV.queue.updateItem(rec.id, { title: peek.title, url: peek.url || url });
        }
      }
      for (const f of files) await DV.queue.addItem({ kind: 'file', title: f.name, file: f, fileName: f.name, size: f.size, fileType: f.type });
      DV.toast('Added to Vault Queue', { type: 'success' });
    } catch (e) { DV.toast(e.message, { type: 'error' }); }
  };

  const handleDownloadBulk = async (ids) => {
    const targets = items.filter(i => ids.includes(i.id) && i.status === STATUS.COMPLETED);
    if (!targets.length) return;
    const zip = targets.length > 1 ? new JSZip() : null;
    for (const it of targets) {
      await yieldToBrowser();
      const content = await DV.db.get('contents', it.id);
      if (content?.html) {
        const blob = await makePdfBlobFromHtml(content.html, it.title);
        if (zip) zip.file(pdfFileName(it.title), blob);
        else return saveBlob(blob, pdfFileName(it.title));
      }
    }
    if (zip) saveBlob(await zip.generateAsync({ type: 'blob' }), 'distyvault_results.zip');
  };

  const handleDeleteBulk = async (ids) => {
    if (!confirm(`Permanently remove ${ids.length} item(s) from database?`)) return;
    for (const id of ids) { await DV.db.del('items', id); await DV.db.del('contents', id); await DV.db.del('contents', id + ':file'); }
    setSelected([]);
    DV.queue.loadQueue();
  };

  const handleRetryBulk = async (ids) => {
    for (const id of ids) {
      await DV.queue.updateItem(id, { status: STATUS.PENDING, error: null, durationMs: 0, startedAt: null });
    }
    DV.queue.loadQueue();
    setSelected([]);
    DV.toast('Processing Re-queued');
  };

  const handleStopBulk = async (ids) => {
    ids.forEach(id => DV.queue.requestStop(id));
    setTimeout(() => DV.queue.loadQueue(), 200);
    DV.toast('Halt Requested');
  };

  return (
    <div className="min-h-full pb-32">
      <TopBar theme={theme} setTheme={setTheme} openSettings={() => setSettingsOpen(true)} />

      <div className="px-6 space-y-10">
        <CapturePanel onSubmit={handleCapture} />

        <StatsRow
          items={items}
          onDownloadAll={() => handleDownloadBulk(items.filter(i => i.status === STATUS.COMPLETED).map(i => i.id))}
          onStopAll={() => handleStopBulk(items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).map(i => i.id))}
          onRetryFailed={() => handleRetryBulk(items.filter(i => i.status === STATUS.ERROR || i.status === STATUS.STOPPED).map(i => i.id))}
        />

        <CommandBar
          filter={filter} setFilter={setFilter}
          search={search} setSearch={setSearch}
          sort={sort} setSort={setSort}
          tagFilter={tagFilter} setTagFilter={setTagFilter}
          allTags={allTags}
          onExport={async () => saveBlob(await DV.db.exportAllToZip(), 'distyvault_export.zip')}
          onImport={async (file) => { await DV.db.importFromZip(file); DV.queue.loadQueue(); DV.toast('Vault Imported'); }}
        />

        <Table
          items={displayItems}
          selected={selected} setSelected={setSelected}
          expandedIds={expandedIds} setExpandedIds={setExpandedIds}
          onSort={(k) => { setSort(k); if (k === 'queue') DV.queue.loadQueue(); }}
        />

        <SelectionDock
          count={selected.length}
          selectedIds={selected}
          items={items}
          onDownload={() => handleDownloadBulk(selected)}
          onDelete={() => handleDeleteBulk(selected)}
          onRetry={() => handleRetryBulk(selected)}
          onStop={() => handleStopBulk(selected)}
          onTag={() => setTagEditorOpen(true)}
          onUnselectAll={() => setSelected([])}
          onSelectAll={() => setSelected(displayItems.map(i => i.id))}
          onView={() => setViewItem(items.find(i => i.id === selected[0]))}
        />
      </div>

      <ContentModal item={viewItem} onClose={() => setViewItem(null)} />
      <ErrorModal item={errorItem} onClose={() => setErrorItem(null)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={s => { setSettings(s); DV.queue.setSettings(s); DV.queue.setConcurrency(s.concurrency); }} />
      <TagEditorModal open={tagEditorOpen} onClose={() => setTagEditorOpen(false)} selectedIds={selected} items={items} allTags={allTags} />

      <footer className="mt-32 py-12 text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600 opacity-50">DistyVault — Client Side Analysis — {new Date().getFullYear()}</footer>
    </div>
  );
}

// --- Specialized Components ---

function Table({ items, selected, setSelected, expandedIds, setExpandedIds, onSort }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const active = items.some(it => [STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status));
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [items]);

  const toggle = (id, e) => {
    if (e.shiftKey && selected.length > 0) {
      const last = selected[selected.length - 1];
      const start = items.findIndex(i => i.id === last);
      const end = items.findIndex(i => i.id === id);
      if (start !== -1 && end !== -1) {
        const slice = items.slice(Math.min(start, end), Math.max(start, end) + 1).map(i => i.id);
        setSelected(prev => [...new Set([...prev, ...slice])]);
        return;
      }
    }
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="max-w-6xl mx-auto rounded-[3rem] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/40 overflow-hidden shadow-2xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/5">
            <tr>
              <th className="p-6 cursor-pointer hover:text-brand-500 transition-colors" onClick={() => onSort('title')}>Source Asset</th>
              <th className="p-6 text-center cursor-pointer hover:text-brand-500 transition-colors" onClick={() => onSort('status')}>Progress</th>
              <th className="p-6 text-right cursor-pointer hover:text-brand-500 transition-colors" onClick={() => onSort('duration')}>Computing Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {!items.length && <tr><td colSpan="3" className="p-24 text-center text-slate-400 italic font-medium opacity-30">No matching items found in your vault</td></tr>}
            {items.map(i => (
              <tr key={i.id} onClick={(e) => toggle(i.id, e)} className={classNames('hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group select-none', selected.includes(i.id) && 'bg-brand-50/50 dark:bg-brand-600/10')}>
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={classNames('w-1 h-10 rounded-full transition-all shrink-0', selected.includes(i.id) ? 'bg-brand-500 scale-y-100' : 'bg-transparent scale-y-50 group-hover:bg-slate-200 dark:group-hover:bg-white/10 group-hover:scale-y-100')}></div>
                    {i.kind === 'playlist' && (
                      <button onClick={e => { e.stopPropagation(); setExpandedIds(prev => { const n = new Set(prev); n.has(i.id) ? n.delete(i.id) : n.add(i.id); return n; }); }} className="p-2 rounded-2xl bg-slate-100 dark:bg-white/5 hover:scale-110 active:scale-90 transition-all">
                        <Icon name={expandedIds.has(i.id) ? 'chevron-down' : 'chevron-right'} size={18} />
                      </button>
                    )}
                    <div className={classNames('min-w-0 transition-opacity', i.parentId && 'ml-12 opacity-70')}>
                      <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm tracking-tight">{i.title || i.url}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-1.5 font-bold uppercase tracking-widest">{i.url || i.fileName || (i.kind === 'playlist' ? 'Playlisted Collection' : 'Unknown Data Source')}</div>
                    </div>
                  </div>
                </td>
                <td className="p-6 text-center"><StatusChip status={i.status} /></td>
                <td className="p-6 text-right">
                  <div className="text-[11px] font-black text-slate-600 dark:text-slate-400 tabular-nums">
                    {[STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status) ? formatDuration(now - (i.startedAt || now)) : (i.durationMs ? formatDuration(i.durationMs) : '—')}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsRow({ items, onDownloadAll, onStopAll, onRetryFailed }) {
  const c = items.filter(i => i.status === STATUS.COMPLETED).length;
  const p = items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).length;
  const e = items.filter(i => i.status === STATUS.ERROR || i.status === STATUS.STOPPED).length;

  const Stat = ({ label, count, color, icon, onAction, actionIcon }) => (
    <div className={classNames('p-6 rounded-[2rem] border flex justify-between items-center group transition-all duration-500 hover:shadow-lg', color)}>
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-3xl bg-white dark:bg-black/20 flex items-center justify-center shadow-inner">
          <Icon name={icon} size={28} />
        </div>
        <div>
          <div className="text-[10px] uppercase font-black opacity-50 tracking-[0.2em]">{label}</div>
          <div className="text-3xl font-black mt-1 leading-none tracking-tighter tabular-nums">{count}</div>
        </div>
      </div>
      {count > 0 && onAction && (
        <button onClick={onAction} title={`Action for ${label}`} className="p-3.5 bg-white/60 dark:bg-white/5 rounded-2xl shadow-sm hover:scale-110 active:scale-95 transition-all text-current">
          <Icon name={actionIcon} size={24} />
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      <Stat label="Completed" count={c} color="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100/50 dark:border-emerald-800/20 text-emerald-700 dark:text-emerald-400" icon="check-circle" actionIcon="arrow-down-to-line" onAction={onDownloadAll} />
      <Stat label="Processing" count={p} color="bg-brand-50 dark:bg-brand-900/10 border-brand-100/50 dark:border-brand-800/20 text-brand-700 dark:text-brand-400" icon="zap" actionIcon="stop-circle" onAction={onStopAll} />
      <Stat label="Warnings" count={e} color="bg-rose-50 dark:bg-rose-900/10 border-rose-100/50 dark:border-rose-800/20 text-rose-700 dark:text-rose-400" icon="alert-octagon" actionIcon="refresh-cw" onAction={onRetryFailed} />
    </div>
  );
}

function CommandBar({ filter, setFilter, search, setSearch, onExport, onImport, allTags, tagFilter, setTagFilter }) {
  const [expanded, setExpanded] = useState(false);
  const importRef = useRef(null);

  const filters = [
    { k: 'all', l: 'All Assets' },
    { k: 'url', l: 'Web Pages' },
    { k: 'youtube', l: 'YouTube Content' },
    { k: 'file', l: 'Local Records' }
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-5 bg-white/60 dark:bg-slate-800/30 p-3 rounded-[2.5rem] border border-slate-200 dark:border-white/5 glass shadow-xl">
      <div className={classNames('relative flex items-center transition-all duration-500 overflow-hidden', expanded || search ? 'flex-1' : 'w-14')}>
        <button onClick={() => setExpanded(!expanded)} className="p-3.5 rounded-3xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0 text-brand-600 dark:text-brand-400"><Icon name="search" size={24} /></button>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter keywords, sources, or content..."
          className="flex-1 bg-transparent px-4 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none"
        />
        {(expanded || search) && <button onClick={() => { setSearch(''); setExpanded(false); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors mr-2"><Icon name="x-circle" size={18} /></button>}
      </div>

      <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {filters.map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={classNames('px-5 py-2.5 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap', filter === f.k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5')}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="flex-1 hidden md:block" />

      <div className="flex items-center gap-2 px-1">
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="h-10 px-4 rounded-2xl bg-slate-100 dark:bg-white/5 border-none text-[10px] uppercase font-black tracking-widest outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
          <option value="">By Tag</option>
          {allTags.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2" />
        <input type="file" ref={importRef} className="hidden" accept=".zip" onChange={e => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ''; }} />
        <button onClick={() => importRef.current?.click()} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="Import Vault Zip"><Icon name="upload" size={20} /></button>
        <button onClick={onExport} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="Export Total Archive"><Icon name="download" size={20} /></button>
      </div>
    </div>
  );
}

function SelectionDock({ count, selectedIds, items, onView, onDownload, onDelete, onRetry, onStop, onTag, onUnselectAll, onSelectAll }) {
  if (!count) return null;
  const anyActive = selectedIds.some(id => {
    const it = items.find(x => x.id === id);
    return it && [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status);
  });

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 glass bg-slate-900/95 text-white p-4 rounded-[2.5rem] shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-20 duration-500 border border-white/10 backdrop-blur-2xl">
      <div className="flex flex-col items-center border-r border-white/10 pr-8 mr-2">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Selected</div>
        <div className="text-2xl font-black leading-none mt-1">{count}</div>
      </div>
      <div className="flex gap-2">
        {count === 1 && <button onClick={onView} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all hover:scale-110 active:scale-90" title="Inspect Results"><Icon name="eye" size={24} /></button>}
        <button onClick={onDownload} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all hover:scale-110 active:scale-90" title="Export as PDF"><Icon name="file-down" size={24} /></button>
        {anyActive ? (
          <button onClick={onStop} className="p-4 bg-rose-500/20 hover:bg-rose-500/40 rounded-3xl transition-all hover:scale-110 active:scale-90 text-rose-400" title="Abort Task"><Icon name="stop-circle" size={24} /></button>
        ) : (
          <button onClick={onRetry} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all hover:scale-110 active:scale-90" title="Re-process Assets"><Icon name="refresh-cw" size={24} /></button>
        )}
        <button onClick={onTag} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all hover:scale-110 active:scale-90" title="Categorize"><Icon name="tag" size={24} /></button>
        <button onClick={onDelete} className="p-4 bg-rose-600 hover:bg-rose-700 rounded-3xl transition-all hover:scale-110 active:scale-90 text-white shadow-xl shadow-rose-900/40" title="Destroy Records"><Icon name="trash-2" size={24} /></button>
      </div>
      <div className="flex flex-col gap-1 ml-4 border-l border-white/10 pl-8">
        <button onClick={onSelectAll} className="text-[9px] font-black uppercase tracking-widest hover:text-brand-400 opacity-60 hover:opacity-100 transition-all">Select View</button>
        <button onClick={onUnselectAll} className="text-[9px] font-black uppercase tracking-widest hover:text-rose-400 opacity-60 hover:opacity-100 transition-all">Deselect All</button>
      </div>
    </div>
  );
}

function TagEditorModal({ open, onClose, selectedIds, items, allTags }) {
  const [tagInput, setTagInput] = useState('');

  const add = async (t) => {
    const tag = (t || tagInput).trim().toLowerCase();
    if (!tag) return;
    for (const id of selectedIds) {
      const item = items.find(i => i.id === id);
      const tags = [...new Set([...(item?.tags || []), tag])];
      await DV.queue.updateTags(id, tags);
    }
    setTagInput('');
  };

  const remove = async (tag) => {
    for (const id of selectedIds) {
      const item = items.find(i => i.id === id);
      if (item && item.tags && item.tags.includes(tag)) {
        const n = item.tags.filter(tx => tx !== tag);
        await DV.queue.updateTags(id, n);
      }
    }
  };

  const currentTags = useMemo(() => {
    const s = new Set();
    items.filter(i => selectedIds.includes(i.id)).forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [selectedIds, items]);

  return (
    <Modal open={open} onClose={onClose} title={`Categorizing ${selectedIds.length} Asset(s)`}>
      <div className="space-y-8 py-6 px-2">
        <div className="flex gap-4">
          <input
            autoFocus
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Introduce new tag..."
            className="flex-1 h-14 px-5 rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 outline-none focus:ring-4 focus:ring-brand-500/20 font-bold transition-all"
          />
          <button onClick={() => add()} className="px-8 h-14 rounded-[1.5rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black tracking-widest shadow-xl active:scale-95 transition-all">COMMIT</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] block">Persistent Tags</label>
            <div className="flex flex-wrap gap-2">
              {currentTags.length ? currentTags.map(t => (
                <span key={t} className="px-4 py-2 rounded-2xl bg-brand-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-brand-500/20 animate-in fade-in zoom-in">
                  {t}
                  <button onClick={() => remove(t)} className="hover:scale-125 transition-transform"><Icon name="x" size={14} /></button>
                </span>
              )) : <div className="text-xs text-slate-400 font-medium italic p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center">Untagged selection</div>}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] block">Vault Index</label>
            <div className="flex flex-wrap gap-2">
              {allTags.filter(t => !currentTags.includes(t)).map(t => (
                <button key={t} onClick={() => add(t)} className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/10 text-[11px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all">{t}</button>
              ))}
              {!allTags.length && <div className="text-[10px] text-slate-400 font-bold uppercase py-4">Global index empty</div>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SettingsDrawer({ open, onClose, settings, setSettings }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => { setLocal(settings); }, [settings]);

  // Model Metadata
  const providers = [
    { id: 'openai', name: 'OpenAI Core', models: [{ v: 'gpt-4o', l: 'GPT-4o Omnis' }, { v: 'gpt-4o-mini', l: 'GPT-4o Micro' }, { v: 'o1', l: 'O1 Reasoning' }, { v: 'o3-mini', l: 'O3 Mini Reasoning' }] },
    { id: 'anthropic', name: 'Anthropic Claude', models: [{ v: 'claude-3-5-sonnet-latest', l: 'Claude 3.5 Sonnet' }, { v: 'claude-3-7-sonnet-latest', l: 'Claude 3.7 Sonnet' }, { v: 'claude-3-5-opus-latest', l: 'Claude 3.5 Opus' }] },
    { id: 'gemini', name: 'Google Gemini', models: [{ v: 'gemini-2.0-flash', l: 'Gemini 2.0 Flash' }, { v: 'gemini-2.0-flash-lite', l: 'Gemini 2.0 Lite' }, { v: 'gemini-1.5-pro', l: 'Gemini 1.5 Pro' }] },
    { id: 'deepseek', name: 'DeepSeek Research', models: [{ v: 'deepseek-chat', l: 'DeepSeek-V3 C' }, { v: 'deepseek-reasoner', l: 'DeepSeek-R1 R' }] },
    { id: 'grok', name: 'xAI Grok', models: [{ v: 'grok-2-1212', l: 'Grok 2' }, { v: 'grok-2-vision-1212', l: 'Grok 2 Vision' }] }
  ];

  const save = () => { setSettings(local); onClose(); DV.toast('System Preferences Synced', { type: 'success' }); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 h-full p-10 shadow-[0_0_100px_rgba(0,0,0,0.4)] border-l border-slate-200 dark:border-white/10 flex flex-col animate-in slide-in-from-right duration-500">
        <div className="flex justify-between items-center mb-16">
          <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white">NODE CONFIG</h2>
          <button onClick={onClose} className="p-4 hover:bg-slate-100 dark:hover:bg-white/5 rounded-[1.5rem] transition-colors"><Icon name="x" size={28} /></button>
        </div>

        <div className="space-y-12 flex-1 overflow-y-auto no-scrollbar pb-10">
          <div className="space-y-6">
            <label className="text-[10px] uppercase font-black text-brand-600 tracking-[0.3em] flex items-center gap-3"><Icon name="cpu" size={20} /> Inference Layer</label>
            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Provider Service</span>
                <select value={local.ai.mode} onChange={e => setLocal({ ...local, ai: { ...local.ai, mode: e.target.value, model: '' } })} className="w-full h-14 px-5 rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 outline-none focus:ring-4 focus:ring-brand-500/20 font-black tracking-tight cursor-pointer">
                  <option value="">DEACTIVATED</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                </select>
              </div>

              {local.ai.mode && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Computation Model</span>
                  <select value={local.ai.model} onChange={e => setLocal({ ...local, ai: { ...local.ai, model: e.target.value } })} className="w-full h-14 px-5 rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-brand-900/10 outline-none focus:ring-4 focus:ring-brand-500/20 font-bold transition-all cursor-pointer">
                    <option value="">SELECT TARGET MODEL</option>
                    {providers.find(p => p.id === local.ai.mode)?.models.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Authorization Secret</span>
                <div className="relative">
                  <input type="password" value={local.ai.apiKey} onChange={e => setLocal({ ...local, ai: { ...local.ai, apiKey: e.target.value } })} placeholder="••••••••••••••••" className="w-full h-14 px-5 rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 outline-none focus:ring-4 focus:ring-brand-500/20 font-mono tracking-[0.4em]" />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"><Icon name="key" size={20} /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <label className="text-[10px] uppercase font-black text-brand-600 tracking-[0.3em] flex items-center gap-3"><Icon name="layers" size={20} /> Concurrency Multiplier</label>
            <div className="px-4">
              <input type="range" min="1" max="10" step="1" value={local.concurrency} onChange={e => setLocal({ ...local, concurrency: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-brand-600" />
              <div className="mt-6 flex justify-between items-center bg-slate-50 dark:bg-black/20 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-inner">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Channels</div>
                <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{local.concurrency}</div>
              </div>
              <p className="mt-3 text-[9px] text-slate-500 font-bold italic leading-relaxed">Higher values increase processing speed but may hit provider rate limits.</p>
            </div>
          </div>
        </div>

        <button onClick={save} className="w-full h-16 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-3xl shadow-2xl shadow-brand-500/30 active:scale-[0.97] transition-all flex items-center justify-center gap-4 uppercase tracking-[0.4em] text-xs">
          <Icon name="check-circle" size={24} /> Sync Config
        </button>
      </div>
    </div>
  );
}

const ErrorModal = ({ item, onClose }) => (
  <Modal open={!!item} onClose={onClose} title="Diagnostic Report">
    <div className="p-8 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-[2.5rem] shadow-inner">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20"><Icon name="alert-triangle" size={28} /></div>
        <div>
          <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">System Failure recorded</div>
          <div className="text-lg font-black text-rose-900 dark:text-rose-100 italic tracking-tight">{item?.title || 'Execution Fault'}</div>
        </div>
      </div>
      <div className="text-xs text-rose-700 dark:text-rose-300 whitespace-pre-wrap leading-relaxed font-bold bg-white/50 dark:bg-black/40 p-6 rounded-[2rem] border border-rose-200 dark:border-white/5 shadow-sm max-h-[40vh] overflow-y-auto custom-scrollbar">{item?.error || 'No detailed traceback available for this exception.'}</div>
    </div>
  </Modal>
);

const ContentModal = ({ item, onClose }) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    DV.db.get('contents', item.id).then(c => {
      setHtml((window.DV?.buildViewerHtml && c?.html) ? DV.buildViewerHtml(c.html) : (c?.html || ''));
      setLoading(false);
    });
  }, [item?.id]);

  useEffect(() => {
    if (html && iframeRef.current) {
      const isDark = document.documentElement.classList.contains('dark');
      setTimeout(() => {
        try { iframeRef.current.contentWindow.postMessage({ type: 'dv-theme', isDark }, '*'); } catch { }
      }, 100);
    }
  }, [html]);

  return (
    <Modal open={!!item} onClose={onClose} title={item?.title} hideHeader>
      <div className="relative min-h-[550px] rounded-[2rem] overflow-hidden border border-slate-100 dark:border-white/5 shadow-inner bg-slate-50 dark:bg-black/20">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 z-20 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 border-[6px] border-brand-500/10 border-t-brand-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-brand-600"><Icon name="database" size={24} /></div>
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-600 animate-pulse">Accessing Vault...</div>
            </div>
          </div>
        )}
        {html ? (
          <iframe ref={iframeRef} srcDoc={html} className="w-full h-[78vh] border-none shadow-2xl" />
        ) : !loading && (
          <div className="h-[78vh] flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-6">
            <Icon name="file-search" size={64} className="opacity-20" />
            <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Analysis payload not found</div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Start Runtime (Initialization)
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);