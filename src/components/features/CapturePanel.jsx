import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/Icon';

export default function CapturePanel({ onSubmit }) {
    const [url, setUrl] = useState('');
    const [files, setFiles] = useState([]);
    const dropRef = useRef(null);

    function choose(evt) {
        const f = Array.from(evt.target.files || []);
        if (f.length) setFiles(prev => [...prev, ...f]);
    }

    function onDrop(e) {
        e.preventDefault();
        const f = Array.from(e.dataTransfer.files || []);
        if (f.length) setFiles(prev => [...prev, ...f]);
        dropRef.current?.classList.remove('ring-2', 'ring-brand-500');
    }

    function onDragOver(e) { e.preventDefault(); dropRef.current?.classList.add('ring-2', 'ring-brand-500'); }
    function onDragLeave() { dropRef.current?.classList.remove('ring-2', 'ring-brand-500'); }

    function removeFile(i) { setFiles(prev => prev.filter((_, idx) => idx !== i)); }
    function clearFiles() { setFiles([]); }

    async function submit() {
        const trimmed = url.trim();
        await onSubmit(trimmed, files);
        setUrl('');
        setFiles([]);
    }

    return (
        <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} className="max-w-6xl mx-auto mt-6 p-4 rounded-2xl border border-slate-400 dark:border-white/20 bg-white/90 dark:bg-slate-800/60 glass">
            <div className="flex flex-col gap-3">
                <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-0 relative">
                        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim()) submit(); }} placeholder="Paste a URL or YouTube link" className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400" />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white"><Icon name="link" /></div>
                    </div>
                    <label className="h-12 w-12 rounded-xl border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-800 flex items-center justify-center cursor-pointer text-slate-900 dark:text-white" title="Choose files" aria-label="Choose files">
                        <input type="file" multiple className="hidden" onChange={choose} />
                        <Icon name="paperclip" />
                    </label>
                    <button onClick={submit} title="Distill" aria-label="Distill" className="h-12 w-12 rounded-xl bg-brand-700 text-white hover:bg-brand-800 flex items-center justify-center"><Icon name="wand-2" /></button>
                </div>

                {files.length > 0 && (
                    <div className="text-sm flex items-center gap-2 flex-wrap">
                        {files.slice(0, 6).map((f, i) => (
                            <div key={i} className="px-2 py-1 border rounded-full text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 flex items-center gap-2">
                                <span className="truncate max-w-[160px]">{f.name}</span>
                                <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-slate-700"><Icon name="x" /></button>
                            </div>
                        ))}
                        {files.length > 6 && <span className="text-slate-500">+{files.length - 6} more</span>}
                        <button onClick={clearFiles} className="ml-auto inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
                            <Icon name="trash-2" />
                            <span>Remove all</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
