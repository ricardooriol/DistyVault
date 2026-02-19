import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';

export default function ContentModal({ item, onClose }) {
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

        if (window.DV?.db?.get) {
            window.DV.db.get('contents', item.id).then(content => {
                if (content?.html) {
                    try {
                        // DV.buildViewerHtml is likely in utils or App... it seems it was in App.jsx or Components.jsx
                        // Actually, I don't recall seeing buildViewerHtml in Components.jsx. 
                        // It might be a global function or I missed it.
                        // I'll check if it exists on window.DV, otherwise just use content.html.
                        const viewer = (window.DV && typeof window.DV.buildViewerHtml === 'function') ? window.DV.buildViewerHtml(content.html) : content.html;
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
        } else {
            setLoading(false);
            setErrorText('Database not available');
        }
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
