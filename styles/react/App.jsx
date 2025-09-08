/*
  DistyVault React One-Pager (Updated)
  - Zero-build: React 18 UMD + Babel standalone
  - Tailwind Play CDN for styling
  - Uses existing ApiClient for all functionality
*/

const { useEffect, useMemo, useRef, useState } = React;

// Utilities from existing code (DateUtils is loaded globally)
const formatDuration = (item) => {
  try { return (window.DateUtils && window.DateUtils.calculateProcessingTimeDisplay(item)) || '—'; } catch {}
  return '—';
};

const useTheme = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('dv-theme') || 'system');
  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);
    root.classList.toggle('dark', isDark);
    localStorage.setItem('dv-theme', theme);
  }, [theme]);
  return { theme, setTheme };
};

// Simple inline icons (SVG)
const Icon = {
  search: (cls='') => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-5 w-5 "+cls}><circle cx="11" cy="11" r="7" strokeWidth="1.8"/><path strokeWidth="1.8" strokeLinecap="round" d="M20 20l-3.5-3.5"/></svg>
  ),
  settings: (cls='') => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-5 w-5 "+cls}><path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.03-3.5a6.99 6.99 0 0 0-.1-.99l2.06-1.6a.75.75 0 0 0 .18-.96l-1.95-3.38a.75.75 0 0 0-.9-.34l-2.43.98a6.96 6.96 0 0 0-1.7-.99l-.37-2.57A.75.75 0 0 0 12.08 1h-3.9a.75.75 0 0 0-.74.64L6.99 4.2c-.61.24-1.18.56-1.7.94l-2.42-.98a.75.75 0 0 0-.9.35L-.01 8.9c-.17.31-.08.7.19.92l2.06 1.7a6.99 6.99 0 0 0 0 1.93L.18 15.1a.75.75 0 0 0-.19.92l1.96 3.38c.2.35.61.5.98.36l2.42-.97c.52.38 1.09.7 1.7.94l.44 2.56c.07.36.39.63.75.63h3.9c.37 0 .68-.27.74-.63l.44-2.56c.6-.23 1.17-.55 1.7-.93l2.42.97c.37.15.78-.01.97-.36l1.96-3.38a.75.75 0 0 0-.19-.92l-2.05-1.68c.07-.33.1-.66.1-1Z"/></svg>
  ),
  sun: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><circle cx="12" cy="12" r="4" strokeWidth="1.8"/><path strokeWidth="1.8" d="M12 2v2m0 16v2M4.93 4.93 6.34 6.34m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07 6.34 17.66m11.32-11.32 1.41-1.41"/></svg>),
  moon: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>),
  laptop: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><rect x="3" y="4" width="18" height="12" rx="2" strokeWidth="1.8"/><path strokeWidth="1.8" d="M2 20h20"/></svg>),
  download: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M12 3v12m0 0 4-4m-4 4-4-4"/><path strokeWidth="1.8" d="M20 21H4"/></svg>),
  refresh: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M21 12a9 9 0 1 1-9-9"/><path strokeWidth="1.8" d="M21 3v6h-6"/></svg>),
  delete: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m1 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 4v8m6-8v8"/></svg>),
  file: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path strokeWidth="1.8" d="M14 2v6h6"/></svg>),
  link: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83A5 5 0 1 0 12 4.34"/><path strokeWidth="1.8" d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83A5 5 0 1 0 12 19.66"/></svg>),
  dots: (cls='') => (<svg viewBox="0 0 24 24" fill="currentColor" className={"h-5 w-5 "+cls}><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>),
  upload: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M12 21V9"/><path strokeWidth="1.8" d="m7 14 5-5 5 5"/><path strokeWidth="1.8" d="M4 21h16"/></svg>),
  eye: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" strokeWidth="1.8"/></svg>),
  logs: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><rect x="3" y="4" width="18" height="16" rx="2" strokeWidth="1.8"/><path strokeWidth="1.8" d="M7 8h10M7 12h10M7 16h6"/></svg>),
  pdf: (cls='') => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={"h-4 w-4 "+cls}><path strokeWidth="1.8" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path strokeWidth="1.8" d="M14 2v6h6"/><path strokeWidth="1.8" d="M8.5 14H10a1.5 1.5 0 0 0 0-3H8.5v3Zm5 0h-2v-3h2a1.5 1.5 0 1 1 0 3Zm1.5-3H17a1 1 0 0 1 0 2h-2v-2Z"/></svg>),
};

function ThemeSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e)=>onChange(e.target.value)} aria-label="Select theme"
      className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-sm text-zinc-800 dark:text-zinc-100">
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}

// Icon-only theme menu
function ThemeMenu({ value, onChange }) {
  const icon = value === 'light' ? Icon.sun() : value === 'dark' ? Icon.moon() : Icon.laptop();
  const Item = ({ v, label, icon }) => (
    <button onClick={() => onChange(v)} className={(value===v? 'bg-zinc-100 dark:bg-zinc-800 ' : '') + 'w-full text-left px-3 py-2 rounded inline-flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800'}>
      {icon} <span>{label}</span>
    </button>
  );
  return (
    <details className="relative">
      <summary className="list-none inline-flex items-center justify-center w-10 h-10 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer select-none" title="Theme" aria-label="Theme">
        {icon}
      </summary>
      <div className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-1 text-sm z-10">
        <Item v="system" label="System" icon={Icon.laptop()} />
        <Item v="light" label="Light" icon={Icon.sun()} />
        <Item v="dark" label="Dark" icon={Icon.moon()} />
      </div>
    </details>
  );
}

function TopBar({ onOpenSettings, theme, setTheme }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-white/80 to-white/60 dark:from-zinc-950/80 dark:to-zinc-950/60 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="logos/logo.png" alt="logo" className="h-7 w-7" />
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">DistyVault</div>
          <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400">Gather, distill and control your knowledge</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeMenu value={theme} onChange={setTheme} />
          <button onClick={onOpenSettings} className="inline-flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 w-10 h-10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition" title="Settings" aria-label="Settings">{Icon.settings()}</button>
        </div>
      </div>
    </header>
  );
}

function StatBadge({ label, value, tone='zinc' }) {
  const toneMap = {
    zinc: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200/60 dark:border-blue-800',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200/60 dark:border-green-800',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200/60 dark:border-red-800',
  };
  return (
    <div className={"rounded-xl border px-4 py-3 shadow-soft "+toneMap[tone]}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function CapturePanel({ api, onQueued }) {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();
  const [busy, setBusy] = useState(false);

  const canSubmit = (url && url.trim().length > 0) || !!file;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      if (file) {
        await api.processFile(file);
      } else if (url) {
        await api.processUrl(url.trim());
      }
      setUrl('');
      setFile(null);
      onQueued?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Failed to start');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
      <div className="grid grid-cols-1 gap-4">
        <div
          className={(dragOver ? 'border-brand/50 bg-brand/5 ring-2 ring-brand/30 ' : '') + 'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-5 transition'}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); setUrl(''); } }}
        >
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-[2] min-w-0">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{Icon.link()}</span>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); if (file) setFile(null); }}
                placeholder="Paste any URL"
                className="w-full pl-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setUrl(''); } }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-2" aria-label="Choose or drop file">{Icon.file()} Choose or drop file</button>
              <button onClick={submit} disabled={!canSubmit || busy} className={(canSubmit && !busy ? 'bg-brand text-white hover:opacity-95' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-not-allowed') + ' w-full rounded-lg px-6 md:px-7 py-2.5 text-sm font-medium'}>
                {busy ? 'Queueing…' : 'Distill'}
              </button>
            </div>
          </div>
          {(file) && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm">
              <div className="truncate text-zinc-700 dark:text-zinc-200">📄 {file.name}</div>
              <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">Remove</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Collapsible search control: icon that expands to input and collapses when empty
function SearchToggle({ value, onChange, placeholder="Search knowledge base…" }) {
  const [open, setOpen] = useState(() => (value && value.length > 0));
  const ref = useRef(null);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  useEffect(() => { if (!value || value.length === 0) setOpen(false); }, [value]);
  return (
    <div className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Search"
          aria-label="Search"
        >
          {Icon.search()}
        </button>
      ) : (
        <div className="relative w-64 sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{Icon.search()}</span>
          <input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => { if (!value) setOpen(false); }}
            placeholder={placeholder}
            className="w-full pl-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm"
          />
        </div>
      )}
    </div>
  );
}

