import React from 'react';
import { cn } from '../utils';

export default function TagBadges({ tags }) {
    if (!tags || !tags.length) return null;
    return (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
            {tags.map(t => {
                const isSource = t.startsWith('source:');
                return (
                    <span key={t} className={cn(
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
