/*
  DistyVault React One-Pager
  - Zero-build: React 18 UMD + Babel standalone
  - Tailwind Play CDN for styling
  - Uses existing ApiClient for all functionality
  - Light/Dark/System theme toggle persisted in localStorage
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

function TopBar({ onOpenSettings, theme, setTheme }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/60 bg-white/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="logos/logo.png" alt="logo" className="h-7 w-7" />
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">DistyVault</div>
          <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400">Gather • Distill • Control</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle value={theme} onChange={setTheme} />
          <button onClick={onOpenSettings} className="inline-flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 p-1 bg-white dark:bg-zinc-900">
      {['light','system','dark'].map(opt => (
        <button key={opt} onClick={() => onChange(opt)} className={
          'px-2.5 py-1.5 text-sm rounded ' + (value === opt ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300')
        }>{opt}</button>
      ))}
    </div>
  );
}

function InputCard({ api, onQueued }) {
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
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mt-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-soft p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); if (file) setFile(null); }}
            placeholder="Paste a URL… (YouTube, article, docs)"
            className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex items-stretch gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setUrl(''); } }}
            />
            <button onClick={() => fileInputRef.current?.click()} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">Choose file</button>
            <button onClick={submit} disabled={!canSubmit || busy} className={(canSubmit && !busy ? 'bg-brand text-white hover:opacity-95' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-not-allowed') + ' rounded-md px-4 py-2 text-sm font-medium'}>
              {busy ? 'Queueing…' : 'Distill'}
            </button>
          </div>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); setUrl(''); } }}
          className={(dragOver ? 'border-brand/50 bg-brand/5' : 'border-dashed') + ' mt-4 rounded-md border p-4 text-center text-sm text-zinc-500 dark:text-zinc-400'}
        >
          Drop a document here to distill
        </div>
        {(file) && (
          <div className="mt-3 flex items-center justify-between rounded-md bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm">
            <div className="truncate text-zinc-700 dark:text-zinc-200">📄 {file.name}</div>
            <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">Remove</button>
          </div>
        )}
      </div>
    </section>
  );
}

function Toolbar({ counts, actions, query, setQuery, type, setType }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={actions.selectAll} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">Select all</button>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{counts.selected} selected</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={actions.retry} disabled={!counts.selected} className={(counts.selected ? '' : 'opacity-50 cursor-not-allowed ') + 'rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm'}>Retry</button>
          <button onClick={actions.retryAll} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Retry all</button>
          <button onClick={actions.retryFailed} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Retry failed</button>
          <button onClick={actions.bulkDownload} disabled={!counts.selected} className={(counts.selected ? '' : 'opacity-50 cursor-not-allowed ') + 'rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm'}>Download</button>
          <button onClick={actions.bulkDelete} disabled={!counts.selected} className={(counts.selected ? 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-700' : 'opacity-50 cursor-not-allowed ') + ' rounded-md border px-3 py-2 text-sm'}>Delete</button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search knowledge base…" className="w-full sm:w-auto flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
            <option value="all">All types</option>
            <option value="url">Web Page</option>
            <option value="youtube">YouTube</option>
            <option value="file">Document</option>
          </select>
          <button onClick={actions.refresh} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Refresh</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={actions.export} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Export</button>
          <label className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm cursor-pointer">
            Import
            <input type="file" accept=".zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) actions.import(f); e.target.value = ''; }} />
          </label>
        </div>
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
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs ' +
                    (it.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                     it.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                     it.status === 'distilling' || it.status === 'extracting' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                     it.status === 'pending' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300')
                  }>
                    {it.status}
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
    <Modal open={open} onClose={onClose} title="Settings" wide>
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
    </Modal>
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
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState('');
  const [contentItem, setContentItem] = useState(null);
  const [logsItem, setLogsItem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load and poll
  useEffect(() => {
    let mounted = true;
    const load = async () => { const data = await api.getSummaries(); if (mounted) setItems(sortItems(data)); };
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <TopBar onOpenSettings={() => setShowSettings(true)} theme={theme} setTheme={setTheme} />
      <InputCard api={api} onQueued={() => refresh()} />
      <Toolbar
        counts={{ selected: selected.size }}
        actions={{ selectAll, retry: bulkRetry, retryAll: bulkRetryAll, retryFailed: bulkRetryFailed, bulkDelete, bulkDownload, refresh, export: exportKB, import: importKB }}
        query={query} setQuery={setQuery} type={type} setType={setType}
      />
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
      <ContentModal open={!!contentItem} onClose={() => setContentItem(null)} item={contentItem} />
      <LogsModal open={!!logsItem} onClose={() => setLogsItem(null)} item={logsItem} />
      <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} api={api} />
      <StatusToast message={toast} />
    </div>
  );
}

// Mount
function Root() {
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
