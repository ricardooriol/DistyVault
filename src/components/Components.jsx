/**
 * DistyVault UI Components
 *
 * Extracted from App.jsx to improve maintainability.
 * All components are attached to window.DV.components and referenced by App.jsx.
 *
 * This file is loaded via <script type="text/babel"> BEFORE App.jsx.
 * No build step; runs through Babel Standalone.
 */
const { useState, useEffect, useMemo, useRef } = React;

// ── Helpers ──────────────────────────────────────────────────
function classNames(...arr) { return arr.filter(Boolean).join(' '); }
const STATUS = DV.queue.STATUS;

// ── Icon ─────────────────────────────────────────────────────
function Icon({ name, size = 20, className, strokeWidth = 2 }) {
    const wrapRef = React.useRef(null);
    React.useEffect(() => {
        try {
            const wrap = wrapRef.current;
            if (!wrap) return;
            while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

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

// ── Modal ────────────────────────────────────────────────────
/**
 * Accessible dialog with focus trap, optional headerless style.
 * Close: overlay click, explicit close button, or Escape key.
 */
function Modal({ open, onClose, title, children, hideHeader }) {
    const dialogRef = useRef(null);

    // Focus trap: cycle tab focus within the modal
    useEffect(() => {
        if (!open || !dialogRef.current) return;
        function onKeyDown(e) {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            const focusable = dialogRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        document.addEventListener('keydown', onKeyDown);
        // Auto-focus first focusable element
        const first = dialogRef.current.querySelector('button, [href], input, select, textarea');
        if (first) first.focus();
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby={title ? 'dv-modal-title' : undefined}>
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div ref={dialogRef} className="relative max-w-3xl w-full mx-4 p-4 rounded-2xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 shadow-xl">
                {!hideHeader && (
                    <div className="flex items-center justify-between mb-2">
                        <div id="dv-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</div>
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

// ── ErrorBoundary ────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('DistyVault ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
                    <div style={{ textAlign: 'center', maxWidth: 480 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</h1>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                            {String(this.state.error?.message || 'An unexpected error occurred.')}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', background: '#6d28d9', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            Reload
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── TopBar ───────────────────────────────────────────────────
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
                        <div className="font-semibold text-slate-900 dark:text-slate-100">DistyVault</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">Gather, distill and control your knowledge</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
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

// ── CapturePanel ─────────────────────────────────────────────
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

    function removeFile(i) { setFiles(prev => prev.filter((_, idx) => idx !== i)); }
    function clearFiles() { setFiles([]); }

    async function submit() {
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
                        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim()) submit(); }} placeholder="Paste a URL or YouTube link" className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400" />
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
                        {files.slice(0, 6).map((f, i) => (
                            <div key={i} className="px-2 py-1 border rounded-full text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 flex items-center gap-2">
                                <span className="truncate max-w-[160px]">{f.name}</span>
                                <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-slate-700"><Icon name="x" /></button>
                            </div>
                        ))}
                        {files.length > 6 && <span className="text-slate-500">+{files.length - 6} more</span>}
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

// ── StatsRow ─────────────────────────────────────────────────
function StatsRow({ items, onDownloadAll, onStopAll, onRetryFailed }) {
    const completed = items.filter(i => i.status === STATUS.COMPLETED || i.status === STATUS.READ).length;
    const inprog = items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).length;
    const errors = items.filter(i => i.status === STATUS.ERROR).length;

    const Card = ({ label, count, action, actionText, bg }) => (
        <div className={classNames('flex-1 p-3 rounded-xl border border-slate-300 dark:border-white/20', bg)}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="flex items-center justify-between mt-1">
                <div className="text-xl font-semibold text-slate-900 dark:text-white">{count}</div>
                {action && (
                    <button
                        onClick={action}
                        className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-white/10"
                        aria-label={typeof label === 'string' ? label + ' action' : 'action'}
                    >
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

// ── CommandBar ────────────────────────────────────────────────
function CommandBar({ filter, setFilter, search, setSearch, onExport, onImport, sort, setSort, tagFilter, setTagFilter, allTags }) {
    const [expanded, setExpanded] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [tagOpen, setTagOpen] = useState(false);
    const filterRef = useRef(null);
    const tagRef = useRef(null);
    const searchRef = useRef(null);
    const importInputRef = useRef(null);
    useEffect(() => {
        function onDoc(e) {
            if (filterOpen && filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
            if (tagOpen && tagRef.current && !tagRef.current.contains(e.target)) setTagOpen(false);
        }
        document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
    }, [filterOpen, tagOpen]);
    useEffect(() => { if (expanded && searchRef.current) searchRef.current.focus(); }, [expanded]);

    const activeTagCount = tagFilter ? 1 : 0;

    return (
        <div className="max-w-6xl mx-auto mt-6 px-4 py-3 rounded-2xl border border-slate-400 dark:border-white/20 bg-white/90 dark:bg-slate-800/60 glass">
            <div className="flex items-center gap-3 relative">
                {/* Search icon — always visible */}
                <button onClick={() => { const next = !expanded; setExpanded(next); if (!next) setSearch(''); }} className={classNames('w-9 h-9 shrink-0 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 z-30 relative', expanded && 'ring-2 ring-brand-500')} title="Search"><Icon name="search" /></button>

                {/* Search input — overlays filter+tag buttons when expanded */}
                {expanded && (
                    <input
                        ref={searchRef}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setExpanded(false); } }}
                        placeholder="Search…"
                        className="absolute left-12 z-30 h-9 px-3 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                        style={{ width: 'calc(100% - 160px)' }}
                    />
                )}

                {/* Filter button */}
                <div className={classNames('relative z-20', expanded && 'invisible')} ref={filterRef}>
                    <button onClick={() => setFilterOpen(v => !v)} title="Filter" aria-label="Filter"
                        className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800">
                        <Icon name={filter === 'all' ? 'asterisk' : filter === 'url' ? 'link' : filter === 'youtube' ? 'video' : filter === 'file' ? 'file' : 'asterisk'} />
                    </button>
                    {filterOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 mt-2 p-1 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-lg z-50 flex flex-col gap-2">
                            {[
                                { k: 'all', icon: 'asterisk', label: 'All' },
                                { k: 'url', icon: 'link', label: 'URL' },
                                { k: 'youtube', icon: 'video', label: 'YouTube' },
                                { k: 'file', icon: 'file', label: 'File' },
                            ].map(({ k, icon, label }) => (
                                <button key={k} onClick={() => { setFilter(k); setFilterOpen(false); }}
                                    className={classNames('w-9 h-9 flex items-center justify-center rounded-lg',
                                        filter === k ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-100')}
                                    title={label} aria-label={label}
                                >
                                    <Icon name={icon} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tag filter dropdown */}
                {allTags && allTags.length > 0 && (
                    <div className={classNames('relative z-20', expanded && 'invisible')} ref={tagRef}>
                        <button onClick={() => setTagOpen(v => !v)} title="Filter by tag" aria-label="Filter by tag"
                            className={classNames('w-9 h-9 rounded-lg border flex items-center justify-center bg-white dark:bg-slate-800 relative',
                                tagFilter ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-slate-400 dark:border-white/30 text-slate-900 dark:text-white')}>
                            <Icon name="tag" />
                            {activeTagCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center">1</span>
                            )}
                        </button>
                        {tagOpen && (
                            <div className="absolute left-0 mt-2 w-56 max-h-64 overflow-y-auto p-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-lg z-50">
                                <button
                                    onClick={() => { setTagFilter(''); setTagOpen(false); }}
                                    className={classNames('w-full text-left px-3 py-1.5 text-sm rounded-lg mb-1',
                                        !tagFilter ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10')}
                                >All tags</button>
                                <div className="border-t border-slate-200 dark:border-white/10 my-1" />
                                {allTags.map(tag => {
                                    const isSource = tag.startsWith('source:');
                                    const display = isSource ? tag.slice(7) : tag;
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => { setTagFilter(tagFilter === tag ? '' : tag); setTagOpen(false); }}
                                            className={classNames('w-full text-left px-3 py-1.5 text-sm rounded-lg flex items-center gap-2',
                                                tagFilter === tag ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10')}
                                        >
                                            <span className={classNames('w-2 h-2 rounded-full shrink-0',
                                                isSource ? 'bg-teal-500' : 'bg-brand-500')} />
                                            <span className="truncate">{display}</span>
                                            {tagFilter === tag && <Icon name="check" size={14} className="ml-auto shrink-0 text-brand-600 dark:text-brand-400" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <input
                        type="file"
                        accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
                        id="dv-import-input"
                        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
                        ref={importInputRef}
                        onChange={e => {
                            const file = e.target.files && e.target.files[0];
                            if (file) onImport(file);
                            e.target.value = '';
                        }}
                    />
                    <label
                        htmlFor="dv-import-input"
                        role="button"
                        tabIndex={0}
                        title="Import"
                        aria-label="Import"
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); importInputRef.current?.click(); } }}
                        className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 cursor-pointer"
                    >
                        <Icon name="download" />
                    </label>
                    <button onClick={onExport} title="Export" aria-label="Export" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800"><span style={{ display: 'inline-block', transform: 'rotate(180deg)' }}><Icon name="download" /></span></button>

                </div>
            </div>
        </div>
    );
}

// ── StatusChip ───────────────────────────────────────────────
function StatusChip({ status, onClick }) {
    const map = {
        [STATUS.PENDING]: 'bg-slate-200 text-slate-700',
        [STATUS.EXTRACTING]: 'bg-amber-200 text-amber-900',
        [STATUS.DISTILLING]: 'bg-indigo-200 text-indigo-900',
        [STATUS.COMPLETED]: 'bg-emerald-200 text-emerald-900',
        [STATUS.READ]: 'bg-blue-100 text-blue-800', // Distinct style for read items
        [STATUS.ERROR]: 'bg-rose-200 text-rose-900',
        [STATUS.STOPPED]: 'bg-slate-300 text-slate-800'
    };
    return <span onClick={onClick} className={classNames('px-2 py-1 rounded-full text-xs cursor-default', map[status])}>{status}</span>;
}

// ── PlaylistRowName ──────────────────────────────────────────
function PlaylistRowName({ i, expandedIds, setExpandedIds }) {
    const expanded = expandedIds && expandedIds.has(i.id);
    return (
        <div className="overflow-hidden flex items-center gap-2">
            <button
                className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center"
                title={expanded ? 'Collapse' : 'Expand'}
                onClick={(e) => { e.stopPropagation(); setExpandedIds(prev => { const n = new Set(prev); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; }); }}
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

function isYouTubePlaylist(item) {
    return item.kind === 'playlist';
}

function formatDuration(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}m ${r}s`;
}

// ── Source icon/label mapping ────────────────────────────────
const SOURCE_META = {
    youtube: { icon: 'youtube', label: 'YouTube' },
    substack: { icon: 'mail', label: 'Substack' },
    medium: { icon: 'book-open', label: 'Medium' },
    github: { icon: 'github', label: 'GitHub' },
    arxiv: { icon: 'file-text', label: 'arXiv' },
    wikipedia: { icon: 'globe', label: 'Wikipedia' },
    reddit: { icon: 'message-circle', label: 'Reddit' },
    x: { icon: 'at-sign', label: 'X' },
    nytimes: { icon: 'newspaper', label: 'NYTimes' },
    bbc: { icon: 'radio', label: 'BBC' },
    guardian: { icon: 'newspaper', label: 'Guardian' },
    stackoverflow: { icon: 'code', label: 'Stack Overflow' },
    hackernews: { icon: 'terminal', label: 'Hacker News' },
    linkedin: { icon: 'linkedin', label: 'LinkedIn' },
    notion: { icon: 'layout', label: 'Notion' },
    pdf: { icon: 'file-text', label: 'PDF' },
    document: { icon: 'file', label: 'Document' },
    image: { icon: 'image', label: 'Image' },
    text: { icon: 'file-text', label: 'Text' },
    file: { icon: 'paperclip', label: 'File' },
    web: { icon: 'link', label: 'Web' },
};

function SourceBadge({ item }) {
    const sourceTag = (item.tags || []).find(t => t.startsWith('source:'));
    const key = sourceTag ? sourceTag.slice(7) : (item.kind === 'youtube' ? 'youtube' : item.kind === 'file' ? 'file' : 'web');
    const meta = SOURCE_META[key] || SOURCE_META.web;
    return (
        <div className="flex items-center gap-1.5 justify-center text-xs text-slate-600 dark:text-slate-300">
            <Icon name={meta.icon} size={14} className="opacity-60" />
            <span className="truncate">{meta.label}</span>
        </div>
    );
}

function TagBadges({ tags }) {
    if (!tags || !tags.length) return null;
    return (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
            {tags.map(t => {
                const isSource = t.startsWith('source:');
                return (
                    <span key={t} className={classNames(
                        'px-1.5 py-0 text-[10px] leading-4 rounded-full border',
                        isSource
                            ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700/40'
                            : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-700/40'
                    )}>
                        {isSource ? t.slice(7) : t}
                    </span>
                );
            })}
        </div>
    );
}

// ── Table ────────────────────────────────────────────────────
function Table({ items, allItems, selected, setSelected, onView, onRetry, onDownload, onDelete, onSort, expandedIds, setExpandedIds }) {
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
    function toggle(id) {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }

    function onRowClick(e, item) {
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
            const allSel = siblings.every(s => next.includes(s.id));
            if (allSel) next = Array.from(new Set([...next, item.parentId]));
            else next = next.filter(id => id !== item.parentId);
            setSelected(next);
        } else {
            toggle(item.id);
        }
    }

    return (
        <div className="max-w-6xl mx-auto mt-4 rounded-2xl border border-slate-300 dark:border-white/20 overflow-hidden">
            <div className="overflow-x-auto w-full">
                <table className="w-full table-fixed rounded-2xl overflow-hidden">
                    <thead className="bg-slate-100 dark:bg-slate-800/70 select-none">
                        <tr>
                            <th className="w-[50%] sm:w-[50%] p-2 pl-4 text-left cursor-pointer" onClick={() => onSort && onSort('title')}>Name</th>
                            <th className="hidden sm:table-cell w-[15%] p-2 text-center cursor-pointer" onClick={() => onSort && onSort('source')}>Source</th>
                            <th className="w-[30%] sm:w-[15%] p-2 text-center cursor-pointer" onClick={() => onSort && onSort('status')}>Status</th>
                            <th className="hidden sm:table-cell w-[20%] p-2 text-center relative">
                                <span className="cursor-pointer" onClick={() => onSort && onSort('date')}>Date</span>
                                <button title="Reset sort" aria-label="Reset sort" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" onClick={() => onSort && onSort('queue')}><Icon name="rotate-ccw" /></button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-600 dark:text-slate-300">Paste a URL or upload a document to get started</td></tr>
                        )}
                        {items.map(i => (
                            <tr key={i.id} onClick={(e) => onRowClick(e, i)} tabIndex="0" role="row" onKeyDown={(e) => { if (e.key === 'Enter') onRowClick(e, i); }} className={classNames('border-t border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors', selected.includes(i.id) ? 'bg-brand-50/70 dark:bg-brand-600/10' : '', isPlaylistChild(i) ? 'pl-8' : '')}>
                                {/* Name column */}
                                <td className={classNames('p-2 pl-4 text-left', isPlaylistChild(i) ? 'pl-8' : '')}>
                                    {i.kind === 'file' ? (
                                        <div className="overflow-hidden">
                                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{i.title}</div>
                                            <TagBadges tags={i.tags} />
                                        </div>
                                    ) : i.kind === 'playlist' ? (
                                        <PlaylistRowName i={i} expandedIds={expandedIds} setExpandedIds={setExpandedIds} />
                                    ) : (
                                        <div className="overflow-hidden">
                                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                                {i.url ? (
                                                    <a href={i.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:underline text-inherit" title={i.url}>
                                                        {(i.title && i.title !== i.url) ? i.title : (i.status === STATUS.PENDING ? `Loading...` : (i.status === STATUS.EXTRACTING ? 'Extracting title...' : i.title))}
                                                    </a>
                                                ) : (
                                                    (i.title && i.title !== i.url) ? i.title : (i.status === STATUS.PENDING ? `Loading...` : (i.status === STATUS.EXTRACTING ? 'Extracting title...' : i.title))
                                                )}
                                            </div>
                                            {(i.tags && i.tags.length > 0) ? (
                                                <TagBadges tags={i.tags} />
                                            ) : i.url ? (
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{i.url}</div>
                                            ) : (
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 invisible select-none">placeholder</div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                {/* Source column — hidden on mobile */}
                                <td className="hidden sm:table-cell p-2 text-center">
                                    {i.kind === 'playlist' ? null : <SourceBadge item={i} />}
                                </td>
                                {/* Status column */}
                                <td className="p-2 text-center">
                                    {i.kind === 'playlist' ? null : (
                                        <StatusChip status={i.status} onClick={(e) => { e.stopPropagation(); if (i.status === STATUS.ERROR) DV.bus.emit('ui:openError', i); }} />
                                    )}
                                </td>
                                {/* Date column — hidden on mobile */}
                                <td className="hidden sm:table-cell p-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                                    {i.kind === 'playlist' ? '' : DV.utils.relativeTime(i.createdAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── SelectionDock ────────────────────────────────────────────
function SelectionDock({ count, anyActive, allSelected, disableViewDownload, disableView, onView, onRetry, onDownload, onDelete, onStop, onSelectAll, onUnselectAll, onTag }) {
    if (!count) return null;
    return (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-full border border-slate-300 dark:border-white/20 bg-white/90 dark:bg-slate-800/80 glass shadow max-w-[95vw]">
            <div className="overflow-x-auto">
                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    {count === 1 && (
                        <button onClick={onView} disabled={disableView} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800 disabled:opacity-50"><Icon name="eye" /><span>View</span></button>
                    )}
                    <button onClick={onRetry} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="refresh-ccw" /><span>Retry</span></button>
                    {anyActive && <button onClick={onStop} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="square" /><span>Stop</span></button>}
                    <button onClick={onDownload} disabled={disableViewDownload} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800 disabled:opacity-50"><Icon name="arrow-down-to-line" /><span>Download</span></button>
                    <button onClick={onTag} className="px-2 py-1 text-sm rounded-md border border-slate-400 dark:border-white/30 inline-flex items-center gap-1 text-slate-900 dark:text-white bg-white dark:bg-slate-800"><Icon name="tag" /><span>Tag</span></button>
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

// ── TagEditorModal ───────────────────────────────────────────
function TagEditorModal({ open, onClose, selectedIds, items, allTags }) {
    const [input, setInput] = useState('');
    const selectedItems = items.filter(i => selectedIds.includes(i.id));
    const currentTags = useMemo(() => {
        const s = new Set();
        selectedItems.forEach(i => (i.tags || []).forEach(t => s.add(t)));
        return Array.from(s).sort();
    }, [selectedItems]);

    async function addTag() {
        const tag = input.trim().toLowerCase();
        if (!tag) return;
        for (const id of selectedIds) {
            const item = items.find(i => i.id === id);
            const existing = item?.tags || [];
            if (!existing.includes(tag)) {
                await DV.queue.updateTags(id, [...existing, tag]);
            }
        }
        setInput('');
    }
    async function removeTag(tag) {
        for (const id of selectedIds) {
            const item = items.find(i => i.id === id);
            const existing = item?.tags || [];
            await DV.queue.updateTags(id, existing.filter(t => t !== tag));
        }
    }

    if (!open) return null;
    return (
        <Modal open={open} onClose={onClose} title="Manage Tags">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
                        placeholder="Add a tag…"
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 outline-none text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button onClick={addTag} className="h-9 px-3 rounded-lg bg-brand-700 text-white text-sm">Add</button>
                </div>

                {currentTags.length > 0 && (
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current tags</div>
                        <div className="flex flex-wrap gap-1">
                            {currentTags.map(t => (
                                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/40">
                                    {t}
                                    <button onClick={() => removeTag(t)} className="flex items-center justify-center hover:text-rose-600"><Icon name="x" size={12} /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

// ── SettingsDrawer ───────────────────────────────────────────
function SettingsDrawer({ open, onClose, settings, setSettings }) {
    const DEFAULTS = { ai: { mode: '', model: '', apiKey: '' }, concurrency: 1 };
    const [local, setLocal] = useState(settings || DEFAULTS);
    const [testing, setTesting] = useState(false);
    useEffect(() => {
        const cloned = settings ? { ...settings, ai: { ...(settings.ai || {}) } } : { ...DEFAULTS };
        setLocal(cloned);
    }, [settings]);

    function save() { setSettings(local); DV.toast('Settings saved', { type: 'success' }); onClose(); }
    function reset() {
        setLocal({ ...DEFAULTS });
        setTesting(false);
    }
    async function testKey() {
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
                            onChange={e => setLocal({ ...local, ai: { ...local.ai, mode: e.target.value, model: '' } })}
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
                                    onChange={e => setLocal({ ...local, ai: { ...local.ai, model: e.target.value } })}
                                    className="w-full h-10 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 px-2">
                                    <option value="">Select a model</option>
                                    {local.ai.mode === 'anthropic' && [
                                        { v: 'claude-opus-4.6-latest', l: 'Claude Opus 4.6' },
                                        { v: 'claude-sonnet-4.5-latest', l: 'Claude Sonnet 4.5' },
                                        { v: 'claude-haiku-4.5-latest', l: 'Claude Haiku 4.5' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'deepseek' && [
                                        { v: 'deepseek-chat', l: 'DeepSeek Chat' },
                                        { v: 'deepseek-reasoner', l: 'DeepSeek Reasoner' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'gemini' && [
                                        { v: 'gemini-3-flash-preview', l: 'Gemini 3 Flash' },
                                        { v: 'gemini-3-pro-preview', l: 'Gemini 3 Pro' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'grok' && [
                                        { v: 'grok-4', l: 'Grok 4' },
                                        { v: 'grok-4.1-fast', l: 'Grok 4.1 Fast' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'openai' && [
                                        { v: 'gpt-5-mini', l: 'GPT-5 Mini' },
                                        { v: 'gpt-5', l: 'GPT-5' },
                                        { v: 'o4-mini', l: 'O4 Mini' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="text-sm font-medium mb-1">API Key</div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type="password"
                                            value={local.ai.apiKey || ''}
                                            onChange={e => { setLocal({ ...local, ai: { ...local.ai, apiKey: e.target.value } }); }}
                                            placeholder="Paste a valid API Key"
                                            className={classNames('w-full h-10 rounded-lg bg-white dark:bg-slate-900/60 px-2 text-sm text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-white/30')} />
                                    </div>
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
                        <input type="range" min="1" max="10" value={local.concurrency} onChange={e => setLocal({ ...local, concurrency: Number(e.target.value) })} />
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

// ── ContentModal ─────────────────────────────────────────────
function ContentModal({ item, onClose }) {
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState('');
    const iframeRef = useRef(null);

    useEffect(() => {
        if (!item) {
            setHtml('');
            setErrorText('');
            return;
        }

        setLoading(true);
        setErrorText('');

        DV.db.get('contents', item.id).then(content => {
            if (content?.html) {
                try {
                    const viewer = (window.DV && typeof DV.buildViewerHtml === 'function') ? DV.buildViewerHtml(content.html) : content.html;
                    setHtml(viewer);
                } catch {
                    setHtml(content.html || '');
                }
            } else if (item.error) {
                setHtml('');
                setErrorText(item.error);
            } else {
                setHtml('');
            }
            setLoading(false);
        }).catch(() => {
            if (item.error) setErrorText(item.error);
            setHtml('');
            setLoading(false);
        });
    }, [item?.id]);

    useEffect(() => {
        const fr = iframeRef.current;
        if (!fr) return;
        function sendTheme() {
            try {
                const isDark = document.documentElement.classList.contains('dark');
                fr.contentWindow && fr.contentWindow.postMessage({ type: 'dv-theme', isDark }, window.location.origin);
            } catch { }
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
                ) : errorText ? (
                    <div className="flex flex-col items-center justify-center h-[65vh] gap-4 px-6">
                        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"><Icon name="alert-triangle" size={24} className="text-rose-600 dark:text-rose-400" /></div>
                        <div className="text-sm font-medium text-rose-700 dark:text-rose-300">Distillation failed</div>
                        <div className="text-sm text-rose-600 dark:text-rose-400 whitespace-pre-wrap text-center max-w-md">{errorText}</div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-[65vh] text-slate-600 dark:text-slate-300">
                        <div className="text-sm">No content available</div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

// ── ErrorModal ───────────────────────────────────────────────
function ErrorModal({ item, onClose }) {
    return (
        <Modal open={!!item} onClose={onClose} title={item ? 'Error — ' + (item.title || '') : 'Error'}>
            <div className="text-sm text-rose-700 dark:text-rose-300 whitespace-pre-wrap">{item?.error || 'Unknown error'}</div>
        </Modal>
    );
}

// ── Export ────────────────────────────────────────────────────
window.DV = window.DV || {};
window.DV.components = {
    Icon, Modal, ErrorBoundary, TopBar, CapturePanel, StatsRow,
    CommandBar, StatusChip, PlaylistRowName, Table, SelectionDock,
    TagEditorModal, SettingsDrawer, ContentModal, ErrorModal,
    classNames, isYouTubePlaylist, formatDuration
};
