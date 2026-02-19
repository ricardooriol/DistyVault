import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

export default function Modal({ open, onClose, title, children, hideHeader }) {
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
    }, [open, onClose]);

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
