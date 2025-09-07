/*
  DistyVault React One-Pager (Redesigned)
  - Zero-build: React 18 UMD + Babel standalone
  - Tailwind Play CDN for styling
  - Uses existing ApiClient for all functionality
  - Light/Dark/System theme toggle persisted in localStorage
  - Premium, responsive UX with stats, command bar, table/cards views, sticky bulk dock, and a settings drawer
*/

const { useEffect, useMemo, useRef, useState } = React;

// Utilities from existing code (DateUtils is loaded globally)
const formatDuration = (item) => {
  try { return (window.DateUtils && window.DateUtils.calculateProcessingTimeDisplay(item)) || '—'; } catch {};
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

// Simple inline icons (SVG) for a crisp look
const Icon = {
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
};

function TopBar({ onOpenSettings, theme, setTheme }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-white/80 to-white/60 dark:from-zinc-950/80 dark:to-zinc-950/60 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="logos/logo.png" alt="logo" className="h-7 w-7" />
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">DistyVault</div>
          <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400">Capture. Distill. Control.</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle value={theme} onChange={setTheme} />
          <button onClick={onOpenSettings} className="inline-flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"><span className="sr-only">Settings</span>{Icon.settings()}</button>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle({ value, onChange }) {
  const cycle = () => {
    const order = ['light','system','dark'];
    const i = order.indexOf(value);
    const next = order[(i+1)%order.length];
    onChange(next);
  };
  return (
    <button onClick={cycle} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800" title={`Theme: ${value}`} aria-label="Toggle theme">
      {value === 'light' ? Icon.sun() : value === 'dark' ? Icon.moon() : Icon.laptop()}
    </button>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-5">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">Smart Capture</div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-2.5 text-zinc-400">{Icon.link()}</span>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); if (file) setFile(null); }}
                placeholder="Paste a URL… (YouTube, article, blog)"
                className="w-full pl-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex items-stretch gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setUrl(''); } }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-2">{Icon.file()} Choose file</button>
              <button onClick={submit} disabled={!canSubmit || busy} className={(canSubmit && !busy ? 'bg-brand text-white hover:opacity-95' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-not-allowed') + ' rounded-lg px-4 py-2.5 text-sm font-medium'}>
                {busy ? 'Queueing…' : 'Distill'}
              </button>
            </div>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); setUrl(''); } }}
            className={(dragOver ? 'border-brand/50 bg-brand/5' : 'border-dashed') + ' mt-4 rounded-lg border p-4 text-center text-sm text-zinc-500 dark:text-zinc-400'}
          >
            Drag & drop a document here to distill
          </div>
          {(file) && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm">
              <div className="truncate text-zinc-700 dark:text-zinc-200">📄 {file.name}</div>
              <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">Remove</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatBadge label="Total" value={<ValueAnim v={undefined} />} tone="zinc" />
          <StatBadge label="In Progress" value={<ValueAnim v={undefined} />} tone="blue" />
          <StatBadge label="Errors" value={<ValueAnim v={undefined} />} tone="red" />
        </div>
      </div>
    </section>
  );
}

function ValueAnim({ v }) { return <span>{v ?? '—'}</span>; }

function CommandBar({ counts, actions, query, setQuery, type, setType, view, setView }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-3 md:p-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search knowledge base…" className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm" />
            </div>
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-white dark:bg-zinc-950">
              {['all','url','youtube','file'].map(opt => (
                <button key={opt} onClick={() => setType(opt)} className={(type===opt ? 'bg-zinc-100 dark:bg-zinc-800 ' : '') + 'px-3 py-1.5 rounded text-sm capitalize'}>{opt}</button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-white dark:bg-zinc-950">
              {['table','cards'].map(opt => (
                <button key={opt} onClick={() => setView(opt)} className={(view===opt ? 'bg-zinc-100 dark:bg-zinc-800 ' : '') + 'px-3 py-1.5 rounded text-sm capitalize'}>{opt}</button>
              ))}
            </div>
            <div className="relative">
              <details className="group">
                <summary className="list-none cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm inline-flex items-center gap-2 select-none">Actions ▾</summary>
                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-1 text-sm">
                  <button onClick={actions.refresh} className="w-full text-left px-3 py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-2">{Icon.refresh()} Refresh</button>
                  <button onClick={actions.export} className="w-full text-left px-3 py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-2">{Icon.download()} Export</button>
                  <label className="w-full text-left px-3 py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-2 cursor-pointer">
                    <span>Import</span>
                    <input type="file" accept=".zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) actions.import(f); e.target.value = ''; }} />
                  </label>
                </div>
              </details>
            </div>
          </div>
          <div className="hidden" />
        </div>
        {/* Selection hint moved to sticky dock when needed */}
      </div>
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

function SelectionDock({ count, total, onClear, onRetry, onDownload, onDelete, onSelectAll }) {
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
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800" title="Retry selected">
                {Icon.refresh()} <span className="hidden sm:inline">Retry</span>
              </button>
              <button onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800" title="Download PDFs">
                {Icon.download()} <span className="hidden sm:inline">Download</span>
              </button>
              <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 px-3 py-1.5 text-sm hover:bg-red-50/60 dark:hover:bg-red-900/20" title="Delete selected">
                {Icon.delete()} <span className="hidden sm:inline">Delete</span>
              </button>
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 hidden md:block" />
              <button onClick={onClear} className="rounded-md px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white" title="Clear selection">Deselect</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KBTable({ items, selected, toggle, open, download, del, stop, retry }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60">
            <tr>
              <th className="w-10" />
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map(it => (
              <tr key={it.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <td className="px-2">
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[26rem]">{it.title || 'Untitled'}</div>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 truncate max-w-[22rem]">{it.sourceUrl || (it.sourceFile?.name || '—')}</td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{it.sourceType || '—'}</td>
                <td className="px-4 py-3 text-sm">
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
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatDuration(it)}</td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{new Date(it.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm flex items-center gap-2 justify-end">
                  <button onClick={() => open('content', it)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1">View</button>
                  <button onClick={() => open('logs', it)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1">Logs</button>
                  <button onClick={() => download(it.id)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1">PDF</button>
                  {(it.status === 'extracting' || it.status === 'distilling') && (
                    <button onClick={() => stop(it.id)} className="rounded border border-red-300 text-red-600 dark:border-red-700 px-2 py-1">Stop</button>
                  )}
                  {(it.status === 'error' || it.status === 'stopped') && (
                    <button onClick={() => retry(it.id)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1">Retry</button>
                  )}
                  <button onClick={() => del(it.id)} className="rounded border border-red-300 text-red-600 dark:border-red-700 px-2 py-1">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KBCardList({ items, selected, toggle, open, download, del, stop, retry }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4 grid grid-cols-1 md:hidden gap-3">
      {items.map(it => (
        <div key={it.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <input type="checkbox" className="mt-1" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
              <div className="min-w-0">
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{it.title || 'Untitled'}</div>
                <div className="text-xs text-zinc-500 truncate">{it.sourceUrl || (it.sourceFile?.name || '—')}</div>
              </div>
            </div>
            <span className={
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ' +
              (it.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
               it.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
               it.status === 'distilling' || it.status === 'extracting' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
               it.status === 'pending' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300')
            }>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" /> {it.status}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 text-xs text-zinc-600 dark:text-zinc-300">
            <div>Duration: {formatDuration(it)}</div>
            <div className="text-right">{new Date(it.createdAt).toLocaleString()}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => open('content', it)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm">View</button>
            <button onClick={() => open('logs', it)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm">Logs</button>
            <button onClick={() => download(it.id)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm">PDF</button>
            {(it.status === 'extracting' || it.status === 'distilling') && (
              <button onClick={() => stop(it.id)} className="rounded border border-red-300 text-red-600 dark:border-red-700 px-2 py-1 text-sm">Stop</button>
            )}
            {(it.status === 'error' || it.status === 'stopped') && (
              <button onClick={() => retry(it.id)} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm">Retry</button>
            )}
            <button onClick={() => del(it.id)} className="rounded border border-red-300 text-red-600 dark:border-red-700 px-2 py-1 text-sm ml-auto">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={(wide ? 'max-w-4xl' : 'max-w-2xl') + ' relative w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl'}>
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
  const sideClass = side === 'right' ? 'right-0 translate-x-0' : 'left-0 -translate-x-0';
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute top-0 ${side==='right'?'right-0':'left-0'} h-full w-full sm:w-[520px] ${width} bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col`}>
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

  useEffect(() => {
    if (open) {
      api.getAiSettings().then(setSettings);
    }
  }, [open]);

  const save = async () => {
    setSaving(true);
    try { await api.saveAiSettings(settings); onClose(); } catch (e) { alert(e?.message || 'Failed'); } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title="Settings">
      {!settings ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-2">Processing mode</div>
            <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 p-1">
              {['online','offline'].map(m => (
                <button key={m} onClick={() => setSettings({ ...settings, mode: m })} className={(settings.mode === m ? 'bg-zinc-100 dark:bg-zinc-800 ' : '') + 'px-3 py-1.5 rounded text-sm'}>{m}</button>
              ))}
            </div>
            <div className="mt-2 text-xs text-zinc-500">Use cloud AI for best quality; offline requires local Ollama.</div>
          </div>

          {settings.mode === 'offline' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Ollama model</label>
                <input value={settings.offline?.model || ''} onChange={e => setSettings({ ...settings, offline: { ...settings.offline, model: e.target.value } })} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="llama3" />
              </div>
              <div>
                <label className="text-sm">Ollama endpoint</label>
                <input value={settings.offline?.endpoint || ''} onChange={e => setSettings({ ...settings, offline: { ...settings.offline, endpoint: e.target.value } })} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="http://localhost:11434" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Provider</label>
                <select value={settings.online?.provider || ''} onChange={e => setSettings({ ...settings, online: { ...settings.online, provider: e.target.value } })} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Gemini</option>
                  <option value="grok">Grok</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Model</label>
                <input value={settings.online?.model || ''} onChange={e => setSettings({ ...settings, online: { ...settings.online, model: e.target.value } })} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="gpt-4o" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm">API key</label>
                <input type="password" value={settings.online?.apiKey || ''} onChange={e => setSettings({ ...settings, online: { ...settings.online, apiKey: e.target.value } })} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" placeholder="sk-…" />
                <div className="mt-1 text-xs text-zinc-500">Keys are stored locally in this browser.</div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm">Simultaneous processing</label>
            <div className="mt-1 inline-flex items-center gap-2">
              <input type="number" min={1} max={10} value={settings.concurrentProcessing || 1} onChange={e => setSettings({ ...settings, concurrentProcessing: Math.min(10, Math.max(1, parseInt(e.target.value || '1', 10))) })} className="w-24 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
              <span className="text-xs text-zinc-500">Max 10</span>
            </div>
          </div>

      <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className={(saving ? 'opacity-60' : 'bg-brand text-white') + ' rounded-md px-4 py-2 text-sm font-medium'}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
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
            {item.content || 'No content available'}
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
  const [view, setView] = useState('table');
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState('');
  const [contentItem, setContentItem] = useState(null);
  const [logsItem, setLogsItem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load and poll
  useEffect(() => {
    let mounted = true;
    const load = async () => { const data = await api.getSummaries(); if (mounted) { setItems(sortItems(data)); setInitialLoaded(true); } };
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
  const inProgress = items.filter(it => ['pending','extracting','distilling'].includes(String(it.status||'').toLowerCase())).length;
  const errors = items.filter(it => String(it.status||'').toLowerCase()==='error').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <TopBar onOpenSettings={() => setShowSettings(true)} theme={theme} setTheme={setTheme} />
      <CapturePanel api={api} onQueued={() => refresh()} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
        <div className="grid grid-cols-3 gap-3">
          <StatBadge label="Total" value={total} tone="zinc" />
          <StatBadge label="In Progress" value={inProgress} tone="blue" />
          <StatBadge label="Errors" value={errors} tone="red" />
        </div>
      </div>

      <CommandBar
        counts={{ selected: selected.size }}
        actions={{ selectAll, retry: bulkRetry, retryAll: bulkRetryAll, retryFailed: bulkRetryFailed, bulkDelete, bulkDownload, refresh, export: exportKB, import: importKB }}
        query={query} setQuery={setQuery} type={type} setType={setType}
        view={view} setView={setView}
      />

      {/* Desktop table */}
      {view === 'table' && (
        <KBTable
          items={filtered}
          selected={selected}
          toggle={toggle}
          open={openItem}
          download={download}
          del={del}
          stop={stop}
          retry={retry}
        />
      )}
      {/* Mobile card list */}
      {view === 'cards' && (
        <KBCardList
          items={filtered}
          selected={selected}
          toggle={toggle}
          open={openItem}
          download={download}
          del={del}
          stop={stop}
          retry={retry}
        />
      )}

      <ContentModal open={!!contentItem} onClose={() => setContentItem(null)} item={contentItem} />
      <LogsModal open={!!logsItem} onClose={() => setLogsItem(null)} item={logsItem} />
      <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} api={api} />
      <StatusToast message={toast} />
      <SelectionDock
        count={selected.size}
        total={filtered.length}
        onClear={clearSelection}
        onRetry={bulkRetry}
        onDownload={bulkDownload}
        onDelete={bulkDelete}
        onSelectAll={selectAll}
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
