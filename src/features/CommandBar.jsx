import React, { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import { cn } from '../utils';

export default function CommandBar({ filter, setFilter, search, setSearch, onExport, onImport, sort, setSort, tagFilter, setTagFilter, allTags }) {
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
                <button onClick={() => { const next = !expanded; setExpanded(next); if (!next) setSearch(''); }} className={cn('w-9 h-9 shrink-0 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800 z-30 relative', expanded && 'ring-2 ring-brand-500')} title="Search"><Icon name="search" /></button>

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
                <div className={cn('relative z-20', expanded && 'invisible')} ref={filterRef}>
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
                                    className={cn('w-9 h-9 flex items-center justify-center rounded-lg',
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
                    <div className={cn('relative z-20', expanded && 'invisible')} ref={tagRef}>
                        <button onClick={() => setTagOpen(v => !v)} title="Filter by tag" aria-label="Filter by tag"
                            className={cn('w-9 h-9 rounded-lg border flex items-center justify-center bg-white dark:bg-slate-800 relative',
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
                                    className={cn('w-full text-left px-3 py-1.5 text-sm rounded-lg mb-1',
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
                                            className={cn('w-full text-left px-3 py-1.5 text-sm rounded-lg flex items-center gap-2',
                                                tagFilter === tag ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10')}
                                        >
                                            <span className={cn('w-2 h-2 rounded-full shrink-0',
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
