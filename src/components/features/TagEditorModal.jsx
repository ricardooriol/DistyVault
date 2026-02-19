import React, { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';

export default function TagEditorModal({ open, onClose, selectedIds, items, allTags }) {
    const [input, setInput] = useState('');
    const selectedItems = items.filter(i => selectedIds.includes(i.id));
    const currentTags = useMemo(() => {
        const s = new Set();
        selectedItems.forEach(i => (i.tags || []).forEach(t => s.add(t)));
        return Array.from(s).sort();
    }, [selectedItems]);

    async function addTag() {
        const tag = input.trim().toLowerCase();
        if (!tag) return;

        // Use global DV.queue if available
        if (window.DV?.queue?.updateTags) {
            for (const id of selectedIds) {
                const item = items.find(i => i.id === id);
                const existing = item?.tags || [];
                if (!existing.includes(tag)) {
                    await window.DV.queue.updateTags(id, [...existing, tag]);
                }
            }
        }
        setInput('');
    }

    async function removeTag(tag) {
        if (window.DV?.queue?.updateTags) {
            for (const id of selectedIds) {
                const item = items.find(i => i.id === id);
                const existing = item?.tags || [];
                await window.DV.queue.updateTags(id, existing.filter(t => t !== tag));
            }
        }
    }

    if (!open) return null;
    return (
        <Modal open={open} onClose={onClose} title="Manage Tags">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
                        placeholder="Add a tag…"
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 outline-none text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button onClick={addTag} className="h-9 px-3 rounded-lg bg-brand-700 text-white text-sm">Add</button>
                </div>

                {currentTags.length > 0 && (
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current tags</div>
                        <div className="flex flex-wrap gap-1">
                            {currentTags.map(t => (
                                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/40">
                                    {t}
                                    <button onClick={() => removeTag(t)} className="flex items-center justify-center hover:text-rose-600"><Icon name="x" size={12} /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
