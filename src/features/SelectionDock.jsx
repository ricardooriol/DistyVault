import React from 'react';
import Icon from '../ui/Icon';

export default function SelectionDock({ count, anyActive, allSelected, disableViewDownload, disableView, onView, onRetry, onDownload, onDelete, onStop, onSelectAll, onUnselectAll, onTag }) {
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
