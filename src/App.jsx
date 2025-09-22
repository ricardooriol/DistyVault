/**
 * DistyVault — React application shell and UI logic
 *
 * This file is intentionally plain React (UMD) executed via Babel-in-browser.
 * It wires the UI to DV core modules available on window.DV (db, queue, bus, ai, extractors, toast).
 *
 * Design notes:
 * - No build step: loaded in index.html using <script type="text/babel">; avoid syntax or APIs that won't transpile.
 * - All side effects live inside this IIFE to avoid polluting global scope; only React root render is emitted.
 * - Dark mode is controlled by a class on <html>; we mirror theme state into iframes via postMessage for parity.
 * - For long-running UI tasks (PDF generation, ZIP creation) we yield to the browser to keep the UI responsive.
 */
(function(){
  const { useState, useEffect, useMemo, useRef } = React;

  const STATUS = DV.queue.STATUS;

  function classNames(...arr){ return arr.filter(Boolean).join(' '); }

  /**
   * Yield control to the browser so rendering/painting can catch up.
   *
   * Uses requestIdleCallback if present, otherwise falls back to rAF or setTimeout.
   * Handy when iterating over large lists (e.g., bulk ZIP/PDF) to avoid jank.
   */
  function yieldToBrowser(){
    return new Promise(resolve => {
      if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(() => resolve());
      if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(() => resolve());
      setTimeout(resolve, 0);
    });
  }

  /**
   * Save a Blob to disk with best-effort UX across environments.
   *
   * Strategy (first that succeeds wins):
   * - File System Access API (showSaveFilePicker) on modern desktop browsers (not iOS)
   * - Web Share API with files on mobile (if supported)
   * - iOS: open Blob URL in a new tab (download attribute is ignored by Safari iOS)
   * - Fallback: programmatic <a download> click
   *
   * All branches are wrapped defensively to ignore user cancelation errors.
   *
   * @param {Blob} blob - The data to persist
   * @param {string} filename - Suggested filename
   */
  async function saveBlob(blob, filename){
    const ua = typeof navigator !== 'undefined' ? navigator : null;
    const isMobile = !!(ua && (
      (ua.userAgentData && ua.userAgentData.mobile) ||
      /Android|iPhone|iPad|iPod/i.test(ua.userAgent || '') ||
      ((ua.platform === 'MacIntel' || ua.platform === 'MacPPC') && ua.maxTouchPoints > 1)
    ));
    const isIOS = !!(ua && (/iPad|iPhone|iPod/i.test(ua.userAgent || '') || ((ua.platform === 'MacIntel' || ua.platform === 'MacPPC') && ua.maxTouchPoints > 1)));
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

    try {
      if (!isIOS && window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: ['.' + (filename.split('.').pop() || 'bin')] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (e) {
      const msg = String(e && (e.name || e.message || e));
      if (/AbortError|NotAllowedError|cancell?ed/i.test(msg)) return;
    }

    try {
      const supportsShareFiles = !!(ua && typeof ua.share === 'function' && ua.canShare && ua.canShare({ files: [file] }));
      if (isMobile && supportsShareFiles) {
        await ua.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      const msg = String(e && (e.name || e.message || e));
      if (/AbortError|NotAllowedError|cancell?ed/i.test(msg)) return;
    }

    if (isIOS) {
      const urlIOS = URL.createObjectURL(blob);
      try {
        window.open(urlIOS, '_blank');
      } finally {
        setTimeout(()=> { URL.revokeObjectURL(urlIOS); }, 10000);
      }
      return;
    }

    try {
      if (!isMobile && typeof window.saveAs === 'function') {
        window.saveAs(blob, filename);
        return;
      }
    } catch {}

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=> { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  /**
   * Icon — wrapper for lucide/feather UMD icon sets.
   *
   * We inject the desired icon name into a <span> and ask lucide/feather to replace it with an SVG.
   * Size is enforced post-render by directly sizing the resulting SVG node.
   */
  function Icon({ name, size = 20, className, strokeWidth = 2 }){
    const wrapRef = React.useRef(null);
    React.useEffect(() => {
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
      } catch {}
    }, [name, size, strokeWidth]);
    return React.createElement('span', {
      ref: wrapRef,
      className: ['dv-icon pointer-events-none inline-flex items-center justify-center', className || ''].join(' '),
      style: { width: size + 'px', height: size + 'px', display: 'inline-flex' },
      'aria-hidden': true
    });
  }

  /**
   * TopBar — app header with logo and quick actions.
   * @param {{theme: 'light'|'dark'|'system', setTheme: (t:string)=>void, openSettings: ()=>void}} props
   */
  function TopBar({ theme, setTheme, openSettings }) {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    const themeIcon = isDark ? 'moon' : 'sun';
    const logoSrc = isDark ? 'logos/logo_no_bg_w.png' : 'logos/logo_no_bg_b.png';

    return (
      <div className="sticky top-0 z-40 glass bg-white/80 dark:bg-slate-900/70 border-b border-slate-300 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="DistyVault" className="w-8 h-8 rounded-full shadow"/>
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">DistyVault</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">Gather, distill and control your knowledge</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=> setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
            >
              <Icon name={themeIcon} />
            </button>
            <button onClick={openSettings} title="Settings" aria-label="Settings" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white bg-white dark:bg-slate-800">
              <Icon name="settings" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * CapturePanel — entry for URLs and file uploads (drag/drop + picker).
   *
   * The component keeps a local list of selected files until submission.
   * Keyboard focus behavior: input is standard; drag-and-drop focuses the drop zone visually.
   */
  function CapturePanel({ onSubmit, onFilesSelected }) {
    const [url, setUrl] = useState('');
    const [files, setFiles] = useState([]);
    const dropRef = useRef(null);

    function choose(evt){
      const f = Array.from(evt.target.files || []);
      if (f.length) {
        setFiles(prev => [...prev, ...f]);
        onFilesSelected && onFilesSelected(f);
      }
    }

    function onDrop(e){
      e.preventDefault();
      const f = Array.from(e.dataTransfer.files || []);
      if (f.length) {
        setFiles(prev => [...prev, ...f]);
        onFilesSelected && onFilesSelected(f);
      }
      dropRef.current?.classList.remove('ring-2','ring-brand-500');
    }

    function onDragOver(e){ e.preventDefault(); dropRef.current?.classList.add('ring-2','ring-brand-500'); }
    function onDragLeave(){ dropRef.current?.classList.remove('ring-2','ring-brand-500'); }

    function removeFile(i){ setFiles(prev => prev.filter((_,idx)=> idx!==i)); }
    function clearFiles(){ setFiles([]); }

    async function submit(){
      const trimmed = url.trim();
      await onSubmit(trimmed, files);
      setUrl('');
      setFiles([]);
    }

    return (
  <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} className="max-w-6xl mx-auto mt-6 p-4 rounded-2xl border border-slate-400 dark:border-white/20 bg-white/90 dark:bg-slate-800/60 glass">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-0 relative">
              <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a URL or YouTube link" className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"/>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white"><Icon name="link" /></div>
            </div>
            <label className="h-12 w-12 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-800 flex items-center justify-center cursor-pointer text-slate-900 dark:text-white" title="Choose files" aria-label="Choose files">
              <input type="file" multiple className="hidden" onChange={choose} />
              <Icon name="paperclip" />
            </label>
            <button onClick={submit} title="Distill" aria-label="Distill" className="h-12 w-12 rounded-xl bg-brand-700 text-white hover:bg-brand-800 flex items-center justify-center"><Icon name="wand-2" /></button>
          </div>

          {files.length > 0 && (
            <div className="text-sm flex items-center gap-2 flex-wrap">
              {files.slice(0,6).map((f,i)=> (
                <div key={i} className="px-2 py-1 border rounded-full text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 flex items-center gap-2">
                  <span className="truncate max-w-[160px]">{f.name}</span>
                  <button onClick={()=>removeFile(i)} className="text-slate-400 hover:text-slate-700"><Icon name="x" /></button>
                </div>
              ))}
              {files.length > 6 && <span className="text-slate-500">+{files.length-6} more</span>}
                <button onClick={clearFiles} className="ml-auto inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
                  <Icon name="trash-2" />
                  <span>Remove all</span>
                </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * StatsRow — summary cards for queue state (completed/in-progress/errors).
   * Actions are contextual (disabled when the count is zero).
   */
  function StatsRow({ items, onDownloadAll, onStopAll, onRetryFailed }){
    const completed = items.filter(i=> i.status===STATUS.COMPLETED).length;
    const inprog = items.filter(i=> [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).length;
    const errors = items.filter(i=> i.status===STATUS.ERROR).length;

    const Card = ({label,count,action,actionText,bg}) => (
      <div className={classNames('flex-1 p-3 rounded-xl border border-slate-300 dark:border-white/20', bg)}>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">{count}</div>
          {action && (
            <button
              onClick={action}
              className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label={typeof label==='string' ? label+' action' : 'action'}
            >
              {actionText}
            </button>
          )}
        </div>
      </div>
    );

    return (
      <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
  <Card label="Completed" count={completed} action={completed?onDownloadAll:null} actionText={<Icon name="arrow-down-to-line" />} />
        <Card label="In Progress" count={inprog} action={inprog?onStopAll:null} actionText={<Icon name="square" />} />
        <Card label="Errors" count={errors} action={errors?onRetryFailed:null} actionText={<Icon name="refresh-ccw" />} />
      </div>
    );
  }

  /**
   * CommandBar — filter/search/sort and import/export controls.
   *
   * Search input appears inline and auto-focuses when toggled.
   * Filter menu closes on outside click via a document-level listener.
   */
  function CommandBar({ filter, setFilter, search, setSearch, onExport, onImport, sort, setSort }){
    const [expanded, setExpanded] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef(null);
    useEffect(()=> { if (!search) setExpanded(false); }, [search]);
    useEffect(()=>{
      function onDoc(e){ if (filterOpen && filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); }
      document.addEventListener('click', onDoc);
      return ()=> document.removeEventListener('click', onDoc);
    }, [filterOpen]);

    return (
  <div className="max-w-6xl mx-auto mt-6 px-4 py-3 rounded-2xl border border-slate-400 dark:border-white/20 bg-white/90 dark:bg-slate-800/60 glass">
        <div className="flex items-center gap-3 relative">
          <div className="relative z-30">
            <button onClick={()=> setExpanded(v=>!v)} className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800" title="Search"><Icon name="search" /></button>
          </div>
          {expanded && (
            <input
              autoFocus
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search…"
              className="absolute left-0 top-0 h-9 w-full max-w-[600px] pl-12 pr-3 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900 outline-none shadow z-40 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          )}
          <div className="relative z-20" ref={filterRef}>
            <button onClick={()=> setFilterOpen(v=>!v)} title="Filter" aria-label="Filter"
              className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800">
              <Icon name={filter === 'all' ? 'asterisk' : filter === 'url' ? 'link' : filter === 'youtube' ? 'video' : filter === 'file' ? 'file' : 'asterisk'} />
            </button>
            {filterOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 p-1 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-lg z-50 flex flex-col gap-2">
                {[
                  {k:'all', icon:'asterisk', label:'All'},
                  {k:'url', icon:'link', label:'URL'},
                  {k:'youtube', icon:'video', label:'YouTube'},
                  {k:'file', icon:'file', label:'File'},
                ].map(({k,icon,label})=> (
                  <button key={k} onClick={()=> { setFilter(k); setFilterOpen(false); }}
                    className={classNames('w-9 h-9 flex items-center justify-center rounded-lg',
                      filter===k ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-100')}
                    title={label} aria-label={label}
                  >
                    <Icon name={icon} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
              <button onClick={onImport} title="Import" aria-label="Import" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="download" /></button>
              <button onClick={onExport} title="Export" aria-label="Export" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800"><span style={{display:'inline-block',transform:'rotate(180deg)'}}><Icon name="download" /></span></button>
              <label className="hidden">
                <input type="file" className="hidden" accept="application/zip" onChange={e=> e.target.files?.[0] && onImport(e.target.files[0])} />
              </label>
          </div>
        </div>
      </div>
    );
  }

  /**
   * StatusChip — colored badge representing queue state.
   */
  function StatusChip({ status, onClick }){
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

  /**
   * Table — main items list with selection, status and duration.
   *
   * Selection model rules:
   * - Clicking a playlist toggles selection of the playlist and all its children as a group.
   * - Clicking a child toggles itself; if all siblings are selected, the parent playlist becomes selected.
   * - Selection state is lifted via setSelected so the Dock can act on it.
   */
  function Table({ items, allItems, selected, setSelected, onView, onRetry, onDownload, onDelete, onSort, expandedIds, setExpandedIds }){
    // Helper to determine if item is a child of a playlist
    function isPlaylistChild(item) {
      const parent = allItems.find(x => x.id === item.parentId);
      return parent && parent.kind === 'playlist';
    }
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
      const active = items.some(it => [STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status));
      if (!active) return;
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, [items]);
    function toggle(id){
      setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
    }
    function displayDuration(it){
      const active = [STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status);
      const base = active && it.startedAt ? (now - it.startedAt) : (it.durationMs || 0);
      return base > 0 ? formatDuration(base) : '-';
    }

    function onRowClick(e, item){
      if (item.kind === 'playlist') {
        const isSelected = selected.includes(item.id);
        const childIds = allItems.filter(x => x.parentId === item.id).map(x => x.id);
        if (isSelected) {
          setSelected(prev => prev.filter(id => id !== item.id && !childIds.includes(id)));
        } else {
          setSelected(prev => Array.from(new Set([...prev, item.id, ...childIds])));
        }
      } else if (item.parentId) {
        const isSelected = selected.includes(item.id);
        const siblings = allItems.filter(x => x.parentId === item.parentId);
        let next = selected.slice();
        if (isSelected) next = next.filter(id => id !== item.id);
        else next = Array.from(new Set([...next, item.id]));
        const allSelected = siblings.every(s => next.includes(s.id));
        if (allSelected) next = Array.from(new Set([...next, item.parentId]));
        else next = next.filter(id => id !== item.parentId);
        setSelected(next);
      } else {
        toggle(item.id);
      }
    }

    return (
      <div className="max-w-6xl mx-auto mt-4 rounded-2xl border border-slate-300 dark:border-white/20 overflow-hidden">
        <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[720px] table-fixed rounded-2xl overflow-hidden">
          <thead className="bg-slate-100 dark:bg-slate-800/70 select-none">
            <tr>
              <th className="w-[60%] p-2 pl-4 text-left cursor-pointer" onClick={()=>onSort && onSort('title')}>Name</th>
              <th className="w-[20%] p-2 text-center cursor-pointer" onClick={()=>onSort && onSort('status')}>Status</th>
              <th className="w-[20%] p-2 text-center relative">
                <span className="cursor-pointer" onClick={()=>onSort && onSort('duration')}>Duration</span>
                <button title="Reset sort" aria-label="Reset sort" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" onClick={()=>onSort && onSort('queue')}><Icon name="rotate-ccw" /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-slate-600 dark:text-slate-300">Paste a URL or upload a document to get started</td></tr>
            )}
            {items.map(i => (
              <tr key={i.id} onClick={(e)=>onRowClick(e, i)} className={classNames('border-t border-slate-200 dark:border-white/10 cursor-pointer', selected.includes(i.id) ? 'bg-brand-50/70 dark:bg-brand-600/10' : '', isPlaylistChild(i) ? 'pl-8' : '')}>
                <td className={classNames('p-2 pl-4 text-left', isPlaylistChild(i) ? 'pl-8' : '')}>
                  {i.kind === 'file' ? (
                    <div className="overflow-hidden">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{i.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 invisible select-none">placeholder</div>
                    </div>
                  ) : i.kind === 'playlist' ? (
                    <PlaylistRowName i={i} expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
                  ) : (
                    <div className="overflow-hidden">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {(i.title && i.title !== i.url) ? i.title : 
                         (i.status === STATUS.PENDING ? `Loading from ${i.title}...` : 
                          (i.status === STATUS.EXTRACTING ? 'Extracting title...' : i.title))}
                      </div>
                      {i.url ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{i.url}</div>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 invisible select-none">placeholder</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-2 text-center">
                  {i.kind === 'playlist' ? null : (
                    <StatusChip status={i.status} onClick={(e)=>{ e.stopPropagation(); if (i.status===STATUS.ERROR) DV.bus.emit('ui:openError', i); }} />
                  )}
                </td>
                <td className="p-2 text-sm text-slate-700 dark:text-slate-200 text-center">{i.kind === 'playlist' ? '' : displayDuration(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  }

  /**
   * PlaylistRowName — name cell for playlist rows with expand/collapse affordance.
   */
  function PlaylistRowName({ i, expandedIds, setExpandedIds }){
    const expanded = expandedIds && expandedIds.has(i.id);
    return (
      <div className="overflow-hidden flex items-center gap-2">
        <button
          className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center"
          title={expanded ? 'Collapse' : 'Expand'}
          onClick={(e)=>{ e.stopPropagation(); setExpandedIds(prev=>{ const n=new Set(prev); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; }); }}
        >
          <span className={expanded ? 'rotate-90 transition-transform flex items-center justify-center w-full h-full' : 'rotate-0 transition-transform flex items-center justify-center w-full h-full'}>
            <Icon name="chevron-right" />
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate ml-1">{i.title}</div>
          {i.url ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate ml-1">{i.url}</div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 invisible select-none ml-1">placeholder</div>
          )}
        </div>
      </div>
    );
}

// Helper to determine if item is a YouTube playlist
function isYouTubePlaylist(item) {
  return item.kind === 'playlist' && item.title && (typeof item.title === 'string') && /youtube/i.test(item.title);
}
  }

  /**
   * formatDuration — render milliseconds as Xm Ys.
   */
  function formatDuration(ms){
    const s = Math.round(ms/1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s/60), r = s%60;
    return `${m}m ${r}s`;
  }

  /**
   * SelectionDock — floating actions for the current selection.
   *
   * Appears only when at least one item is selected. "View" is offered only when exactly one item is selected.
   */
  function SelectionDock({ count, anyActive, allSelected, onView, onRetry, onDownload, onDelete, onStop, onSelectAll, onUnselectAll }){
    if (!count) return null;
    // Disable view/download if any selected item is in process/error/stopped
    const disableViewDownload = (items, selected) => {
      return selected.some(id => {
        const item = items.find(i => i.id === id);
        return item && [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING, STATUS.ERROR, STATUS.STOPPED].includes(item.status);
      });
    };
    const isDisabled = disableViewDownload(window.DV.queue.items || [], window.DV.queue.selected || []);
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-full border border-slate-300 dark:border-white/20 bg-white/90 dark:bg-slate-800/80 glass shadow max-w-[95vw]">
        <div className="overflow-x-auto">
          <div className="inline-flex items-center gap-2 whitespace-nowrap">
            {count === 1 && (
              <button onClick={onView} disabled={isDisabled} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800 disabled:opacity-50"><Icon name="eye" /><span>View</span></button>
            )}
            <button onClick={onRetry} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="refresh-ccw" /><span>Retry</span></button>
            {anyActive && <button onClick={onStop} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="square" /><span>Stop</span></button>}
            <button onClick={onDownload} disabled={isDisabled} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800 disabled:opacity-50"><Icon name="arrow-down-to-line" /><span>Download</span></button>
            <button onClick={onDelete} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="trash" /><span>Delete</span></button>
            <span className="mx-2 h-5 w-px bg-slate-300/60 dark:bg-white/20" />
            <div className="text-sm">{count} selected</div>
            {!allSelected && (
              <button onClick={onSelectAll} className="text-sm text-slate-900 dark:text-white inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-400 dark:border-white/30">
                <Icon name="check-square" />
                <span>Select all</span>
              </button>
            )}
            <button onClick={onUnselectAll} className="text-sm text-slate-900 dark:text-white inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-400 dark:border-white/30">
              <Icon name="x" />
              <span>Unselect all</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Modal — accessible dialog with optional headerless style.
   *
   * Close affordance: overlay click, explicit close button; Escape is handled globally in App for selection only.
   */
  function Modal({ open, onClose, title, children, hideHeader }){
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
        <div className="relative max-w-3xl w-full mx-4 p-4 rounded-2xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 shadow-xl">
          {!hideHeader && (
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-800 dark:text-slate-100"><Icon name="x" /></button>
            </div>
          )}
          {hideHeader && (
            <button onClick={onClose} title="Close" aria-label="Close" className="absolute top-2 right-2 w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-800 dark:text-slate-100 bg-white/70 dark:bg-slate-800/70 backdrop-blur">
              <Icon name="x" />
            </button>
          )}
          <div className="max-h-[70vh] overflow-auto">{children}</div>
        </div>
      </div>
    );
  }

  /**
   * SettingsDrawer — provider/model/key configuration + concurrency.
   *
   * All edits are staged locally and committed via setSettings() on Save.
   * The Test button calls DV.ai.test() for the selected provider using the given API key.
   */
  function SettingsDrawer({ open, onClose, settings, setSettings }){
  const DEFAULTS = { ai: { mode: '', model: '', apiKey: '' }, concurrency: 1 };
  const [local, setLocal] = useState(settings || DEFAULTS);
    const [testing, setTesting] = useState(false);
    useEffect(()=> {
      const cloned = settings ? { ...settings, ai: { ...(settings.ai||{}) } } : { ...DEFAULTS };
      setLocal(cloned);
    }, [settings]);

  function save(){ setSettings(local); DV.toast('Settings saved', { type: 'success' }); onClose(); }
    function reset(){
      setLocal({ ...DEFAULTS });
      setTesting(false);
    }
    async function testKey(){
      try {
        setTesting(true);
        await DV.ai.test(local.ai);
        DV.toast('API key works', { type: 'success' });
      } catch (e) {
        DV.toast(e?.message || 'API key test failed', { type: 'error' });
      } finally {
        setTesting(false);
      }
    }

    return (
      <div className={classNames('fixed inset-0 z-50', open ? '' : 'pointer-events-none')}> 
        <div className={classNames('absolute inset-0 bg-black/30 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose}></div>
        <div className={classNames('absolute right-0 top-0 h-full w-full max-w-md p-4 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 transition-transform', open ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold">Settings</div>
            <button onClick={onClose} title="Close" aria-label="Close" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800">
              <Icon name="x" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">AI Provider</div>
              <select
                value={local.ai.mode || ''}
                onChange={e=> setLocal({...local, ai:{...local.ai, mode:e.target.value, model:''}})}
                className="w-full h-10 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 px-2">
                <option value="">Select a provider</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="deepseek">Deepseek</option>
                <option value="gemini">Google Gemini</option>
                <option value="grok">Grok</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            {local.ai.mode && (
              <>
                <div>
                  <div className="text-sm font-medium mb-1">Model</div>
                  <select
                    value={local.ai.model || ''}
                    onChange={e=> setLocal({...local, ai:{...local.ai, model:e.target.value}})}
                    className="w-full h-10 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 px-2">
                    <option value="">Select a model</option>
                    {local.ai.mode === 'anthropic' && [
                      'claude-opus-4-20250514',
                      'claude-sonnet-4-20250514',
                      'claude-3-7-sonnet-latest',
                      'claude-3-5-haiku-latest',
                    ].map(m => <option key={m} value={m}>{m}</option>)}
                    {local.ai.mode === 'deepseek' && [
                      'deepseek-chat',
                      'deepseek-reasoner',
                    ].map(m => <option key={m} value={m}>{m}</option>)}
                    {local.ai.mode === 'gemini' && [
                      'gemini-2.5-pro',
                      'gemini-2.5-flash',
                      'gemini-2.5-flash-lite',
                    ].map(m => <option key={m} value={m}>{m}</option>)}
                    {local.ai.mode === 'grok' && [
                      'grok-4-0709',
                      'grok-3',
                      'grok-3-mini',
                      'grok-3-fast',
                    ].map(m => <option key={m} value={m}>{m}</option>)}
                    {local.ai.mode === 'openai' && [
                      'o3-mini',
                      'o4-mini',
                      'gpt-4o',
                      'gpt-4.1',
                    ].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">API Key</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={local.ai.apiKey || ''}
                      onChange={e=> { setLocal({...local, ai:{...local.ai, apiKey:e.target.value}}); }}
                      placeholder="Paste a valid API Key"
                      className={classNames('flex-1 h-10 rounded-lg bg-white dark:bg-slate-900/60 px-2 text-sm text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-white/30')}/>
                    <button
                      onClick={testKey}
                      disabled={!local.ai.mode || !local.ai.apiKey || testing}
                      className="px-3 h-10 rounded-lg border border-slate-400 dark:border-white/30 disabled:opacity-50 text-slate-900 dark:text-white bg-white dark:bg-slate-800 inline-flex items-center gap-2">
                      <Icon name="beaker" />
                      <span>{testing ? 'Testing…' : 'Test'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
            <div>
              <div className="text-sm font-semibold mb-1 text-slate-900 dark:text-slate-100">Simultaneous processing</div>
              <input type="range" min="1" max="10" value={local.concurrency} onChange={e=> setLocal({...local, concurrency: Number(e.target.value)})} />
              <div className="mt-1 inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <Icon name="sliders" />
                <span>{local.concurrency}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={save} className="px-3 h-10 rounded-lg bg-brand-700 text-white inline-flex items-center gap-2">
              <Icon name="save" />
              <span>Save</span>
            </button>
            <button onClick={reset} className="px-3 h-10 rounded-lg border border-slate-400 dark:border-white/30 text-slate-900 dark:text-white bg-white dark:bg-slate-800 inline-flex items-center gap-2">
              <Icon name="rotate-ccw" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * App — main application component.
   *
   * Responsibilities:
   * - Subscribe to DV.bus events to keep the UI synchronized with queue/db mutations
   * - Drive theme toggling and propagate theme to child iframes
   * - Orchestrate item creation (URLs, files, YouTube, playlists) and previews
   * - Provide bulk actions (export/import, retry/stop, download/delete)
   */
  function App(){
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState([]);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState(localStorage.getItem('dv.sort') || 'queue');
    const [theme, setThemeState] = useState(localStorage.getItem('dv.theme') || 'system');
    const [viewItem, setViewItem] = useState(null);
    const [errorItem, setErrorItem] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ ai:{ mode: '', model: '', apiKey:'' }, concurrency: 1 });
    const [now, setNow] = useState(Date.now());

    useEffect(()=> {
      const off1 = DV.bus.on('items:loaded', setItems);
      const off2 = DV.bus.on('items:added', async ()=> setItems(await DV.db.getAll('items')));
      const off3 = DV.bus.on('items:updated', async ()=> setItems(await DV.db.getAll('items')));
      const off4 = DV.bus.on('ui:openError', setErrorItem);
      DV.queue.loadSettings().then(()=> setSettings(DV.queue.getSettings()));
      DV.queue.loadQueue();
      return () => { off1(); off2(); off3(); off4(); };
    }, []);

    useEffect(()=> { localStorage.setItem('dv.sort', sort); }, [sort]);


    /**
     * Apply theme preference and propagate to iframes.
     * Uses class on <html> and postMessage to embedded viewers for live sync.
     */
    function setTheme(t){
      setThemeState(t);
      localStorage.setItem('dv.theme', t);
      const isDark = t === 'dark' || (t==='system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      try {
        const msg = { type: 'dv-theme', isDark };
        document.querySelectorAll('iframe').forEach(fr => {
          try { fr.contentWindow && fr.contentWindow.postMessage(msg, '*'); } catch {}
        });
        window.postMessage(msg, '*');
      } catch {}
    }

    /**
     * Persist settings to DV.queue and update local state.
     */
    function applySettings(s){
      setSettings(s);
      DV.queue.setConcurrency(s.concurrency);
      DV.queue.setSettings(s);
    }

    /**
     * Handle submissions from CapturePanel.
     *
     * - URLs: Detect playlist vs single video vs page; add parent then children for playlists
     * - Files: Add records with File blobs so extractor can read them later
     * - Optimistically peek title for URLs/YouTube to improve UX while extraction runs
     */
    async function handleSubmit(url, files){
      const additions = [];
      if (url) {
        try {
          const isPlaylist = DV.extractors.isYouTubePlaylist && DV.extractors.isYouTubePlaylist(url);
          if (isPlaylist) {
            const { items: vids, title: plTitle } = await DV.extractors.extractYouTubePlaylist(url);
            if (!vids || !vids.length) throw new Error('No videos found in playlist');
            const parent = await DV.queue.addItem({ kind: 'playlist', url, title: plTitle || 'YouTube Playlist' });
            const LIMIT = 100;
            const list = vids.slice(0, LIMIT);
            for (const v of list) {
              additions.push(DV.queue.addItem({ kind: 'youtube', url: v.url, title: v.title || v.url, parentId: parent.id }));
            }
          } else {
            const isYt = DV.extractors.isYouTube(url);
            const kind = isYt ? 'youtube' : 'url';
            const placeholder = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || url;
            const recPromise = DV.queue.addItem({ kind, url, title: placeholder });
            additions.push(recPromise);
            recPromise.then(async rec => {
              try {
                const peek = isYt
                  ? (DV.extractors.peekYouTubeTitle ? await DV.extractors.peekYouTubeTitle(url) : null)
                  : (DV.extractors.peekTitle ? await DV.extractors.peekTitle(url) : null);
                if (peek && peek.title) await DV.queue.updateItem(rec.id, { title: peek.title, url: peek.url || url });
              } catch {}
            });
          }
        } catch (e) {
          DV.toast(String(e && (e.message || e)), { type: 'error' });
        }
      }
      for (const f of files) additions.push(DV.queue.addItem({ kind:'file', title: f.name, fileName: f.name, size: f.size, file: f, fileType: f.type }));
      await Promise.all(additions);
      if (!DV.extractors.isYouTubePlaylist || !DV.extractors.isYouTubePlaylist(url)) DV.toast('Added to queue', { type: 'success' });
    }

    /** Convert HTML fragment into plain text using DOMParser. */
    async function htmlToPlainText(html=''){
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body?.innerText || '').trim();
    }

    /**
     * Parse distilled HTML points back into a structured representation.
     * Returns null if the content is not using the dv-point markup.
     */
    function parseFormattedPoints(html=''){
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const sections = Array.from(doc.querySelectorAll('section.dv-point'));
        if (!sections.length) return null;
        return sections.map(sec => {
          const head = (sec.querySelector('.dv-head')?.textContent || '').trim();
          const paras = Array.from(sec.querySelectorAll('.dv-body p')).map(p => (p.textContent||'').trim());
          return { head, paras };
        });
      } catch { return null; }
    }

    /** Extract header metadata (title, source, date) from distilled HTML. */
    function parseHeaderMeta(html=''){
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const h1 = (doc.querySelector('h1')?.textContent || '').trim();
        const source = doc.querySelector('.dv-meta strong + a, .dv-meta strong + span');
        const srcText = (source?.textContent || '').trim();
        const dateText = (doc.querySelector('.dv-meta + .dv-meta')?.textContent || '').replace(/^Date:\s*/,'').trim();
        return { h1, srcText, dateText };
      } catch { return { h1: title, srcText: '', dateText: '' }; }
    }

    /**
     * Render distilled HTML into a PDF Blob using jsPDF (if present),
     * otherwise fall back to returning the original HTML as a text/html Blob.
     *
     * The layout aims for legible A4 pages with margins and simple headers.
     * Theme is not applied in PDF; colors are neutral for readability.
     */
    async function makePdfBlobFromHtml(html, title='Document'){
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        return new Blob([html], { type: 'text/html' });
      }
      const points = parseFormattedPoints(html);
      const text = points ? '' : await htmlToPlainText(html);
      const meta = parseHeaderMeta(html);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const footerSpace = 40;
      const usableBottom = () => pageHeight - margin - footerSpace;
      const maxWidth = pageWidth - margin * 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(meta.h1 || title, margin, margin);
      doc.setFontSize(11);
      function drawLabelValue(label, value, y){
        const labelText = String(label || '') + ' ';
        const lblW = doc.getTextWidth(labelText);
        doc.setFont('helvetica', 'bold');
        doc.text(labelText.trim(), margin, y);
        doc.setFont('helvetica', 'normal');
        const wrap = doc.splitTextToSize(String(value||''), maxWidth - lblW - 4);
        let yy = y;
        wrap.forEach((line, idx) => {
          if (yy > usableBottom()) { doc.addPage(); yy = margin; }
          doc.text(line, margin + lblW + 4, yy);
          yy += 14;
        });
        return yy;
      }
      let yy = margin + 16;
      if (meta.srcText) yy = drawLabelValue('Source:', meta.srcText, yy);
      if (meta.dateText) yy = drawLabelValue('Date:', meta.dateText, yy);
      doc.setDrawColor(180);
      doc.line(margin, yy + 4, pageWidth - margin, yy + 4);
      doc.setFontSize(12);
      let y = yy + 24;
      const lineHeight = 16;
      if (points && points.length) {
        for (const pt of points) {
          doc.setFont('helvetica', 'bold');
          const headLines = doc.splitTextToSize(pt.head, maxWidth);
          for (const line of headLines) {
            if (y > usableBottom()) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += lineHeight;
          }
          y += 8;
          doc.setFont('helvetica', 'normal');
          for (const para of pt.paras) {
            const plines = doc.splitTextToSize(para, maxWidth);
            for (const line of plines) {
              if (y > usableBottom()) { doc.addPage(); y = margin; }
              doc.text(line, margin, y);
              y += lineHeight;
            }
            y += 8;
          }
          y += 16;
        }
      } else {
        const lines = doc.splitTextToSize(text || '(No content)', maxWidth);
        for (const line of lines) {
          if (y > usableBottom()) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += lineHeight;
        }
      }
      doc.setDrawColor(180);
      const sepY = Math.min(y + 8, usableBottom() - 8);
      if (sepY > margin) doc.line(margin, sepY, pageWidth - margin, sepY);
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(10);
      for (let i=1;i<=pageCount;i++){
        doc.setPage(i);
        const footerY = pageHeight - margin + 10;
        doc.setFont('helvetica', 'normal');
        doc.text('DistyVault · 2025', margin, footerY);
        const pageText = `${i}/${pageCount}`;
        const textWidth = doc.getTextWidth(pageText);
        doc.text(pageText, pageWidth - margin - textWidth, footerY);
      }
      return doc.output('blob');
    }

    /**
     * buildViewerHtml — wrap distilled HTML points into a minimal, theme-aware HTML document.
     *
     * - Extracts just the distilled <section.dv-point> blocks if present; otherwise embeds full body.
     * - Synchronizes dark mode with the parent document via MutationObserver and postMessage.
     * - Avoids external CSS/JS for portability; styles are embedded for consistency.
     */
    function buildViewerHtml(savedHtml=''){
      try {
        let inner = '';
        try {
          const re = /<section\s+class=["']dv-point["'][\s\S]*?<\/section>/gi;
          const matches = savedHtml.match(re);
          if (matches && matches.length) inner = matches.join('\n');
        } catch {}
        if (!inner) {
          const doc = new DOMParser().parseFromString(savedHtml, 'text/html');
          const sections = Array.from(doc.querySelectorAll('section.dv-point'));
          inner = sections.length ? sections.map(n => n.outerHTML).join('\n') : (doc.body?.innerHTML || '');
        }
        
        const parentDoc = window.document.documentElement;
        const isDark = parentDoc.classList.contains('dark');
        const themeClass = isDark ? 'dark' : '';
        
  const html = `<!doctype html><html class="${themeClass}"><head><meta charset="utf-8"/><meta name="color-scheme" content="light dark" /><style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;padding:16px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.6;color:#0f172a;background:#ffffff;font-size:15px;transition:none}
.dark body{color:#f1f5f9;background:#0f172a}
.dv-head{font-weight:600;font-size:1.05rem;margin:0 0 8px 0;color:#1e293b}
.dark .dv-head{color:#e2e8f0}
.dv-body{margin:0}
.dv-body p{margin:8px 0 12px 0;color:#334155}
.dark .dv-body p{color:#cbd5e1}
section.dv-point{margin:0 0 20px 0;padding:0}
h1,h2,h3,h4,h5,h6{margin:0 0 12px 0;font-weight:600;color:#1e293b}
.dark h1,.dark h2,.dark h3,.dark h4,.dark h5,.dark h6{color:#e2e8f0}
ul,ol{margin:8px 0 12px 16px;padding:0}
li{margin:4px 0}
a{color:#3b82f6;text-decoration:none}
.dark a{color:#60a5fa}
a:hover{text-decoration:underline}
</style></head><body>${inner}</body>
<script>
(function(){
  try {
    var d=document.documentElement;
    var pd=parent&&parent.document&&parent.documentElement;
    
    function syncTheme(){
      if(pd&&pd.classList.contains('dark')){
        d.classList.add('dark');
      }else{
        d.classList.remove('dark');
      }
    }
    
    syncTheme();
    
    try {
      if(pd&&pd.classList){
        var mo=new MutationObserver(syncTheme);
        mo.observe(pd,{attributes:true,attributeFilter:['class']});
      }
    } catch (e) {}
    
    window.addEventListener('storage',function(e){
      if(e && (e.key==='dv.theme'||e.key==='theme'||e.key==='darkMode')){
        setTimeout(syncTheme,0);
      }
    });
    
    window.addEventListener('message', function(e){
      try {
        var data = e && e.data;
        if (data && data.type === 'dv-theme'){
          if (data.isDark) d.classList.add('dark'); else d.classList.remove('dark');
        }
      } catch {}
    });
    
  }catch(e){}
})();
</script>
</html>`;
        return html;
      } catch { return savedHtml; }
    }
    try { if (window && window.DV) window.DV.buildViewerHtml = buildViewerHtml; } catch {}

    /**
     * Download all completed items:
     * - Single item: generate and download one PDF
     * - Many items: generate PDFs and ZIP them into one archive
     */
    async function downloadAllCompleted(){
  const completed = items.filter(i=> i.status===STATUS.COMPLETED);
      if (!completed.length) return;
      if (completed.length === 1) {
        const it = completed[0];
        const content = await DV.db.get('contents', it.id);
        if (content?.html) {
          const pdf = await makePdfBlobFromHtml(content.html, it.title || 'Document');
          await saveBlob(pdf, pdfFileName(it.title));
        }
        return;
      }
      const zip = new JSZip();
      for (const it of completed) {
        await yieldToBrowser();
        const content = await DV.db.get('contents', it.id);
        if (content?.html) {
          const pdf = await makePdfBlobFromHtml(content.html, it.title || 'Document');
          zip.file(pdfFileName(it.title), pdf);
        }
      }
      const blob = await zip.generateAsync({ type:'blob' });
      await saveBlob(blob, 'distyvault-bulk.zip');
    }

    /** Sanitize filename to a safe subset. */
    function sanitize(s='') { return s.replace(/[^a-z0-9 _-]+/ig,'_').slice(0,80) || 'file'; }
    /** Strip common document/image extensions from a name-like string. */
    function stripExtLike(s=''){
      let out = String(s||'').trim();
      out = out.replace(/\.(pdf|docx|doc|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '');
      out = out.replace(/_(pdf|docx|doc|txt|md|rtf|html?|png|jpe?g|webp|gif|tiff?)$/i, '');
      return out.trim();
    }
    function pdfFileName(title){ return `${sanitize(stripExtLike(title || 'Document'))}.pdf`; }

    /** Request all in-progress items to stop and reload queue. */
    async function stopAll(){
      items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).forEach(i => DV.queue.requestStop(i.id));
      DV.queue.loadQueue();
      DV.toast('Stop requested for all in progress');
    }

    /** Find failed/stopped items, reset their state, and requeue. */
    async function retryFailed(){
      const failed = items.filter(i=> i.status===STATUS.ERROR || i.status===STATUS.STOPPED);
      for (const it of failed) await DV.queue.updateItem(it.id, { status: STATUS.PENDING, error: null, durationMs: 0, startedAt: null });
      DV.queue.loadQueue();
      DV.toast('Retry queued');
    }

    /**
     * Apply current filter/search/sort to items and return a derived array.
     */
    function filteredSorted(){
      const q = search.toLowerCase();
      let arr = items.filter(i=> {
        if (filter === 'all') return true;
        if (filter === 'youtube') return i.kind === 'youtube' || isYouTubePlaylist(i);
        return i.kind === filter;
      }).filter(i=>
        !q || (i.title?.toLowerCase().includes(q) || i.url?.toLowerCase().includes(q) || i.fileName?.toLowerCase().includes(q))
      );
      if (sort === 'title') arr.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
      else if (sort === 'status') arr.sort((a,b)=> (a.status||'').localeCompare(b.status||''));
      else if (sort === 'duration') arr.sort((a,b)=> (a.durationMs||0)-(b.durationMs||0));
      else if (sort === 'created') arr.sort((a,b)=> (a.createdAt||0)-(b.createdAt||0));
      else if (sort === 'queue') arr.sort((a,b)=> (a.queueIndex||0)-(b.queueIndex||0));
      return arr;
    }

    /** Export entire database (items, contents, settings) as a portable ZIP. */
    async function exportAll(){
      await yieldToBrowser();
      const blob = await DV.db.exportAllToZip();
      await saveBlob(blob, 'distyvault-export.zip');
    }

    /** Import a previously exported ZIP, then reload the queue. */
    async function importZip(file){
      await DV.db.importFromZip(file);
      DV.queue.loadQueue();
      DV.toast('Imported');
    }

    /** Open the content viewer for the single selected item. */
    async function viewSelected(){
      if (selected.length !== 1) return;
      const id = selected[0];
      const item = items.find(i=> i.id===id);
      setViewItem(item || null);
    }

    /** Reset selected items to PENDING to retry processing and unselect them. */
    async function retrySelected(){
      for (const id of selected) await DV.queue.updateItem(id, { status: STATUS.PENDING, error: null, durationMs: 0, startedAt: null });
      DV.queue.loadQueue();
      setSelected([]);
    }

    /** Download selected items as one or many PDFs (ZIP for many). */
    async function downloadSelected(){
      if (selected.length === 1) {
        const id = selected[0];
        const item = items.find(i=> i.id===id);
        const content = await DV.db.get('contents', id);
        if (content?.html) {
          const pdf = await makePdfBlobFromHtml(content.html, item?.title || 'Document');
          await saveBlob(pdf, pdfFileName(item?.title||id));
        }
        return;
      }
      const zip = new JSZip();
      for (const id of selected) {
        await yieldToBrowser();
        const item = items.find(i=> i.id===id);
        const content = await DV.db.get('contents', id);
        if (content?.html) {
          const pdf = await makePdfBlobFromHtml(content.html, item?.title || 'Document');
          zip.file(pdfFileName(item?.title||id), pdf);
        }
      }
      const blob = await zip.generateAsync({ type:'blob' });
      await saveBlob(blob, `distyvault-bulk-download.zip`);
    }

    /** Delete selected items from both items and contents stores. */
    async function deleteSelected(){
      for (const id of selected) { await DV.db.del('items', id); await DV.db.del('contents', id); }
      setSelected([]);
      try { if (DV.queue && DV.queue.syncLocalSummary) await DV.queue.syncLocalSummary(); } catch {}
      DV.queue.loadQueue();
    }

    useEffect(()=>{
      function onKey(e){ if (e.key === 'Escape') setSelected([]); }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    /** Update sort mode; when switching to queue-order, reload to re-compute indices. */
    const handleSort = (k) => {
      setSort(k);
      if (k === 'queue') DV.queue.loadQueue();
    };

  const allItemsSorted = filteredSorted();
  const [expandedIds, setExpandedIds] = React.useState(new Set());
    const byParent = React.useMemo(() => {
      const map = new Map();
      for (const it of allItemsSorted) {
        if (it.parentId) {
          if (!map.has(it.parentId)) map.set(it.parentId, []);
          map.get(it.parentId).push(it);
        }
      }
      return map;
    }, [allItemsSorted]);
    const visibleItems = React.useMemo(() => {
      const out = [];
      const seen = new Set();
      for (const it of allItemsSorted) {
        if (seen.has(it.id)) continue;
        if (!it.parentId) {
          out.push(it);
          seen.add(it.id);
          if (it.kind === 'playlist' && expandedIds.has(it.id)) {
            const children = byParent.get(it.id) || [];
            for (const ch of children) { out.push(ch); seen.add(ch.id); }
          }
        }
      }
      return out;
    }, [allItemsSorted, expandedIds, byParent]);
    const anyActive = selected.some(id => {
      const it = items.find(x=> x.id===id);
      return it && [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(it.status);
    });
    const allSelected = visibleItems.length>0 && visibleItems.every(i=> selected.includes(i.id));

    return (
      <div className="min-h-full">
        <TopBar theme={theme} setTheme={setTheme} openSettings={()=> setSettingsOpen(true)} />
        <div className="max-w-6xl mx-auto px-4">
          <CapturePanel onSubmit={handleSubmit} onFilesSelected={()=>{}} />
          <StatsRow items={items} onDownloadAll={downloadAllCompleted} onStopAll={stopAll} onRetryFailed={retryFailed} />
          <CommandBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} onExport={exportAll} onImport={importZip} sort={sort} setSort={setSort} />
          <Table items={visibleItems} allItems={allItemsSorted} selected={selected} setSelected={setSelected} onSort={handleSort} expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
          <SelectionDock
            count={selected.length}
            anyActive={anyActive}
            allSelected={allSelected}
            onView={viewSelected}
            onRetry={retrySelected}
            onStop={()=> {
              selected.forEach(id => {
                const item = items.find(i => i.id === id);
                if (item && [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(item.status)) {
                  DV.queue.requestStop(id);
                }
              });
              DV.queue.loadQueue();
            }}
            onDownload={downloadSelected}
            onDelete={deleteSelected}
            onSelectAll={()=> setSelected(visibleItems.map(i=>i.id))}
            onUnselectAll={()=> setSelected([])}
          />
        </div>

        <ContentModal item={viewItem} onClose={()=> setViewItem(null)} />
        <ErrorModal item={errorItem} onClose={()=> setErrorItem(null)} />
        <SettingsDrawer open={settingsOpen} onClose={()=> setSettingsOpen(false)} settings={settings} setSettings={applySettings} />

  <footer className="mt-10 py-2 text-center text-xs text-slate-600 dark:text-slate-300">DistyVault · {new Date().getFullYear()}</footer>
      </div>
    );
  }

  /**
   * ContentModal — sandboxed viewer for distilled HTML.
   *
   * The content is embedded via srcDoc to avoid cross-origin issues and to keep the viewer static.
   * On load, theme is synchronized with the parent through postMessage.
   */
  function ContentModal({ item, onClose }){
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const iframeRef = useRef(null);
    
    useEffect(()=>{
      if (!item) { 
        setHtml(''); 
        return; 
      }
      
      setLoading(true);
      
      DV.db.get('contents', item.id).then(content => {
        if (content?.html) {
          try {
            const viewer = (window.DV && typeof DV.buildViewerHtml === 'function') ? DV.buildViewerHtml(content.html) : content.html;
            setHtml(viewer);
          } catch {
            setHtml(content.html || '');
          }
        } else {
          setHtml('');
        }
        setLoading(false);
      }).catch(() => {
        setHtml('');
        setLoading(false);
      });
    }, [item?.id]);

    useEffect(() => {
      const fr = iframeRef.current;
      if (!fr) return;
      function sendTheme(){
        try {
          const isDark = document.documentElement.classList.contains('dark');
          fr.contentWindow && fr.contentWindow.postMessage({ type: 'dv-theme', isDark }, '*');
        } catch {}
      }
      fr.addEventListener('load', sendTheme, { once: true });
      const t = setTimeout(sendTheme, 50);
      return () => { clearTimeout(t); };
    }, [html]);

    return (
      <Modal open={!!item} onClose={onClose} title={item?.title || 'Content'} hideHeader>
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-slate-600 dark:text-slate-300">
              <div className="text-sm">Loading...</div>
            </div>
          ) : html ? (
            <iframe 
              ref={iframeRef}
              className="w-full h-[65vh] rounded-lg border border-slate-300 dark:border-white/20" 
              srcDoc={html}
            />
          ) : (
            <div className="flex items-center justify-center h-[65vh] text-slate-600 dark:text-slate-300">
              <div className="text-sm">No content available</div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  /** Simple error modal presenting the captured error text for an item. */
  function ErrorModal({ item, onClose }){
    return (
      <Modal open={!!item} onClose={onClose} title={item ? 'Error — ' + (item.title||'') : 'Error'}>
        <div className="text-sm text-rose-700 dark:text-rose-300 whitespace-pre-wrap">{item?.error || 'Unknown error'}</div>
      </Modal>
    );
  }

  // Mount the React root into #root once scripts have loaded.
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
})();