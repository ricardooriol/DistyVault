import React from 'react';
import Icon from '@/components/ui/Icon';

export default function PlaylistRowName({ i, expandedIds, setExpandedIds }) {
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
