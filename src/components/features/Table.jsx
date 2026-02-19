import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/Icon';
import StatusChip from '@/components/ui/StatusChip';
import PlaylistRowName from '@/components/ui/PlaylistRowName';
import SourceBadge from '@/components/ui/SourceBadge';
import TagBadges from '@/components/ui/TagBadges';
import { cn, relativeTime } from '@/lib/utils';
import { STATUS } from '@/lib/constants';

export default function Table({ items, allItems, selected, setSelected, onView, onRetry, onDownload, onDelete, onSort, expandedIds, setExpandedIds }) {
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
            <div className="overflow-x-auto w-full -webkit-overflow-scrolling-touch">
                <table className="w-full min-w-[640px] table-auto rounded-2xl overflow-hidden">
                    <thead className="bg-slate-100 dark:bg-slate-800/70 select-none">
                        <tr>
                            <th className="w-[50%] sm:w-[50%] p-2 pl-4 text-left cursor-pointer" onClick={() => onSort && onSort('title')}>Name</th>
                            <th className="w-[15%] p-2 text-center cursor-pointer" onClick={() => onSort && onSort('source')}>Source</th>
                            <th className="w-[30%] sm:w-[15%] p-2 text-center cursor-pointer" onClick={() => onSort && onSort('status')}>Status</th>
                            <th className="w-[20%] p-2">
                                <div className="flex items-center justify-center gap-1">
                                    <span className="cursor-pointer" onClick={() => onSort && onSort('date')}>Date</span>
                                    <button title="Reset sort" aria-label="Reset sort" className="text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" onClick={() => onSort && onSort('queue')}><Icon name="rotate-ccw" size={14} /></button>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-600 dark:text-slate-300">Paste a URL or upload a document to get started</td></tr>
                        )}
                        {items.map(i => (
                            <tr key={i.id} onClick={(e) => onRowClick(e, i)} tabIndex="0" role="row" onKeyDown={(e) => { if (e.key === 'Enter') onRowClick(e, i); }} className={cn('border-t border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors', selected.includes(i.id) ? 'bg-brand-50/70 dark:bg-brand-600/10' : '', isPlaylistChild(i) ? 'pl-8' : '')}>
                                {/* Name column */}
                                <td className={cn('p-2 pl-4 text-left', isPlaylistChild(i) ? 'pl-8' : '')}>
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
                                {/* Source column */}
                                <td className="p-2 text-center">
                                    {i.kind === 'playlist' ? null : <SourceBadge item={i} />}
                                </td>
                                {/* Status column */}
                                <td className="p-2 text-center">
                                    {i.kind === 'playlist' ? null : (
                                        <StatusChip status={i.status} onClick={(e) => { e.stopPropagation(); if (i.status === STATUS.ERROR && window.DV?.bus) window.DV.bus.emit('ui:openError', i); }} />
                                    )}
                                </td>
                                {/* Date column */}
                                <td className="p-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                                    {i.kind === 'playlist' ? '' : relativeTime(i.createdAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
