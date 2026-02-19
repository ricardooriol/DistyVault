import React from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/constants';

export default function StatsRow({ items, onDownloadAll, onStopAll, onRetryFailed }) {
    const completed = items.filter(i => i.status === STATUS.COMPLETED || i.status === STATUS.READ).length;
    const inprog = items.filter(i => [STATUS.PENDING, STATUS.EXTRACTING, STATUS.DISTILLING].includes(i.status)).length;
    const errors = items.filter(i => i.status === STATUS.ERROR).length;

    const Card = ({ label, count, action, actionText, bg }) => (
        <div className={cn('flex-1 p-3 rounded-xl border border-slate-300 dark:border-white/20', bg)}>
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
