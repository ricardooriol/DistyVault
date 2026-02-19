import React from 'react';
import Icon from '@/components/ui/Icon';

export default function TopBar({ theme, setTheme, openSettings }) {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    const themeIcon = isDark ? 'moon' : 'sun';
    const logoSrc = isDark ? '/logos/logo_no_bg_w.png' : '/logos/logo_no_bg_b.png';

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
