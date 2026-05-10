/**
 * DistyVault — React application shell and UI logic
 *
 * This file is intentionally plain React (UMD) executed via Babel-in-browser.
 * It wires the UI to DV core modules available on window.DV (db, queue, bus, ai, extractors, toast).
 */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
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

function formatSize(bytes) {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return '0 B';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getKindLabel(kind) {
  if (kind === 'youtube') return 'YouTube';
  if (kind === 'playlist') return 'Playlist';
  if (kind === 'file') return 'File';
  if (kind === 'url') return 'Web';
  return kind || 'Unknown';
}

function getKindIcon(kind) {
  if (kind === 'youtube' || kind === 'playlist') return 'video';
  if (kind === 'url') return 'link';
  if (kind === 'file') return 'file';
  return 'file';
}

function Sidebar({ collapsed, setCollapsed, view, setView }) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = (localStorage.getItem('dv.theme') || 'system') === 'dark' || ((localStorage.getItem('dv.theme') || 'system') === 'system' && prefersDark);
  const logoSrc = isDark ? 'logos/logo_no_bg_w.png' : 'logos/logo_no_bg_b.png';
  const NavItem = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={classNames('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors', active ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5', collapsed && 'justify-center px-0')}>
      <Icon name={icon} size={18} />
      {!collapsed && <span>{label}</span>}
    </button>
  );
  return (
    <aside className={classNames('shrink-0 h-full border-r border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950 flex flex-col transition-all duration-200', collapsed ? 'w-[60px]' : 'w-[200px]')}>
      {/* Header: logo + collapse toggle */}
      <div className={classNames('h-14 flex items-center border-b border-slate-200 dark:border-white/5 shrink-0 px-4 justify-between', collapsed ? 'justify-center relative' : '')}>
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} className="w-full h-full flex items-center justify-center group" title="Expand Sidebar">
            <img src={logoSrc} alt="DistyVault" className="w-6 h-6 group-hover:opacity-0 transition-opacity absolute" />
            <Icon name="panel-left-open" size={20} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={logoSrc} alt="DistyVault" className="w-6 h-6 shrink-0" />
              <span className="font-semibold text-[14px] tracking-tight text-slate-900 dark:text-white truncate">DistyVault</span>
            </div>
            <button onClick={() => setCollapsed(true)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0" title="Collapse Sidebar">
              <Icon name="panel-left-close" size={16} />
            </button>
          </>
        )}
      </div>
      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        <NavItem icon="database" label="Vault" active={view === 'vault'} onClick={() => setView('vault')} />
      </nav>
      {/* Settings button at bottom */}
      <div className="p-2 border-t border-slate-200 dark:border-white/5">
        <button onClick={() => setView(view === 'settings' ? 'vault' : 'settings')} className={classNames('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors', view === 'settings' ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5', collapsed && 'justify-center px-0')}>
          <Icon name="settings" size={18} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}

function ContentHeader({ openCmd, theme, setTheme }) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  return (
    <div className="sticky top-0 z-30 h-14 flex flex-col justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-b border-slate-200 dark:border-white/5">
      <div className="w-full px-5 flex items-center justify-between">
        <button onClick={openCmd} className="flex items-center gap-2 h-8 px-3 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <Icon name="search" size={15} />
          <span className="hidden sm:inline">Search or paste URL...</span>
          <kbd className="ml-1 text-[11px] border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 font-medium">⌘ K</kbd>
        </button>
        <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <Icon name={isDark ? 'moon' : 'sun'} size={18} />
        </button>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, query, setQuery, onDistill, onAttachFiles, onOpenSettings, onExport, onImport, onRetryFailed, onDownloadAll, onStopAll, items }) {
  const inputRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  if (!open) return null;

  const q = query.trim();
  const isUrl = /^https?:\/\//i.test(q) || /(youtube\.com|youtu\.be)/i.test(q);

  const actions = [
    { id: 'attach', icon: 'paperclip', label: 'Attach Files...' , action: onAttachFiles },
    { id: 'settings', icon: 'settings', label: 'Open Settings', hint: '⌘,', action: onOpenSettings },
    { id: 'export', icon: 'hard-drive-upload', label: 'Export Vault', action: onExport },
    { id: 'import', icon: 'hard-drive-download', label: 'Import Vault', action: onImport },
    { id: 'download', icon: 'arrow-down-to-line', label: 'Download All Completed', action: onDownloadAll },
    { id: 'retry', icon: 'rotate-ccw', label: 'Retry All Failed', action: onRetryFailed },
    { id: 'stop', icon: 'square', label: 'Stop All Active', action: onStopAll },
  ];

  const matchedItems = q && !isUrl
    ? items.filter(i => (i.title?.toLowerCase().includes(q.toLowerCase()) || i.url?.toLowerCase().includes(q.toLowerCase())) && i.kind !== 'playlist').slice(0, 6)
    : [];

  function handleSubmit() {
    if (isUrl) { onDistill(q); setQuery(''); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-white/5">
          <Icon name="search" size={16} className="text-slate-400 shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && isUrl) handleSubmit(); if (e.key === 'Escape') onClose(); }} placeholder="Paste a URL to distill, or search..." className="flex-1 h-12 bg-transparent outline-none text-sm text-slate-900 dark:text-white" />
          <kbd className="text-[11px] text-slate-400 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 shrink-0">esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1 no-scrollbar">
          {isUrl && (
            <button onClick={handleSubmit} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 text-left transition-colors">
              <Icon name="zap" size={16} className="text-emerald-500" />
              <span className="text-sm"><span className="font-medium">Distill</span> <span className="text-slate-400 truncate">{q}</span></span>
            </button>
          )}
          {matchedItems.length > 0 && (
            <React.Fragment>
              <div className="px-4 pt-2 pb-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Results</div>
              {matchedItems.map(item => (
                <div key={item.id} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 text-left transition-colors cursor-default">
                  <Icon name={getKindIcon(item.kind)} size={15} className="text-slate-400 shrink-0" />
                  <span className="text-sm truncate flex-1 text-slate-700 dark:text-slate-200">{item.title}</span>
                  <StatusDot status={item.status} />
                </div>
              ))}
            </React.Fragment>
          )}
          {!q && (
            <React.Fragment>
              <div className="px-4 pt-2 pb-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Actions</div>
              {actions.map(a => (
                <button key={a.id} onClick={() => { a.action(); onClose(); }} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 text-left transition-colors">
                  <Icon name={a.icon} size={15} className="text-slate-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{a.label}</span>
                  {a.hint && <kbd className="ml-auto text-[11px] text-slate-400 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5">{a.hint}</kbd>}
                </button>
              ))}
            </React.Fragment>
          )}
          {q && !isUrl && matchedItems.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No results for &ldquo;{q}&rdquo;</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBar({ filter, setFilter, tagFilter, setTagFilter, allTags, search, setSearch }) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const tagsRef = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (tagsOpen && tagsRef.current && !tagsRef.current.contains(e.target)) setTagsOpen(false); }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [tagsOpen]);

  const kinds = [
    { k: 'all', label: 'All' },
    { k: 'url', label: 'Web' },
    { k: 'youtube', label: 'YouTube' },
    { k: 'file', label: 'Files' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 pt-6 pb-2 flex items-center gap-1 flex-wrap">
      {kinds.map(f => (
        <button key={f.k} onClick={() => setFilter(f.k)} className={classNames('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors', filter === f.k ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5')}>{f.label}</button>
      ))}
      <div className="relative ml-1" ref={tagsRef}>
        <button onClick={() => setTagsOpen(!tagsOpen)} className={classNames('px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors', tagFilter ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5')}>
          <Icon name="tag" size={13} />
          <span>{tagFilter ? '#' + tagFilter : 'Tags'}</span>
        </button>
        {tagsOpen && (
          <div className="absolute left-0 mt-1 p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg z-20 flex flex-col min-w-[140px] max-h-56 overflow-y-auto no-scrollbar">
            <button onClick={() => { setTagFilter(''); setTagsOpen(false); }} className={classNames('w-full px-3 py-2 text-left rounded-md text-[13px]', !tagFilter ? 'bg-slate-100 dark:bg-white/10 font-medium' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300')}>All Tags</button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => { setTagFilter(tag); setTagsOpen(false); }} className={classNames('w-full px-3 py-2 text-left rounded-md text-[13px] truncate', tagFilter === tag ? 'bg-slate-100 dark:bg-white/10 font-medium' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300')}>#{tag}</button>
            ))}
          </div>
        )}
      </div>
      {search && (
        <div className="ml-auto flex items-center gap-2 text-[13px] text-slate-400">
          <span>Filtering: &ldquo;{search}&rdquo;</span>
          <button onClick={() => setSearch('')} className="hover:text-slate-700 dark:hover:text-white"><Icon name="x" size={14} /></button>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }) {
  const colors = {
    [STATUS.PENDING]: 'bg-slate-300',
    [STATUS.EXTRACTING]: 'bg-amber-400 animate-pulse',
    [STATUS.DISTILLING]: 'bg-violet-400 animate-pulse',
    [STATUS.COMPLETED]: 'bg-emerald-400',
    [STATUS.ERROR]: 'bg-rose-400',
    [STATUS.STOPPED]: 'bg-slate-400'
  };
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className={classNames('w-2 h-2 rounded-full', colors[status])} />
      <span className="text-[12px] text-slate-400 capitalize">{status}</span>
    </div>
  );
}

function ItemList({ items, allItems, selected, setSelected, expandedIds, setExpandedIds, onViewItem }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const active = items.some(it => [STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status));
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [items]);

  function onRowClick(e, item) {
    if (e.metaKey || e.ctrlKey) {
      setSelected(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
      return;
    }
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

  function onDblClick(item) {
    if (item.status === STATUS.COMPLETED) onViewItem(item);
  }

  if (!items.length) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-24 text-center">
        <div className="text-slate-300 dark:text-slate-600 mb-4"><Icon name="inbox" size={48} className="mx-auto" /></div>
        <div className="text-lg font-medium text-slate-400 dark:text-slate-500">Your vault is empty</div>
        <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Press <kbd className="text-[11px] border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 font-medium mx-0.5">⌘ K</kbd> to start distilling</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 pb-24">
      <div className="border border-slate-200 dark:border-white/5 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
        {items.map(i => (
          <div key={i.id} onClick={e => onRowClick(e, i)} onDoubleClick={() => onDblClick(i)} className={classNames('flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 cursor-pointer transition-colors h-[64px]', selected.includes(i.id) ? 'bg-slate-100 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]', i.parentId && 'pl-8 sm:pl-10')}>
            {i.kind === 'playlist' && (
              <button className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white shrink-0" onClick={e => { e.stopPropagation(); setExpandedIds(prev => { const n = new Set(prev); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; }); }}>
                <span className={classNames('transition-transform inline-block', expandedIds.has(i.id) && 'rotate-90')}><Icon name="chevron-right" size={14} /></span>
              </button>
            )}
            {i.kind !== 'playlist' && <Icon name={getKindIcon(i.kind)} size={16} className="text-slate-400 shrink-0" />}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{i.title || i.url}</div>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden whitespace-nowrap">
                {i.tags?.length > 0 && i.tags.map(t => <span key={t} className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 px-1.5 py-0.5 rounded shrink-0">#{t}</span>)}
                {!i.tags?.length && i.url && <span className="text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500 truncate block w-full">{i.url}</span>}
              </div>
            </div>
            {i.kind !== 'playlist' && (
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                {[STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status) && i.startedAt && (
                  <span className="text-[10px] sm:text-[11px] text-slate-400 tabular-nums hidden sm:block">{formatDuration(now - i.startedAt)}</span>
                )}
                <StatusDot status={i.status} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectionDock({ count, selectedItems, itemsCount, onView, onRetry, onDownload, onDelete, onStop, onSelectAll, onUnselectAll, onTag }) {
  if (!count) return null;
  const canView = count === 1 && selectedItems[0]?.status === STATUS.COMPLETED;
  const canStop = selectedItems.some(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status));
  const canDownload = selectedItems.some(i => i.status === STATUS.COMPLETED);
  const allSelected = count === itemsCount;
  const Btn = ({ onClick, icon, label }) => (
    <button onClick={onClick} title={label} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"><Icon name={icon} size={16} /></button>
  );
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 h-11 px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg flex items-center gap-1 w-max max-w-[95vw]">
      <span className="text-[13px] font-medium text-slate-500 px-2 shrink-0">{count} selected</span>
      <span className="h-4 w-px bg-slate-200 dark:bg-white/10 shrink-0" />
      {canView && <Btn onClick={onView} icon="eye" label="View" />}
      {canDownload && <Btn onClick={onDownload} icon="arrow-down-to-line" label="Download" />}
      <Btn onClick={onRetry} icon="rotate-ccw" label="Retry" />
      {canStop && <Btn onClick={onStop} icon="square" label="Stop" />}
      <Btn onClick={onTag} icon="tag" label="Tag" />
      <Btn onClick={onDelete} icon="trash-2" label="Delete" />
      <span className="h-4 w-px bg-slate-200 dark:bg-white/10 shrink-0" />
      {!allSelected && <Btn onClick={onSelectAll} icon="check-square" label="Select all" />}
      <Btn onClick={onUnselectAll} icon="x" label="Deselect" />
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
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="New tag…" className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 outline-none text-sm" />
          <button onClick={() => add()} className="h-9 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Add</button>
        </div>
        {allTags.length > 0 && (
          <div>
            <div className="text-[11px] uppercase font-medium text-slate-400 mb-1.5 tracking-wider">Suggested</div>
            <div className="flex flex-wrap gap-1">
              {allTags.filter(t => !currentTags.includes(t)).map(t => (
                <button key={t} onClick={() => add(t)} className="px-2.5 py-1 text-[12px] rounded-md border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors">{t}</button>
              ))}
            </div>
          </div>
        )}
        {currentTags.length > 0 && (
          <div>
            <div className="text-[11px] uppercase font-medium text-slate-400 mb-1.5 tracking-wider">Applied</div>
            <div className="flex flex-wrap gap-1">
              {currentTags.map(t => (
                <span key={t} className="px-2.5 py-1 text-[12px] rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  {t}
                  <button onClick={async () => { for (const id of selectedIds) { const it = items.find(i => i.id === id); const ex = it?.tags || []; await DV.queue.updateTags(id, ex.filter(x => x !== t)); } }} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><Icon name="x" size={12} /></button>
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
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative max-w-2xl w-full p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
        {!hideHeader && (
          <div className="flex justify-between items-center mb-4">
            <div className="text-base font-semibold text-slate-900 dark:text-white">{title}</div>
            <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><Icon name="x" size={16} /></button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function SettingsView({ settings, setSettings, onExport, onImport, items }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => { setLocal(settings); }, [settings]);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateLocal = (u) => { setLocal(u); setDirty(true); };

  // Provider SVG logos (inline for zero-dependency rendering)
  const ProviderLogo = ({ id, size = 18 }) => {
    const s = size;
    const logos = {
      openai: <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/></svg>,
      anthropic: <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.257 0h3.604L16.744 20.48h-3.603L7.57 7.468 4.112 20.48H.508L6.57 3.52z" fill="currentColor"/></svg>,
      gemini: <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12z" fill="currentColor"/></svg>,
      deepseek: <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45"/></svg>,
      grok: <svg width={s} height={s} viewBox="0 0 34 34" fill="currentColor"><path d="M13.237 21.041L24.319 12.85c.543-.401 1.32-.245 1.578.379 1.363 3.289.754 7.242-1.957 9.956-2.71 2.714-6.482 3.309-9.929 1.953l-3.766 1.746c5.401 3.696 11.96 2.782 16.059-1.324 3.251-3.255 4.258-7.692 3.316-11.693l.009.009c-1.365-5.878.336-8.227 3.82-13.032.083-.114.165-.228.248-.344l-4.585 4.59v-.014l-15.875 15.967zm-2.287 1.99c-3.877-3.708-3.208-9.446.1-12.755 2.446-2.449 6.454-3.448 9.952-1.979l3.757-1.737c-.677-.49-1.545-1.017-2.54-1.387-4.5-1.854-9.887-.931-13.545 2.728-3.518 3.523-4.625 8.94-2.725 13.561 1.419 3.454-1.007 5.898-3.351 8.364-.83.874-1.664 1.749-2.335 2.674l10.584-9.469z" /></svg>
    };
    return logos[id] || null;
  };

  const providers = [
    { id: 'openai', name: 'OpenAI', models: [{ v: 'gpt-5.4', l: 'GPT-5.4' }, { v: 'gpt-5.4-mini', l: 'GPT-5.4 Mini' }, { v: 'gpt-5.4-nano', l: 'GPT-5.4 Nano' }] },
    { id: 'anthropic', name: 'Anthropic', models: [{ v: 'claude-opus-4.7', l: 'Claude Opus 4.7' }, { v: 'claude-sonnet-4.6', l: 'Claude Sonnet 4.6' }] },
    { id: 'gemini', name: 'Google', models: [{ v: 'gemini-3.1-pro', l: 'Gemini 3.1 Pro' }, { v: 'gemini-3-flash', l: 'Gemini 3 Flash' }, { v: 'gemini-3.1-flash-lite', l: 'Gemini 3.1 Flash-Lite' }] },
    { id: 'deepseek', name: 'DeepSeek', models: [{ v: 'deepseek-chat', l: 'DeepSeek V3.2 Chat' }, { v: 'deepseek-reasoner', l: 'DeepSeek V3.2 Reasoner' }] },
    { id: 'grok', name: 'xAI', models: [{ v: 'grok-4.3-beta', l: 'Grok 4.3 Beta' }, { v: 'grok-4.20', l: 'Grok 4.20' }, { v: 'grok-4.20-reasoning', l: 'Grok 4.20 Reasoning' }] }
  ];

  async function testKey() {
    try { setTesting(true); await DV.ai.test(local.ai); DV.toast('Connection verified', { type: 'success' }); }
    catch (e) { DV.toast(e.message || 'Connection failed', { type: 'error' }); }
    finally { setTesting(false); }
  }

  function save() { setSettings(local); setDirty(false); DV.toast('Settings saved'); }

  const inputCls = 'w-full h-10 px-3 border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 rounded-lg outline-none text-sm focus:ring-1 focus:ring-slate-300 dark:focus:ring-white/20 transition-shadow';
  const selectedProvider = providers.find(p => p.id === local.ai.mode);

  const completedCount = items?.filter(i => i.status === STATUS.COMPLETED).length || 0;
  const totalCount = items?.length || 0;

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure your AI provider and manage your vault.</p>
      </div>

      {/* AI Provider */}
      <section className="mb-8">
        <div className="text-[11px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider mb-3">AI Provider</div>
        <div className="border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-zinc-900">
          <div className="p-4">
            <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">Provider</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button onClick={() => updateLocal({ ...local, ai: { ...local.ai, mode: '', model: '' } })} className={classNames('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all', !local.ai.mode ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-zinc-900' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20')}>
                <Icon name="x-circle" size={16} /><span>None</span>
              </button>
              {providers.map(p => (
                <button key={p.id} onClick={() => updateLocal({ ...local, ai: { ...local.ai, mode: p.id, model: '' } })} className={classNames('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all', local.ai.mode === p.id ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-zinc-900' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20')}>
                  <ProviderLogo id={p.id} size={16} /><span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          {selectedProvider && (
            <div className="p-4">
              <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">Model</div>
              <select value={local.ai.model} onChange={e => updateLocal({ ...local, ai: { ...local.ai, model: e.target.value } })} className={inputCls}>
                <option value="" disabled>Select a model</option>
                {selectedProvider.models.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          )}
          <div className="p-4">
            <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">API Key</div>
            <div className="flex gap-2">
              <input type="password" value={local.ai.apiKey} onChange={e => updateLocal({ ...local, ai: { ...local.ai, apiKey: e.target.value } })} className={classNames(inputCls, 'flex-1 font-mono')} placeholder={selectedProvider ? `${selectedProvider.name} API key` : 'Select a provider first'} disabled={!local.ai.mode} />
              <button onClick={testKey} disabled={testing || !local.ai.apiKey} className={classNames('h-10 px-4 rounded-lg border text-[13px] font-medium transition-all', testing ? 'opacity-50 border-slate-200 dark:border-white/10' : local.ai.apiKey ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'border-slate-200 dark:border-white/10 text-slate-400 cursor-not-allowed')}>{testing ? <Icon name="loader" size={14} className="animate-spin" /> : 'Verify'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* Processing */}
      <section className="mb-8">
        <div className="text-[11px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider mb-3">Processing</div>
        <div className="border border-slate-200 dark:border-white/5 rounded-xl p-4 bg-white dark:bg-zinc-900">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Concurrency</div>
              <div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Number of simultaneous distillation jobs</div>
            </div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums w-8 text-center">{local.concurrency}</div>
          </div>
          <input type="range" min="1" max="10" value={local.concurrency} onChange={e => updateLocal({ ...local, concurrency: parseInt(e.target.value) })} className="w-full accent-slate-900 dark:accent-white" />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>Sequential</span><span>Parallel</span></div>
        </div>
      </section>

      {/* Data Management */}
      <section className="mb-8">
        <div className="text-[11px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider mb-3">Data Management</div>
        <div className="border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-zinc-900">
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Vault Statistics</div>
              <div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">{totalCount} items · {completedCount} completed</div>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Export Vault</div>
              <div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Download all data as a ZIP archive</div>
            </div>
            <button onClick={onExport} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"><Icon name="upload" size={14} />Export</button>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Import Vault</div>
              <div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Restore from a previously exported archive</div>
            </div>
            <button onClick={onImport} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"><Icon name="download" size={14} />Import</button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mb-8">
        <div className="text-[11px] uppercase font-semibold text-rose-400 tracking-wider mb-3">Danger Zone</div>
        <div className="border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 bg-rose-50 dark:bg-rose-950/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-rose-700 dark:text-rose-400 mb-1">Delete All Data</div>
              <div className="text-[12px] text-rose-600 dark:text-rose-500">Permanently erase all items, distilled content, and settings. This cannot be undone.</div>
            </div>
            <button onClick={() => { 
              if (confirmDelete) { 
                DV.db.clear('items').then(() => DV.db.clear('contents')).then(() => DV.db.clear('settings')).then(() => window.location.reload()); 
              } else { 
                setConfirmDelete(true); 
                setTimeout(() => setConfirmDelete(false), 3000); 
              } 
            }} className="shrink-0 h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-medium transition-colors">
              {confirmDelete ? 'Are you sure? Click again' : 'Delete Everything'}
            </button>
          </div>
        </div>
      </section>

      {/* Save */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button onClick={save} className="h-11 px-8 bg-slate-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-lg text-sm shadow-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2">
            <Icon name="check" size={16} />Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: null });

  function handleSort(key) {
    if (sort.key === key) {
      if (sort.dir === 'asc') setSort({ key, dir: 'desc' });
      else setSort({ key: null, dir: null });
    } else {
      setSort({ key, dir: 'asc' });
    }
  }

  const [theme, setThemeState] = useState(localStorage.getItem('dv.theme') || 'system');
  const [viewItem, setViewItem] = useState(null);
  const [errorItem, setErrorItem] = useState(null);
  const [appView, setAppView] = useState('vault');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('dv.sidebar') === 'collapsed');
  const [settings, setSettings] = useState({ ai: { mode: '', model: '', apiKey: '' }, concurrency: 1 });
  const [tagFilter, setTagFilter] = useState('');
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const toggleSidebar = (v) => { setSidebarCollapsed(v); localStorage.setItem('dv.sidebar', v ? 'collapsed' : 'expanded'); };

  useEffect(() => {
    if (appView === 'settings') {
      toggleSidebar(true);
    }
  }, [appView]);

  const handleItemAdded = useCallback((record) => {
    setItems(prev => {
      if (prev.some(i => i.id === record.id)) return prev;
      return [...prev, record];
    });
  }, []);

  const handleItemUpdated = useCallback((updated) => {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
  }, []);

  // Init & Events
  useEffect(() => {
    const offAdd = DV.bus.on('items:added', handleItemAdded);
    const offUpd = DV.bus.on('items:updated', handleItemUpdated);
    const offLoad = DV.bus.on('items:loaded', (i) => setItems(i));
    const offErr = DV.bus.on('ui:openError', setErrorItem);

    DV.queue.loadSettings().then(() => setSettings(DV.queue.getSettings()));
    DV.queue.loadQueue();

    return () => {
      offAdd(); offUpd(); offLoad(); offErr();
    };
  }, [handleItemAdded, handleItemUpdated]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(p => !p); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setAppView('settings'); setCmdOpen(false); return; }
      if (e.key === 'Escape') {
        if (cmdOpen) setCmdOpen(false);
        else if (viewItem) setViewItem(null);
        else if (errorItem) setErrorItem(null);
        else if (tagEditorOpen) setTagEditorOpen(false);
        else if (appView === 'settings') setAppView('vault');
        return;
      }
      if (inInput) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); if (e.shiftKey) setSelected([]); else setSelected(displayItems.map(i => i.id)); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length > 0) {
        e.preventDefault();
        if (confirm('Delete ' + selected.length + ' item(s)?')) {
          Promise.all(selected.map(id => DV.db.del('items', id))).then(() => { setSelected([]); DV.queue.loadQueue(); });
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cmdOpen, appView, viewItem, errorItem, tagEditorOpen, selected, displayItems]);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('dv.theme', t);
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    const msg = { type: 'dv-theme', isDark };
    window.postMessage(msg, '*');
    document.querySelectorAll('iframe').forEach(f => {
      try { f.contentWindow.postMessage(msg, '*'); if (f.contentDocument && f.contentDocument.documentElement) { f.contentDocument.documentElement.classList.toggle('dark', isDark); } } catch (e) { }
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
      if (!sort.key) return (a.queueIndex || 0) - (b.queueIndex || 0);
      let valA, valB;
      if (sort.key === 'title') { valA = a.title || a.url || ''; valB = b.title || b.url || ''; return sort.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA); }
      else if (sort.key === 'kind') { valA = getKindLabel(a.kind) || ''; valB = getKindLabel(b.kind) || ''; return sort.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA); }
      else if (sort.key === 'status') { valA = a.status || ''; valB = b.status || ''; return sort.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA); }
      return 0;
    });
    const out = [];
    const parents = filtered.filter(i => !i.parentId);
    parents.forEach(p => { out.push(p); if (expandedIds.has(p.id)) { filtered.filter(c => c.parentId === p.id).forEach(c => out.push(c)); } });
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
      if (url || files.length) DV.toast('Items processing');
    } catch (e) { DV.toast(e.message, { type: 'error' }); }
  };

  const handleFileDrop = async (files) => { for (const f of files) await DV.queue.addItem({ kind: 'file', title: f.name, file: f }); if (files.length) DV.toast('Files added'); };

  const handleExport = async () => {
    if (items.length === 0) {
      DV.toast("Vault is empty. Nothing to export.");
      return;
    }
    const d = new Date(); const p = n => String(n).padStart(2, '0');
    saveBlob(await DV.db.exportAllToZip(), `DistyVault_export_${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}.zip`);
  };
  const handleImport = async (f) => { await DV.db.importFromZip(f); DV.queue.loadQueue(); };

  const handleDownloadBulk = async (ids) => {
    const targets = items.filter(i => ids.includes(i.id) && i.status === STATUS.COMPLETED);
    if (!targets.length) return;

    let zip;
    if (targets.length > 1 && window.JSZip) zip = new window.JSZip();

    for (const it of targets) {
      await yieldToBrowser();
      const content = await DV.db.get('contents', it.id);
      if (!content || !content.html) continue;

      const helper = new DOMParser().parseFromString(content.html, 'text/html');
      const innerHtml = helper.querySelector('main')?.innerHTML || helper.body.innerHTML;

      const fullDate = content.meta?.dateText || new Date().toLocaleDateString();
      const sourceUrl = it.url || 'Universal Extraction';
      const escapeH = str => String(str).replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));

      const styleBlock = `
        <style>
          .pdf-wrapper { font-family: 'Inter', system-ui, sans-serif; padding: 40px 60px; color: #0f172a; background: #ffffff; }
          .pdf-wrapper h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px; line-height: 1.25; color: #0f172a; border: none; }
          .pdf-wrapper h2 { font-size: 20px; font-weight: 600; margin: 24px 0 12px; line-height: 1.3; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          .pdf-wrapper h3 { font-size: 16px; font-weight: 600; margin: 20px 0 8px; color: #0f172a; }
          .pdf-wrapper p { margin: 12px 0; color: #334155; line-height: 1.6; }
          .pdf-wrapper ul, .pdf-wrapper ol { margin: 12px 0; padding-left: 24px; color: #334155; line-height: 1.6; }
          .pdf-wrapper li { margin: 6px 0; }
          .pdf-wrapper blockquote { border-left: 3px solid #cbd5e1; padding: 8px 16px; margin: 16px 0; color: #64748b; font-style: italic; background: #f8fafc; border-radius: 0 4px 4px 0; }
          .pdf-wrapper code { font-family: monospace; font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #1e293b; }
          .pdf-wrapper pre { background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0; overflow-x: hidden; white-space: pre-wrap; word-wrap: break-word; }
          .pdf-wrapper pre code { background: none; padding: 0; }
          .pdf-wrapper a { color: #2563eb; text-decoration: none; }
          .pdf-wrapper strong, .pdf-wrapper b { font-weight: 600; color: #0f172a; }
        </style>
      `;

      const htmlString = `
        <div>
          ${styleBlock}
          <div class="pdf-wrapper">
            <div style="margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
              <h1 style="font-size: 32px; font-weight: 800; margin: 0 0 16px 0; color: #0f172a; line-height: 1.2; border: none;">${escapeH(it.title || 'Distilled Content')}</h1>
              <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;"><strong>Source:</strong> <a href="${escapeH(it.url || '')}" style="color: #2563eb; text-decoration: none;">${escapeH(sourceUrl)}</a></div>
              <div style="font-size: 14px; color: #64748b;"><strong>Date:</strong> ${escapeH(fullDate)}</div>
            </div>
            <div>${innerHtml}</div>
            <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
              Generated by DistyVault
            </div>
          </div>
        </div>
      `;

      const opt = {
        margin:       [10, 0, 10, 0],
        filename:     sanitizeFilename(it.title) + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
        const worker = window.html2pdf().set(opt).from(htmlString);
        if (zip) {
          const pdfBlob = await worker.output('blob');
          zip.file(sanitizeFilename(it.title) + '.pdf', pdfBlob);
        } else {
          await worker.save();
        }
      } catch(e) {
        console.error("PDF generation failed", e);
      }
    }
    if (zip) saveBlob(await zip.generateAsync({ type: 'blob' }), 'distyvault_export.zip');
  };

  return (
    <div className="h-screen flex bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 font-sans"
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
      onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileDrop(Array.from(e.dataTransfer.files || [])); }}>

      {isDragging && (
        <div className="fixed inset-0 z-[60] bg-white/90 dark:bg-zinc-950/90 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Icon name="upload" size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <div className="text-lg font-medium text-slate-400">Drop files to distill</div>
          </div>
        </div>
      )}

      <input type="file" multiple className="hidden" ref={fileInputRef} onChange={e => { handleCapture('', Array.from(e.target.files || [])); e.target.value = ''; }} />
      <input type="file" accept=".zip" className="hidden" ref={importInputRef} onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ''; }} />

      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={toggleSidebar} view={appView} setView={setAppView} />

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {appView === 'vault' ? (
            <>
              <ContentHeader openCmd={() => setCmdOpen(true)} theme={theme} setTheme={setTheme} />
              <FilterBar filter={filter} setFilter={setFilter} tagFilter={tagFilter} setTagFilter={setTagFilter} allTags={allTags} search={search} setSearch={setSearch} />
              <ItemList items={displayItems} allItems={items} selected={selected} setSelected={setSelected} expandedIds={expandedIds} setExpandedIds={setExpandedIds} onViewItem={item => setViewItem(item)} />
            </>
          ) : (
            <SettingsView settings={settings} setSettings={s => { setSettings(s); DV.queue.setSettings(s); }} onExport={handleExport} onImport={() => importInputRef.current?.click()} items={items} />
          )}
        </div>
      </div>

      {/* Overlays */}
      <CommandPalette
        open={cmdOpen} onClose={() => setCmdOpen(false)} query={search} setQuery={setSearch}
        onDistill={url => handleCapture(url, [])}
        onAttachFiles={() => fileInputRef.current?.click()}
        onOpenSettings={() => { setAppView('settings'); setCmdOpen(false); }}
        onExport={handleExport}
        onImport={() => importInputRef.current?.click()}
        onRetryFailed={async () => { await Promise.all(items.filter(x => x.status === STATUS.ERROR).map(i => DV.queue.resetItem(i.id))); DV.queue.loadQueue(); }}
        onDownloadAll={() => handleDownloadBulk(items.filter(i => i.status === STATUS.COMPLETED).map(i => i.id))}
        onStopAll={() => items.forEach(i => DV.queue.requestStop(i.id))}
        items={items}
      />

      <SelectionDock
        count={selected.length}
        selectedItems={items.filter(i => selected.includes(i.id))}
        itemsCount={displayItems.length}
        onView={() => setViewItem(items.find(i => i.id === selected[0]))}
        onRetry={async () => { await Promise.all(selected.map(id => DV.queue.resetItem(id))); setSelected([]); DV.queue.loadQueue(); }}
        onDownload={() => handleDownloadBulk(selected)}
        onDelete={async () => { if (confirm('Delete?')) { await Promise.all(selected.map(id => DV.db.del('items', id))); setSelected([]); DV.queue.loadQueue(); } }}
        onStop={() => selected.forEach(id => DV.queue.requestStop(id))}
        onSelectAll={() => setSelected(displayItems.map(i => i.id))}
        onUnselectAll={() => setSelected([])}
        onTag={() => setTagEditorOpen(true)}
      />

      <TagEditorModal open={tagEditorOpen} onClose={() => setTagEditorOpen(false)} selectedIds={selected} items={items} allTags={allTags} />
      <ErrorModal item={errorItem} onClose={() => setErrorItem(null)} />
      <ContentViewer item={viewItem} onClose={() => setViewItem(null)} onDownload={handleDownloadBulk} />
    </div>
  );
}


function ErrorModal({ item, onClose }) {
  return (
    <Modal open={!!item} onClose={onClose} title="Error Detail">
      <div className="p-4 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200 rounded-lg whitespace-pre-wrap text-sm border border-rose-100 dark:border-rose-900/50">
        {item?.error || 'Unknown error'}
      </div>
    </Modal>
  );
}

function ContentViewer({ item, onClose, onDownload }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    DV.db.get('contents', item.id).then(c => {
      setContent(c);
      setLoading(false);
    });
  }, [item]);

  if (!item) return null;

  const renderMarkdown = (html) => {
    if (!html) return '';
    // Parse Markdown if marked is available, otherwise render as HTML
    if (typeof marked !== 'undefined') {
      // Try to extract raw markdown from the HTML's content
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      // Look for a <main> or body content
      const mainEl = tmp.querySelector('main');
      const raw = mainEl ? mainEl.innerHTML : tmp.innerHTML;
      // If it's already HTML from the old pipeline, just sanitize it
      if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(raw);
      return raw;
    }
    return html;
  };

  const renderedHtml = content?.html ? renderMarkdown(content.html) : '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 h-14 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-5 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0" title="Back (Esc)">
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">{item.title}</div>
            {item.url && <div className="text-[12px] text-slate-400 dark:text-slate-500 truncate">{item.url}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onDownload && (
            <button onClick={() => onDownload([item.id])} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border border-slate-200 dark:border-white/10">
              <Icon name="download" size={14} />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" ref={contentRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Icon name="loader" size={24} className="animate-spin mb-3" />
            <span className="text-sm">Loading content…</span>
          </div>
        ) : !renderedHtml ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Icon name="file-x" size={32} className="mb-3 opacity-50" />
            <span className="text-sm">No content available</span>
          </div>
        ) : (
          <article className="max-w-3xl mx-auto px-6 sm:px-10 py-10 pb-24">
            {/* Meta bar */}
            <div className="mb-8 pb-6 border-b border-slate-200 dark:border-white/5">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-3">{item.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-400 dark:text-slate-500">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors truncate max-w-[300px]">
                    <Icon name="external-link" size={13} />{new URL(item.url).hostname}
                  </a>
                )}
                {item.tags?.length > 0 && item.tags.map(t => <span key={t} className="text-slate-400 dark:text-slate-500">#{t}</span>)}
                {content?.meta?.dateText && <span>{content.meta.dateText}</span>}
              </div>
            </div>
            {/* Rendered body */}
            <div className="dv-reader-body prose prose-slate dark:prose-invert max-w-none text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          </article>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);