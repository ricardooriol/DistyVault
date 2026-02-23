/**
 * DistyVault — React application shell and UI logic
 *
 * This file is intentionally plain React (UMD) executed via Babel-in-browser.
 * It wires the UI to DV core modules available on window.DV (db, queue, bus, ai, extractors, toast).
 */
const { useState, useEffect, useMemo, useRef } = React;
const { classNames, yieldToBrowser, saveBlob, formatDuration, sanitizeFilename } = DV.utils;
const STATUS = DV.queue.STATUS;

/**
 * Icon — wrapper for lucide/feather UMD icon sets.
 */
function Icon({ name, size = 20, className, strokeWidth = 2 }) {
  const wrapRef = useRef(null);
  useEffect(() => {
    try {
      const wrap = wrapRef.current;
      if (!wrap) return;
      wrap.innerHTML = '';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', name);
      i.style.width = '100%';
      i.style.height = '100%';
      i.style.display = 'block';
      i.setAttribute('aria-hidden', 'true');
      wrap.appendChild(i);
      if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons({ attrs: { 'stroke-width': String(strokeWidth) } });
      } else if (window.feather && window.feather.replace) {
        i.setAttribute('data-feather', name);
        i.removeAttribute('data-lucide');
        window.feather.replace({ 'stroke-width': strokeWidth });
      }
      const svg = wrap.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.style.width = size + 'px';
        svg.style.height = size + 'px';
        svg.style.display = 'block';
        svg.style.margin = 'auto';
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    } catch { }
  }, [name, size, strokeWidth]);
  return React.createElement('span', {
    ref: wrapRef,
    className: ['dv-icon pointer-events-none inline-flex items-center justify-center', className || ''].join(' '),
    style: { width: size + 'px', height: size + 'px', display: 'inline-flex' },
    'aria-hidden': true
  });
}