function StatusToast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-md bg-zinc-900/90 text-white px-4 py-2 text-sm shadow-lg">
      {message}
    </div>
  );
}

function SelectionDock({ count, total, onRetry, onDownload, onDelete, onSelectAll, onViewSingle, onClear }) {
  if (!count) return null;
  const allSelected = count === total && total > 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:bottom-4">
      <div className="mx-auto max-w-3xl px-3 md:px-0">
        <div className="pointer-events-auto w-full md:w-auto rounded-t-2xl md:rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-900/85 backdrop-blur shadow-soft">
          <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2">
            <div className="text-sm text-zinc-700 dark:text-zinc-200">
              <span className="font-medium">{count}</span> selected
              {!allSelected && total > 0 && (
                <button onClick={onSelectAll} className="ml-2 underline text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">Select all</button>
              )}
              {allSelected && (
                <button onClick={onClear} className="ml-2 underline text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">Unselect all</button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {count === 1 && (
                <button onClick={onViewSingle} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition" title="View">
                  {Icon.eye()} <span className="hidden sm:inline">View</span>
                </button>
              )}
              <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition" title="Retry selected">
                {Icon.refresh()} <span className="hidden sm:inline">Retry</span>
              </button>
              <button onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition" title="Download PDFs">
                {Icon.download()} <span className="hidden sm:inline">Download</span>
              </button>
              <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-full border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 px-3 py-1.5 text-sm hover:bg-red-50/60 dark:hover:bg-red-900/20 active:scale-[0.98] transition" title="Delete selected">
                {Icon.delete()} <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KBTable({ items, selected, toggle, sort, onChangeSort, onToggleAll, allChecked }) {
  const [colWidths, setColWidths] = React.useState(() => {
    const def = {
      name: 480,
      status: 140,
      duration: 120,
    };
    try { const saved = JSON.parse(localStorage.getItem('dv-colwidths')||'null'); return saved ? { ...def, ...saved } : def; } catch { return def; }
  });

  const startXRef = React.useRef(0);
  const startWRef = React.useRef(0);
  const colKeyRef = React.useRef('');
  const dragHandlerRef = React.useRef(null);

  const onDragStart = (e, key) => {
    startXRef.current = e.clientX;
    startWRef.current = colWidths[key];
    colKeyRef.current = key;
    const handler = (evt) => {
      const dx = evt.clientX - startXRef.current;
      const k = colKeyRef.current;
      if (!k) return;
      setColWidths(prev => {
        const next = { ...prev, [k]: Math.max(80, Math.min(700, startWRef.current + dx)) };
        try { localStorage.setItem('dv-colwidths', JSON.stringify(next)); } catch {}
        return next;
      });
    };
    dragHandlerRef.current = handler;
    document.addEventListener('mousemove', handler);
    document.addEventListener('mouseup', onDragEnd, { once: true });
    e.preventDefault();
  };
  const onDragEnd = () => {
    if (dragHandlerRef.current) {
      document.removeEventListener('mousemove', dragHandlerRef.current);
      dragHandlerRef.current = null;
    }
    colKeyRef.current = '';
  };

  React.useEffect(() => {
    return () => {
      if (dragHandlerRef.current) {
        try { document.removeEventListener('mousemove', dragHandlerRef.current); } catch {}
      }
    };
  }, []);

  const SortIcon = ({ active, dir }) => (
    <span className="inline-block ml-1 text-zinc-400">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
  <div className="overflow-auto max-h-[65vh] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft">
  <table className="min-w-[760px] w-full divide-y divide-zinc-200 dark:divide-zinc-800" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: colWidths.name }} />
            <col style={{ width: colWidths.status }} />
            <col style={{ width: colWidths.duration }} />
          </colgroup>
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 select-none">
            <tr>
              <th className="w-10 px-2 py-3" />
              <th className="px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <button onClick={() => onChangeSort('title')} className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-100">
                  Name <SortIcon active={sort.by==='title'} dir={sort.dir} />
                </button>
                <span className="float-right cursor-col-resize select-none px-1" onMouseDown={(e) => onDragStart(e, 'name')}>⋮</span>
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <button onClick={() => onChangeSort('status')} className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-100">
                  Status <SortIcon active={sort.by==='status'} dir={sort.dir} />
                </button>
                <span className="float-right cursor-col-resize select-none px-1" onMouseDown={(e) => onDragStart(e, 'status')}>⋮</span>
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Duration
                <span className="float-right cursor-col-resize select-none px-1" onMouseDown={(e) => onDragStart(e, 'duration')}>⋮</span>
              </th>
            </tr>
          </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map(it => (
        <tr key={it.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <td className="px-2">
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                </td>
                <td className="px-2 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={it.title || 'Untitled'}>{it.title || 'Untitled'}</div>
                </td>
                <td className="px-2 py-3 text-sm">
                  <span className={
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ' +
                    (it.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                     it.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                     it.status === 'distilling' || it.status === 'extracting' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                     it.status === 'pending' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300')
                  }>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" /> {it.status}
                  </span>
                </td>
                <td className="px-2 py-3 text-sm text-zinc-600 dark:text-zinc-300 truncate">{formatDuration(it)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
  <div className={(wide ? 'max-w-4xl' : 'max-w-2xl') + ' relative w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl animate-inScale'}>
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">✕</button>
        </div>
  <div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, title, children, side='right', width='max-w-xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute top-0 ${side==='right'?'right-0':'left-0'} h-full w-full sm:w-[520px] ${width} bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col animate-slideInRight`}>
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">✕</button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function SettingsSheet({ open, onClose, api }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState('');
  const [connStatus, setConnStatus] = useState(null); // 'ok' | 'fail' | null

  useEffect(() => { if (open) api.getAiSettings().then(setSettings); }, [open]);

  const providerInfoList = useMemo(() => {
    try {
      const list = (window.AIProviderFactory && window.AIProviderFactory.getSupportedProviders && window.AIProviderFactory.getSupportedProviders()) || [];
      // Only cloud providers (online) for this sheet
      return list.filter(p => p.type !== 'ollama');
    } catch { return []; }
  }, []);

  const getModelsFor = (provider) => {
    if (!provider) return [];
    const found = providerInfoList.find(p => p.type === provider);
    if (found && Array.isArray(found.models) && found.models.length) return found.models;
    // Fallbacks
    const fallback = {
      openai: ['o3-mini','o4-mini','gpt-4o','gpt-4.1'],
      anthropic: ['claude-3-7-sonnet-latest','claude-3-5-haiku-latest'],
      google: ['gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite'],
      grok: ['grok-4-0709','grok-3','grok-3-mini','grok-3-fast'],
      deepseek: ['deepseek-chat','deepseek-reasoner'],
    };
    return fallback[provider] || [];
  };

  const save = async () => {
    setSaving(true);
    try { await api.saveAiSettings(settings); setToast('Saved'); setTimeout(()=>setToast(''),1500); onClose(); }
    catch (e) { alert(e?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const resetDefaults = () => ({
    mode: 'online',
    concurrentProcessing: 1,
    offline: { model: '', endpoint: 'http://localhost:11434' },
    online: { provider: '', apiKey: '', model: 'gpt-4o', endpoint: '' },
    lastUpdated: new Date().toISOString()
  });

  const reset = async () => {
    if (!confirm('Reset AI settings to defaults?')) return;
    const next = resetDefaults();
    setSettings(next);
    setSaving(true);
    try { await api.saveAiSettings(next); setToast('Reset'); setTimeout(()=>setToast(''),1500); onClose(); }
    catch (e) { alert(e?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    if (!settings) return;
    setTesting(true);
    try {
      if (settings.mode === 'offline') {
        const ep = (settings.offline?.endpoint || '').replace(/\/$/, '');
        const res = await fetch(ep + '/api/tags', { method: 'GET' });
        if (!res.ok) throw new Error('Ollama not reachable');
  // For offline we don't show inline status near API key; keep silent success
      } else {
        const p = settings.online?.provider;
        const key = settings.online?.apiKey;
        if (!p || !key) throw new Error('Missing provider or API key');
        if (p === 'openai') {
          const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
          if (!r.ok) throw new Error('OpenAI auth failed');
        } else if (p === 'anthropic') {
          const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
          if (!r.ok) throw new Error('Anthropic auth failed');
        } else if (p === 'google') {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          if (!r.ok) throw new Error('Gemini auth failed');
        }
  setConnStatus('ok');
      }
    } catch (e) {
      setConnStatus('fail');
      alert(e?.message || 'Connection test failed');
    } finally { setTesting(false); }
  };

  const adjustConcurrent = (delta) => {
    setSettings(prev => {
      const cur = parseInt(prev.concurrentProcessing || 1, 10);
      const next = Math.max(1, Math.min(10, cur + delta));
      return { ...prev, concurrentProcessing: next };
    });
  };

  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title="AI Settings">
      {!settings ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-2">Mode</div>
            <div className="inline-flex rounded-full border border-zinc-300 dark:border-zinc-700 p-1 bg-white dark:bg-zinc-950">
              {['online','offline'].map(m => (
                <button key={m} onClick={() => setSettings({ ...settings, mode: m })} className={(settings.mode === m ? 'bg-zinc-100 dark:bg-zinc-800 ' : '') + 'px-3 py-1.5 rounded-full text-sm capitalize'}>{m}</button>
              ))}
            </div>
          </div>

          {settings.mode === 'offline' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Ollama model</label>
                  <input value={settings.offline?.model || ''} onChange={e => setSettings({ ...settings, offline: { ...settings.offline, model: e.target.value } })} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="Enter a model name" />
                </div>
                <div>
                  <label className="text-sm">Ollama endpoint</label>
                  <input value={settings.offline?.endpoint || ''} onChange={e => setSettings({ ...settings, offline: { ...settings.offline, endpoint: e.target.value } })} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="http://localhost:11434" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={testConnection} disabled={testing} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{testing ? 'Testing…' : 'Test connection'}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Provider</label>
                  <div className="relative mt-1">
                  <select
                    value={settings.online?.provider || ''}
                    onChange={e => {
                      const p = e.target.value;
                      const models = getModelsFor(p);
                      setSettings(s => ({ ...s, online: { ...s.online, provider: p, model: models[0] || '' } }));
                    }}
                    className="w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Select…</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Gemini</option>
                    <option value="grok">Grok</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400">▾</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm">Model</label>
                  <div className="relative mt-1">
                  <select
                    value={settings.online?.model || ''}
                    onChange={e => setSettings({ ...settings, online: { ...settings.online, model: e.target.value } })}
                    disabled={!settings.online?.provider}
                    className="w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 pr-8 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {(!settings.online?.provider) && <option value="">Select a provider first</option>}
                    {settings.online?.provider && getModelsFor(settings.online.provider).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400">▾</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">API key</label>
                    {connStatus && (
                      <span className={(connStatus==='ok' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300') + ' ml-2 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs'}>
                        <span className={(connStatus==='ok' ? 'bg-green-600' : 'bg-red-600') + ' inline-block h-1.5 w-1.5 rounded-full'}></span>
                        {connStatus==='ok' ? 'Connected' : 'Not connected'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <input type={showKey ? 'text' : 'password'} value={settings.online?.apiKey || ''} onChange={e => setSettings({ ...settings, online: { ...settings.online, apiKey: e.target.value } })} className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="Enter your API key" />
                    <button onClick={() => setShowKey(s => !s)} className="rounded-full border border-zinc-300 dark:border-zinc-700 w-10 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center justify-center" title={showKey? 'Hide key':'Show key'}>{Icon.eye()}</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={testConnection} disabled={testing} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{testing ? 'Testing…' : 'Test connection'}</button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Simultaneous processings</label>
            <div className="mt-1 inline-flex items-center gap-3">
              <button onClick={()=>adjustConcurrent(-1)} className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800" aria-label="Decrease">−</button>
              <div className="min-w-[2.5rem] text-center text-sm text-zinc-800 dark:text-zinc-100">{settings.concurrentProcessing || 1}</div>
              <button onClick={()=>adjustConcurrent(1)} className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800" aria-label="Increase">+</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div />
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Cancel</button>
              <button onClick={reset} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Reset</button>
              <button onClick={save} disabled={saving} className={(saving ? 'opacity-60' : 'bg-brand text-white') + ' rounded-md px-4 py-2 text-sm font-medium'}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
          {toast && <div className="text-sm text-green-600 dark:text-green-400">{toast}</div>}
        </div>
      )}
    </Drawer>
  );
}

function ContentModal({ open, onClose, item }) {
  return (
    <Modal open={!!open} onClose={onClose} title={item ? (item.title || 'Distillation') : ''} wide>
      {!item ? null : (
        <div>
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <div><span className="font-medium">Created:</span> {new Date(item.createdAt).toLocaleString()}</div>
            <div><span className="font-medium">Words:</span> {item.wordCount?.toLocaleString?.() || '—'}</div>
            <div><span className="font-medium">Processing:</span> {formatDuration(item)}</div>
          </div>
          <article className="prose dark:prose-invert max-w-none">
            {item.content
              ? <div dangerouslySetInnerHTML={{ __html: item.content }} />
              : 'No content available'}
          </article>
        </div>
      )}
    </Modal>
  );
}

function LogsModal({ open, onClose, item }) {
  return (
    <Modal open={!!open} onClose={onClose} title={item ? `Processing Logs - ${item.title || 'Distillation'}` : 'Logs'} wide>
      {!item ? null : (
        <div className="space-y-2 text-sm">
          {(item.logs || []).length === 0 ? (
            <div className="text-zinc-500">No logs available</div>
          ) : (
            item.logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-zinc-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={
                  'uppercase text-xs px-1 rounded ' +
                  (log.level === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                  log.level === 'warn' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')
                }>{log.level}</span>
                <span className="text-zinc-700 dark:text-zinc-200">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}

function App() {
  const api = useMemo(() => new window.ApiClient(), []);
  const { theme, setTheme } = useTheme();

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  // sorting: default by queue date (custom) so new/retried items go to the bottom; persisted in localStorage
  const [sort, setSort] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('dv-sort')||'null'); if (s && s.by && s.dir) return s; } catch {}
    return { by: 'queue', dir: 'asc' };
  });
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState('');
  const [contentItem, setContentItem] = useState(null);
  const [logsItem, setLogsItem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load and poll
  useEffect(() => {
    let mounted = true;
    const load = async () => { const data = await api.getSummaries(); if (mounted) { setItems(sortItems(data)); } };
    load();
    const interval = setInterval(async () => {
      try { const data = await api.getSummaries(); if (!mounted) return; setItems(prev => reconcile(prev, data)); } catch {}
    }, 1500);
    return () => { mounted = false; clearInterval(interval); };
  }, [api]);

  // Helpers
  const sortItems = (arr) => arr.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const reconcile = (oldArr, newArr) => sortItems(newArr);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(it => {
      const byType = (type === 'all') || (String(it.sourceType||'').toLowerCase() === type);
      const byQ = !q || (String(it.title||'').toLowerCase().includes(q)) || (String(it.sourceUrl||'').toLowerCase().includes(q)) || (String(it.sourceFile?.name||'').toLowerCase().includes(q));
      return byType && byQ;
    });
  }, [items, query, type]);

  const visibleItems = useMemo(() => {
    const arr = filtered.slice();
    if (sort.by === 'title') {
      arr.sort((a,b) => {
        const an = String(a.title||'').toLowerCase();
        const bn = String(b.title||'').toLowerCase();
        const c = an.localeCompare(bn);
        return sort.dir === 'asc' ? c : -c;
      });
    } else if (sort.by === 'status') {
      arr.sort((a,b) => {
        const as = String(a.status||'').toLowerCase();
        const bs = String(b.status||'').toLowerCase();
        const c = as.localeCompare(bs);
        return sort.dir === 'asc' ? c : -c;
      });
    } else if (sort.by === 'createdAt') {
      arr.sort((a,b) => (sort.dir === 'asc' ? 1 : -1) * (new Date(a.createdAt) - new Date(b.createdAt)));
    } else if (sort.by === 'queue') {
      // Custom queue-aware ordering:
      // 1) Completed and Error first (rank 0 and 1)
      // 2) Active/waiting (pending/extracting/distilling/queued) by lastQueuedAt/createdAt ASC (oldest first)
      const rank = (s) => {
        const t = String(s||'').toLowerCase();
        if (t === 'completed') return 0;
        if (t === 'error') return 1;
        if (['pending','queued','extracting','distilling'].includes(t)) return 2;
        return 3;
      };
      arr.sort((a,b) => {
        const ra = rank(a.status); const rb = rank(b.status);
        if (ra !== rb) return (sort.dir === 'asc' ? 1 : -1) * (ra - rb);
        // Same rank: apply secondary sort
        if (ra <= 1) {
          // Completed/Error: newest first
          const ta = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
          const tb = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
          const c = tb - ta;
          return sort.dir === 'asc' ? c : -c;
        }
        // Active/waiting: oldest queued first
        const qa = new Date(a.lastQueuedAt || a.createdAt || 0).getTime();
        const qb = new Date(b.lastQueuedAt || b.createdAt || 0).getTime();
        const c = qa - qb;
        return sort.dir === 'asc' ? c : -c;
      });
    }
    return arr;
  }, [filtered, sort]);

  useEffect(() => { try { localStorage.setItem('dv-sort', JSON.stringify(sort)); } catch {} }, [sort]);

  const onChangeSort = (by) => {
    if (sort.by !== by) {
      const def = by === 'createdAt' ? 'desc' : 'asc';
      setSort({ by, dir: def });
    } else {
      setSort({ by, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    }
  };

  // Actions
  const toggle = (id) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next); };
  const clearSelection = () => setSelected(new Set());
  const selectAll = () => { setSelected(new Set(filtered.map(x => x.id))); };
  const refresh = async () => { const data = await api.getSummaries(); setItems(sortItems(data)); };
  const exportKB = async () => { await api.exportKnowledgeBase(); flash('Export started'); };
  const importKB = async (file) => { await api.importKnowledgeBase(file, { clearExisting: confirm('Clear existing items first?') }); await refresh(); flash('Import completed'); };
  const bulkDelete = async () => { await api.bulkDelete(Array.from(selected)); setSelected(new Set()); await refresh(); flash('Deleted'); };
  const bulkRetry = async () => { for (const id of selected) { try { await api.retryDistillation(id); } catch {} } flash('Retry queued'); };
  const bulkRetryAll = async () => { for (const it of filtered) { try { await api.retryDistillation(it.id); } catch {} } flash('Retry all queued'); };
  const bulkRetryFailed = async () => { for (const it of filtered) { if ((it.status||'').toLowerCase()==='error') { try { await api.retryDistillation(it.id); } catch {} } } flash('Retry failed queued'); };
  const bulkDownload = async () => { await api.bulkDownload(Array.from(selected)); flash('Downloads started'); };
  const openItem = async (kind, it) => {
    const item = await api.getSummary(it.id);
    if (kind === 'content') setContentItem(item);
    if (kind === 'logs') setLogsItem(item);
  };
  const download = async (id) => { try { await api.downloadPdf(id); } catch (e) { alert(e?.message||'Download failed'); } };
  const del = async (id) => { await api.deleteSummary(id); setSelected(prev => { const n = new Set(prev); n.delete(id); return n; }); await refresh(); };
  const stop = async (id) => { await api.stopProcessing(id); flash('Stopped'); };
  const retry = async (id) => { await api.retryDistillation(id); flash('Retry queued'); };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  // ESC clears selection
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Stats
  const total = items.length;
  const completed = items.filter(it => String(it.status||'').toLowerCase()==='completed').length;
  const inProgress = items.filter(it => ['pending','extracting','distilling'].includes(String(it.status||'').toLowerCase())).length;
  const errors = items.filter(it => String(it.status||'').toLowerCase()==='error').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <TopBar onOpenSettings={() => setShowSettings(true)} theme={theme} setTheme={setTheme} />
      <CapturePanel api={api} onQueued={() => refresh()} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Completed</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{completed}</div>
            </div>
            <button onClick={async ()=>{ const ids = items.filter(it=>String(it.status||'').toLowerCase()==='completed').map(i=>i.id); if (ids.length) { await api.bulkDownload(ids, { zip: true }); setToast('ZIP download started'); setTimeout(()=>setToast(''),2000); } }} className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">Download all</button>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">In Progress</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{inProgress}</div>
            </div>
            <button onClick={async ()=>{ const ids = items.filter(it=>['pending','extracting','distilling'].includes(String(it.status||'').toLowerCase())).map(i=>i.id); for (const id of ids) { try { await api.stopProcessing(id); } catch {} } if (ids.length) { setToast('Stopped all in progress'); setTimeout(()=>setToast(''),2000); } }} className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">Stop all</button>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Errors</div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{errors}</div>
            </div>
            <button onClick={async ()=>{ const ids = items.filter(it=>String(it.status||'').toLowerCase()==='error').map(i=>i.id); for (const id of ids) { try { await api.retryDistillation(id); } catch {} } if (ids.length) { setToast('Retry failed queued'); setTimeout(()=>setToast(''),2000); } }} className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">Retry failed</button>
          </div>
        </div>
      </div>

      {/* Command bar with search toggle (left) and export/import (right) */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-3 md:p-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex-1 flex items-center gap-2">
              <SearchToggle value={query} onChange={setQuery} />
              <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-white dark:bg-zinc-950">
                {[
                  {k:'all', label:'All'},
                  {k:'url', label:'URL'},
                  {k:'youtube', label:'YouTube'},
                  {k:'file', label:'File'},
                ].map(opt => (
                  <button key={opt.k} onClick={() => setType(opt.k)} className={(type===opt.k ? 'bg-zinc-100 dark:bg-zinc-800 ' : '') + 'px-3 py-1.5 rounded text-sm'}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button onClick={async ()=>{ await api.exportKnowledgeBase(); setToast('Export started'); setTimeout(()=>setToast(''),2000); }} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800" title="Export knowledge base">
                {Icon.download()} <span className="hidden sm:inline">Export</span>
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer" title="Import knowledge base">
                {Icon.upload()} <span className="hidden sm:inline">Import</span>
                <input type="file" accept=".zip" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { await api.importKnowledgeBase(f, { clearExisting: confirm('Clear existing items first?') }); const data = await api.getSummaries(); setItems(data); setToast('Import completed'); setTimeout(()=>setToast(''),2000); } e.target.value = ''; }} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Table (resizable, fewer columns) */}
      <KBTable
        items={visibleItems}
        selected={selected}
        toggle={toggle}
        sort={sort}
        onChangeSort={onChangeSort}
        onToggleAll={() => {
          const allIds = new Set(visibleItems.map(x => x.id));
          const allSelected = visibleItems.length > 0 && visibleItems.every(x => selected.has(x.id));
          setSelected(allSelected ? new Set() : allIds);
        }}
        allChecked={visibleItems.length > 0 && visibleItems.every(x => selected.has(x.id))}
      />

      <ContentModal open={!!contentItem} onClose={() => setContentItem(null)} item={contentItem} />
      <LogsModal open={!!logsItem} onClose={() => setLogsItem(null)} item={logsItem} />
      <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} api={api} />
      <StatusToast message={toast} />
      <SelectionDock
        count={selected.size}
        total={visibleItems.length}
        onRetry={async () => { for (const id of selected) { try { await api.retryDistillation(id); } catch {} } setToast('Retry queued'); setTimeout(()=>setToast(''),2000); }}
  onDownload={async () => { await api.bulkDownload(Array.from(selected), { zip: true }); setToast('ZIP download started'); setTimeout(()=>setToast(''),2000); }}
        onDelete={async () => { await api.bulkDelete(Array.from(selected)); setSelected(new Set()); const data = await api.getSummaries(); setItems(data); setToast('Deleted'); setTimeout(()=>setToast(''),2000); }}
        onSelectAll={() => setSelected(new Set(visibleItems.map(x => x.id)))}
        onViewSingle={async () => {
          const id = Array.from(selected)[0];
          if (!id) return;
          const item = await api.getSummary(id);
          setContentItem(item);
        }}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}

// Mount
function Root() {
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
