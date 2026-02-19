import React from 'react';
import { cn } from '@/lib/utils';
// We'll interpret STATUS based on strict strings to avoid depending on a global object for constants if possible, 
// or import them if we move queue.js first. For now, strings work.
const STATUS = {
    PENDING: 'pending',
    EXTRACTING: 'extracting',
    DISTILLING: 'distilling',
    COMPLETED: 'completed',
    READ: 'read',
    ERROR: 'error',
    STOPPED: 'stopped'
};

export default function StatusChip({ status, onClick }) {
    const map = {
        [STATUS.PENDING]: 'bg-slate-200 text-slate-700',
        [STATUS.EXTRACTING]: 'bg-amber-200 text-amber-900',
        [STATUS.DISTILLING]: 'bg-indigo-200 text-indigo-900',
        [STATUS.COMPLETED]: 'bg-emerald-200 text-emerald-900',
        [STATUS.READ]: 'bg-blue-100 text-blue-800',
        [STATUS.ERROR]: 'bg-rose-200 text-rose-900',
        [STATUS.STOPPED]: 'bg-slate-300 text-slate-800'
    };
    return (
        <span
            onClick={onClick}
            className={cn('px-2 py-1 rounded-full text-xs cursor-default', map[status] || 'bg-slate-100')}
        >
            {status}
        </span>
    );
}