function TopBar({ theme, setTheme, openSettings }) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  const themeIcon = isDark ? 'moon' : 'sun';
  const logoSrc = isDark ? 'logos/logo_no_bg_w.png' : 'logos/logo_no_bg_b.png';

  return (
    <div className="sticky top-0 z-40 glass bg-white/80 dark:bg-slate-900/70 border-b border-slate-300 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="DistyVault" className="w-8 h-8 rounded-full shadow" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 font-sans">DistyVault</div>
            <div className="text-xs text-slate-600 dark:text-slate-300 font-sans">Gather, distill and control your knowledge</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
          >
            <Icon name={themeIcon} />
          </button>
          <button onClick={openSettings} title="Settings" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white bg-white dark:bg-slate-800">
            <Icon name="settings" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CapturePanel({ onSubmit }) {
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState([]);
  const dropRef = useRef(null);

  function choose(evt) {
    const f = Array.from(evt.target.files || []);
    if (f.length) setFiles(prev => [...prev, ...f]);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = Array.from(e.dataTransfer.files || []);
    if (f.length) setFiles(prev => [...prev, ...f]);
    dropRef.current?.classList.remove('ring-2', 'ring-brand-500');
  }

  function onDragOver(e) { e.preventDefault(); dropRef.current?.classList.add('ring-2', 'ring-brand-500'); }
  function onDragLeave() { dropRef.current?.classList.remove('ring-2', 'ring-brand-500'); }

  async function submit() {
    const trimmed = url.trim();
    await onSubmit(trimmed, files);
    setUrl('');
    setFiles([]);
  }

  return (
    <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onLeave} className="max-w-6xl mx-auto mt-6 p-4 rounded-2xl border border-slate-400 dark:border-white/20 bg-white/90 dark:bg-slate-800/60 glass">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-0 relative">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim()) submit(); }} placeholder="Paste a URL or YouTube link" className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 outline-none text-slate-900 dark:text-slate-100" />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white"><Icon name="link" /></div>
          </div>
          <label className="h-12 w-12 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-800 flex items-center justify-center cursor-pointer text-slate-900 dark:text-white">
            <input type="file" multiple className="hidden" onChange={choose} />
            <Icon name="paperclip" />
          </label>
          <button onClick={submit} className="h-12 w-12 rounded-xl bg-brand-700 text-white hover:bg-brand-800 flex items-center justify-center"><Icon name="wand-2" /></button>
        </div>
        {files.length > 0 && (
          <div className="text-sm flex items-center gap-2 flex-wrap">
            {files.slice(0, 6).map((f, i) => (
              <div key={i} className="px-2 py-1 border rounded-full text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 flex items-center gap-2">
                <span className="truncate max-w-[160px]">{f.name}</span>
                <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-slate-700"><Icon name="x" /></button>
              </div>
            ))}
            {files.length > 6 && <span className="text-slate-500">+{files.length - 6} more</span>}
            <button onClick={() => setFiles([])} className="ml-auto inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
              <Icon name="trash-2" />
              <span>Remove all</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
  function onLeave() { dropRef.current?.classList.remove('ring-2', 'ring-brand-500'); }
}

function StatsRow({ items, onDownloadAll, onStopAll, onRetryFailed }) {
  const completed = items.filter(i => i.status === STATUS.COMPLETED).length;
  const inprog = items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).length;
  const errors = items.filter(i => i.status === STATUS.ERROR).length;

  const Card = ({ label, count, action, actionText }) => (
    <div className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-white/20">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-xl font-semibold text-slate-900 dark:text-white">{count}</div>
        {action && (
          <button onClick={action} className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-white/10">
            {actionText}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card label="Completed" count={completed} action={completed ? onDownloadAll : null} actionText={<Icon name="arrow-down-to-line" />} />
      <Card label="In Progress" count={inprog} action={inprog ? onStopAll : null} actionText={<Icon name="square" />} />
      <Card label="Errors" count={errors} action={errors ? onRetryFailed : null} actionText={<Icon name="refresh-ccw" />} />
    </div>
  );
}

function CommandBar({ filter, setFilter, search, setSearch, onExport, onImport, sort, setSort, tagFilter, setTagFilter, allTags }) {
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const filterRef = useRef(null);
  const tagsRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
      if (tagsOpen && tagsRef.current && !tagsRef.current.contains(e.target)) setTagsOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [filterOpen, tagsOpen]);

  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 py-3 rounded-2xl border border-slate-400 dark:border-white/20 bg-white/90 dark:bg-slate-800/60 glass relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setExpanded(!expanded); if (expanded) setSearch(''); }}
          className={classNames('w-9 h-9 shrink-0 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800', expanded && 'ring-2 ring-brand-500')}
        >
          <Icon name="search" />
        </button>

        {expanded && (
          <div className="absolute left-16 right-4 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-9 flex-1 px-3 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900 outline-none text-slate-900 dark:text-slate-100"
            />
            <button onClick={() => { setExpanded(false); setSearch(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        <div className={classNames('flex items-center gap-3 flex-1', expanded && 'invisible pointer-events-none')}>
          <div className="relative z-20" ref={filterRef}>
            <button onClick={() => setFilterOpen(!filterOpen)} className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-white/10">
              <Icon name={filter === 'all' ? 'asterisk' : filter === 'url' ? 'link' : filter === 'youtube' ? 'video' : 'file'} />
            </button>
            {filterOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 p-1 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-lg z-50 flex flex-col gap-1">
                {[{ k: 'all', i: 'asterisk' }, { k: 'url', i: 'link' }, { k: 'youtube', i: 'video' }, { k: 'file', i: 'file' }].map(f => (
                  <button key={f.k} onClick={() => { setFilter(f.k); setFilterOpen(false); }} className={classNames('w-9 h-9 flex items-center justify-center rounded-lg', filter === f.k ? 'bg-slate-100 dark:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-white/10')}><Icon name={f.i} /></button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={tagsRef}>
            <button onClick={() => setTagsOpen(!tagsOpen)} className={classNames('h-9 px-3 rounded-lg border border-slate-400 dark:border-white/30 flex items-center gap-2 text-sm font-medium transition-colors bg-white dark:bg-slate-800', tagFilter ? 'text-brand-600 border-brand-500' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10')}>
              <Icon name="tag" size={16} />
              <span>{tagFilter || 'All Tags'}</span>
              <Icon name="chevron-down" size={14} className={classNames('transition-transform', tagsOpen && 'rotate-180')} />
            </button>
            {tagsOpen && (
              <div className="absolute left-0 mt-2 p-1 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-xl z-20 flex flex-col min-w-[160px] max-h-64 overflow-y-auto no-scrollbar">
                <button onClick={() => { setTagFilter(''); setTagsOpen(false); }} className={classNames('w-full px-3 py-3 text-left rounded-lg text-sm flex items-center', !tagFilter ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300')}>
                  All Tags
                </button>
                {allTags.map(tag => (
                  <button key={tag} onClick={() => { setTagFilter(tag); setTagsOpen(false); }} className={classNames('w-full px-3 py-3 text-left rounded-lg text-sm truncate flex items-center', tagFilter === tag ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300')}>
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input type="file" accept=".zip" className="hidden" ref={importInputRef} onChange={e => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ''; }} />
            <button onClick={() => importInputRef.current?.click()} className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-white/10"><Icon name="upload" /></button>
            <button onClick={onExport} className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-white/10"><Icon name="download" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status, onClick }) {
  const map = {
    [STATUS.PENDING]: 'bg-slate-200 text-slate-700',
    [STATUS.EXTRACTING]: 'bg-amber-200 text-amber-900',
    [STATUS.DISTILLING]: 'bg-indigo-200 text-indigo-900',
    [STATUS.COMPLETED]: 'bg-emerald-200 text-emerald-900',
    [STATUS.ERROR]: 'bg-rose-200 text-rose-900',
    [STATUS.STOPPED]: 'bg-slate-300 text-slate-800'
  };
  return <span onClick={onClick} className={classNames('px-2 py-1 rounded-full text-xs cursor-default', map[status])}>{status}</span>;
}

function Table({ items, allItems, selected, setSelected, onSort, expandedIds, setExpandedIds }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const active = items.some(it => [STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status));
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [items]);

  function onRowClick(item) {
    if (item.kind === 'playlist') {
      const isSelected = selected.includes(item.id);
      const childIds = allItems.filter(x => x.parentId === item.id).map(x => x.id);
      if (isSelected) setSelected(prev => prev.filter(id => id !== item.id && !childIds.includes(id)));
      else setSelected(prev => [...new Set([...prev, item.id, ...childIds])]);
    } else if (item.parentId) {
      const isSelected = selected.includes(item.id);
      let next = isSelected ? selected.filter(id => id !== item.id) : [...selected, item.id];
      const siblings = allItems.filter(x => x.parentId === item.parentId);
      if (siblings.every(s => next.includes(s.id))) next = [...new Set([...next, item.parentId])];
      else next = next.filter(id => id !== item.parentId);
      setSelected(next);
    } else {
      setSelected(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
    }
  }

  return (
    <div className="max-w-6xl mx-auto mt-4 rounded-2xl border border-slate-300 dark:border-white/20 overflow-hidden">
      <div className="overflow-x-auto w-full">
        {/* Table needs horizontal scroll on mobile (max-w/min-w container) but 1 view on desktop */}
        <table className="w-full min-w-[720px] lg:min-w-0 table-fixed rounded-2xl overflow-hidden">
          <thead className="bg-slate-100 dark:bg-slate-800/70 select-none">
            <tr>
              <th className="w-3/5 p-2 pl-4 text-left cursor-pointer" onClick={() => onSort('title')}>Name</th>
              <th className="w-1/5 p-2 text-center cursor-pointer" onClick={() => onSort('status')}>Status</th>
              <th className="w-1/5 p-2 text-center relative">
                <span className="cursor-pointer" onClick={() => onSort('duration')}>Duration</span>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" onClick={() => onSort('queue')}><Icon name="rotate-ccw" /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {!items.length && <tr><td colSpan={3} className="p-6 text-center text-slate-500">No items found</td></tr>}
            {items.map(i => (
              <tr key={i.id} onClick={() => onRowClick(i)} className={classNames('border-t border-slate-200 dark:border-white/10 cursor-pointer', selected.includes(i.id) && 'bg-brand-50/70 dark:bg-brand-600/10')}>
                <td className={classNames('p-2 pl-4 text-left', i.parentId && 'pl-8')}>
                  <div className="overflow-hidden">
                    {i.kind === 'playlist' ? (
                      <div className="flex items-center gap-2">
                        <button className="p-1" onClick={e => { e.stopPropagation(); setExpandedIds(prev => { const n = new Set(prev); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; }); }}>
                          <span className={classNames('transition-transform inline-block', expandedIds.has(i.id) && 'rotate-90')}><Icon name="chevron-right" /></span>
                        </button>
                        <div className="font-medium truncate">{i.title}</div>
                      </div>
                    ) : (
                      <div className="font-medium truncate">{i.title || i.url}</div>
                    )}
                    {i.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1">{i.tags.map(t => <span key={t} className="px-1.5 py-0 text-[10px] rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/40">{t}</span>)}</div>
                    )}
                    {!i.tags?.length && i.url && <div className="text-xs text-slate-500 truncate mt-1">{i.url}</div>}
                  </div>
                </td>
                <td className="p-2 text-center">
                  {i.kind !== 'playlist' && <StatusChip status={i.status} onClick={e => { if (i.status === STATUS.ERROR) { e.stopPropagation(); DV.bus.emit('ui:openError', i); } }} />}
                </td>
                <td className="p-2 text-sm text-center">
                  {i.kind !== 'playlist' && (i.status === STATUS.EXTRACTING || i.status === STATUS.DISTILLING ? formatDuration(now - (i.startedAt || now)) : (i.durationMs ? formatDuration(i.durationMs) : '-'))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectionDock({ count, anyActive, allSelected, onView, onRetry, onDownload, onDelete, onStop, onSelectAll, onUnselectAll, onTag }) {
  if (!count) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-full border border-slate-300 dark:border-white/20 bg-white/90 dark:bg-slate-800/80 glass shadow">
      <div className="flex items-center gap-2 whitespace-nowrap overflow-x-auto px-2 no-scrollbar">
        {count === 1 && <button onClick={onView} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 flex items-center gap-1 bg-white dark:bg-slate-800"><Icon name="eye" /><span>View</span></button>}
        <button onClick={onRetry} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 flex items-center gap-1 bg-white dark:bg-slate-800"><Icon name="refresh-ccw" /><span>Retry</span></button>
        {anyActive && <button onClick={onStop} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 flex items-center gap-1 bg-white dark:bg-slate-800"><Icon name="square" /><span>Stop</span></button>}
        <button onClick={onDownload} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 flex items-center gap-1 bg-white dark:bg-slate-800"><Icon name="arrow-down-to-line" /><span>Download</span></button>
        <button onClick={onTag} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 flex items-center gap-1 bg-white dark:bg-slate-800"><Icon name="tag" /><span>Tag</span></button>
        <button onClick={onDelete} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 flex items-center gap-1 bg-white dark:bg-slate-800"><Icon name="trash" /><span>Delete</span></button>
        <span className="mx-2 h-5 w-px bg-slate-300/60" />
        <div className="text-sm font-medium">{count} selected</div>
        {!allSelected && <button onClick={onSelectAll} className="text-sm px-2 py-1 border rounded-md border-slate-400 dark:border-white/30">Select all</button>}
        <button onClick={onUnselectAll} className="text-sm px-2 py-1 border rounded-md border-slate-400 dark:border-white/30">Unselect all</button>
      </div>
    </div>
  );
}

function TagEditorModal({ open, onClose, selectedIds, items, allTags }) {
  const [input, setInput] = useState('');
  const currentTags = useMemo(() => {
    const s = new Set();
    items.filter(i => selectedIds.includes(i.id)).forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [items, selectedIds]);

  async function add(t) {
    const tag = (t || input).trim().toLowerCase();
    if (!tag) return;
    for (const id of selectedIds) {
      const it = items.find(i => i.id === id);
      const ex = it?.tags || [];
      if (!ex.includes(tag)) await DV.queue.updateTags(id, [...ex, tag]);
    }
    setInput('');
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Manage Tags">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="New tag…" className="flex-1 h-9 px-3 rounded-lg border border-slate-350 dark:border-white/20 bg-white dark:bg-slate-900 outline-none text-sm" />
          <button onClick={() => add()} className="h-9 px-4 rounded-lg bg-brand-700 text-white text-sm">Add</button>
        </div>
        {allTags.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Recommended</div>
            <div className="flex flex-wrap gap-1">
              {allTags.filter(t => !currentTags.includes(t)).map(t => (
                <button key={t} onClick={() => add(t)} className="px-2 py-0.5 text-xs rounded-full border border-slate-300 dark:border-white/20 hover:bg-slate-50">{t}</button>
              ))}
            </div>
          </div>
        )}
        {currentTags.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Applied</div>
            <div className="flex flex-wrap gap-1">
              {currentTags.map(t => (
                <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-brand-100 text-brand-700 border border-brand-200 flex items-center gap-1">
                  {t}
                  <button onClick={async () => { for (const id of selectedIds) { const it = items.find(i => i.id === id); const ex = it?.tags || []; await DV.queue.updateTags(id, ex.filter(x => x !== t)); } }}><Icon name="x" size={12} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Modal({ open, onClose, title, children, hideHeader }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-w-2xl w-full p-4 rounded-2xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 shadow-xl">
        {!hideHeader && (
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg font-semibold">{title}</div>
            <button onClick={onClose} className="p-1"><Icon name="x" /></button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function SettingsDrawer({ open, onClose, settings, setSettings }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => { setLocal(settings); }, [settings]);
  const [testing, setTesting] = useState(false);

  const providers = [
    { id: 'openai', name: 'OpenAI', models: [{ v: 'gpt-5.2', l: 'GPT-5.2' }, { v: 'gpt-5.2-pro', l: 'GPT-5.2 Pro' }] },
    { id: 'anthropic', name: 'Anthropic', models: [{ v: 'claude-opus-4.6', l: 'Claude Opus 4.6' }, { v: 'claude-sonnet-4.6', l: 'Claude Sonnet 4.6' }] },
    { id: 'gemini', name: 'Gemini', models: [{ v: 'gemini-3.1-pro-preview', l: 'Gemini 3.1 Pro' }, { v: 'gemini-3-flash-preview', l: 'Gemini 3 Flash' }] },
    { id: 'deepseek', name: 'DeepSeek', models: [{ v: 'deepseek-chat', l: 'DeepSeek-V3' }, { v: 'deepseek-reasoner', l: 'DeepSeek-R1' }] },
    { id: 'grok', name: 'Grok', models: [{ v: 'grok-4.1-fast', l: 'Grok 4.1 Fast' }, { v: 'grok-4.1-fast-non-reasoning', l: 'Grok 4.1 Fast (Non-Reasoning)' }] }
  ];

  async function testKey() {
    try {
      setTesting(true);
      await DV.ai.test(local.ai);
      DV.toast('API connection successful!', { type: 'success' });
    } catch (e) {
      DV.toast(e.message || 'API test failed', { type: 'error' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className={classNames('fixed inset-0 z-50 transition-opacity', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={classNames('absolute right-0 top-0 h-full w-full max-w-sm p-6 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 transition-transform duration-300', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex justify-between items-center mb-8">
          <div className="text-xl font-bold">Settings</div>
          <button onClick={onClose}><Icon name="x" size={24} /></button>
        </div>
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-1">Provider</div>
            <select value={local.ai.mode} onChange={e => setLocal({ ...local, ai: { ...local.ai, mode: e.target.value, model: '' } })} className="w-full h-10 px-2 border border-slate-400 dark:border-white/20 bg-white dark:bg-slate-900 rounded-lg outline-none">
              <option value="">None</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {local.ai.mode && (
            <div>
              <div className="text-sm font-medium mb-1">Model</div>
              <select value={local.ai.model} onChange={e => setLocal({ ...local, ai: { ...local.ai, model: e.target.value } })} className="w-full h-10 px-2 border border-slate-400 dark:border-white/20 bg-white dark:bg-slate-900 rounded-lg outline-none">
                <option value="">Default</option>
                {providers.find(p => p.id === local.ai.mode)?.models.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          )}
          <div>
            <div className="text-sm font-medium mb-1">API Key</div>
            <div className="flex gap-2">
              <input type="password" value={local.ai.apiKey} onChange={e => setLocal({ ...local, ai: { ...local.ai, apiKey: e.target.value } })} className="flex-1 h-10 px-3 border border-slate-400 dark:border-white/20 bg-white dark:bg-slate-900 rounded-lg outline-none" placeholder="sk-..." />
              <button
                onClick={testKey}
                disabled={testing || !local.ai.apiKey}
                className={classNames('px-3 rounded-lg border border-slate-400 dark:border-white/20 bg-slate-50 dark:bg-slate-800 text-xs font-bold transition-colors', testing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-700')}
              >
                {testing ? '...' : 'Test'}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1 flex justify-between">
              <span>Concurrency</span>
              <span className="font-bold">{local.concurrency}</span>
            </div>
            <input type="range" min="1" max="10" value={local.concurrency} onChange={e => setLocal({ ...local, concurrency: parseInt(e.target.value) })} className="w-full" />
          </div>
          <button onClick={() => { setSettings(local); onClose(); DV.toast('Settings updated'); }} className="w-full h-12 bg-brand-700 text-white font-bold rounded-xl mt-4">Save Configuration</button>
        </div>
      </div>
    </div>
  );
}

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
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Init & Events
  useEffect(() => {
    const refresh = async () => setItems(await DV.db.getAll('items'));
    const offAdd = DV.bus.on('items:added', refresh);
    const offUpd = DV.bus.on('items:updated', refresh);
    const offLoad = DV.bus.on('items:loaded', (i) => setItems(i));
    const offErr = DV.bus.on('ui:openError', setErrorItem);
    DV.queue.loadSettings().then(() => setSettings(DV.queue.getSettings()));
    DV.queue.loadQueue();
    return () => { offAdd(); offUpd(); offLoad(); offErr(); };
  }, []);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('dv.theme', t);
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);

    // Notify all iframes of the theme change
    const msg = { type: 'dv-theme', isDark };
    window.postMessage(msg, '*');
    document.querySelectorAll('iframe').forEach(f => {
      try { f.contentWindow.postMessage(msg, '*'); } catch (e) { }
    });
  };

  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const displayItems = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = items.filter(i => {
      if (filter !== 'all' && i.kind !== filter && !(filter === 'youtube' && i.kind === 'playlist')) return false;
      if (tagFilter && !(i.tags || []).includes(tagFilter)) return false;
      if (!q) return true;
      return i.title?.toLowerCase().includes(q) || i.url?.toLowerCase().includes(q);
    }).sort((a, b) => {
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sort === 'status') return (a.status || '').localeCompare(b.status || '');
      if (sort === 'duration') return (a.durationMs || 0) - (b.durationMs || 0);
      return (a.queueIndex || 0) - (b.queueIndex || 0);
    });

    const out = [];
    const parents = filtered.filter(i => !i.parentId);
    parents.forEach(p => {
      out.push(p);
      if (expandedIds.has(p.id)) {
        filtered.filter(c => c.parentId === p.id).forEach(c => out.push(c));
      }
    });
    return out;
  }, [items, filter, tagFilter, search, sort, expandedIds]);

  const handleCapture = async (url, files) => {
    try {
      if (url) {
        if (DV.extractors.isYouTubePlaylist?.(url)) {
          const pl = await DV.extractors.extractYouTubePlaylist(url);
          const pr = await DV.queue.addItem({ kind: 'playlist', url, title: pl.title });
          for (const it of pl.items) await DV.queue.addItem({ ...it, kind: 'youtube', parentId: pr.id });
        } else {
          const kind = DV.extractors.isYouTube?.(url) ? 'youtube' : 'url';
          const r = await DV.queue.addItem({ kind, url, title: 'Loading...' });
          const peek = kind === 'youtube' ? await DV.extractors.peekYouTubeTitle?.(url) : await DV.extractors.peekTitle?.(url);
          if (peek?.title) await DV.queue.updateItem(r.id, { title: peek.title });
        }
      }
      for (const f of files) await DV.queue.addItem({ kind: 'file', title: f.name, file: f });
      DV.toast('Items processing');
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
        const doc = new jspdf.jsPDF();
        doc.text(it.title, 10, 10);
        doc.text(content.html.replace(/<[^>]+>/g, ' ').slice(0, 10000), 10, 20);
        const b = doc.output('blob');
        if (zip) zip.file(sanitizeFilename(it.title) + '.pdf', b);
        else return saveBlob(b, sanitizeFilename(it.title) + '.pdf');
      }
    }
    if (zip) saveBlob(await zip.generateAsync({ type: 'blob' }), 'distyvault_export.zip');
  };

  return (
    <div className="min-h-full pb-20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      <TopBar theme={theme} setTheme={setTheme} openSettings={() => setSettingsOpen(true)} />
      <div className="px-4">
        <CapturePanel onSubmit={handleCapture} />
        <StatsRow items={items} onDownloadAll={() => handleDownloadBulk(items.filter(i => i.status === STATUS.COMPLETED).map(i => i.id))} onStopAll={() => items.forEach(i => DV.queue.requestStop(i.id))} onRetryFailed={async () => { for (const i of items.filter(x => x.status === STATUS.ERROR)) await DV.queue.updateItem(i.id, { status: STATUS.PENDING }); DV.queue.loadQueue(); }} />
        <CommandBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} sort={sort} setSort={setSort} tagFilter={tagFilter} setTagFilter={setTagFilter} allTags={allTags} onExport={async () => saveBlob(await DV.db.exportAllToZip(), 'export.zip')} onImport={async (f) => { await DV.db.importFromZip(f); DV.queue.loadQueue(); }} />
        <Table items={displayItems} allItems={items} selected={selected} setSelected={setSelected} onSort={setSort} expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
      </div>
      <SelectionDock count={selected.length} anyActive={items.filter(i => selected.includes(i.id)).some(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status))} allSelected={selected.length === items.length} onView={() => setViewItem(items.find(i => i.id === selected[0]))} onRetry={async () => { for (const id of selected) await DV.queue.updateItem(id, { status: STATUS.PENDING }); DV.queue.loadQueue(); setSelected([]); }} onDownload={() => handleDownloadBulk(selected)} onDelete={async () => { if (confirm('Delete?')) { for (const id of selected) await DV.db.del('items', id); DV.queue.loadQueue(); setSelected([]); } }} onStop={() => selected.forEach(id => DV.queue.requestStop(id))} onSelectAll={() => setSelected(items.map(i => i.id))} onUnselectAll={() => setSelected([])} onTag={() => setTagEditorOpen(true)} />

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={s => { setSettings(s); DV.queue.setSettings(s); }} />
      <TagEditorModal open={tagEditorOpen} onClose={() => setTagEditorOpen(false)} selectedIds={selected} items={items} allTags={allTags} />
      <ErrorModal item={errorItem} onClose={() => setErrorItem(null)} />
      <ContentModal item={viewItem} onClose={() => setViewItem(null)} />
    </div>
  );
}

function ErrorModal({ item, onClose }) {
  return (
    <Modal open={!!item} onClose={onClose} title="Error Detail">
      <div className="p-4 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 rounded-lg whitespace-pre-wrap text-sm border border-rose-100 dark:border-rose-800/50">
        {item?.error || 'Unknown error'}
      </div>
    </Modal>
  );
}

function ContentModal({ item, onClose }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    if (item) DV.db.get('contents', item.id).then(c => setHtml(c?.html || ''));
  }, [item]);

  const onIframeLoad = (e) => {
    try {
      const win = e.target.contentWindow;
      const doc = e.target.contentDocument;
      if (!win || !doc) return;

      // Inject "View Mode" specific style: hide footer
      const style = doc.createElement('style');
      style.textContent = '.dv-footer { display: none !important; }';
      doc.head.appendChild(style);

      // Trigger initial theme sync
      const isDark = document.documentElement.classList.contains('dark');
      win.postMessage({ type: 'dv-theme', isDark }, '*');
    } catch (err) { }
  };

  return (
    <Modal open={!!item} onClose={onClose} title={item?.title} hideHeader>
      <div className="p-2 min-h-[400px]">
        {html ? (
          <iframe
            srcDoc={html}
            onLoad={onIframeLoad}
            className="w-full h-[75vh] border-none rounded-lg"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-[40vh] text-slate-500">
            <Icon name="loader" className="animate-spin mb-4" />
            <span>Loading content...</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);