import { useAppStore } from '../store/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useState } from 'react';
import { processWithGemini } from '../lib/gemini';

export function SummaryModal() {
    const selectedItemId = useAppStore((state) => state.selectedItemId);
    const closeSummary = useAppStore((state) => state.closeSummary);

    const [isRedistilling, setIsRedistilling] = useState(false);
    const [tagInput, setTagInput] = useState('');

    const item = useLiveQuery(
        () => selectedItemId ? db.items.get(selectedItemId) : undefined,
        [selectedItemId]
    );

    if (!selectedItemId || !item) return null;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleRedistill = async () => {
        if (!item.rawText) return;
        setIsRedistilling(true);
        try {
            await db.items.update(item.id, { status: 'processing', summary: '' });
            const newSummary = await processWithGemini(item.rawText);
            await db.items.update(item.id, { summary: newSummary, status: 'done' });
        } catch (err: any) {
            await db.items.update(item.id, { status: 'error', error: err.message });
        } finally {
            setIsRedistilling(false);
        }
    };

    const handleAddTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tagInput.trim()) return;

        const newTag = tagInput.trim().toLowerCase();
        const currentTags = item.tags || [];

        if (!currentTags.includes(newTag)) {
            await db.items.update(item.id, { tags: [...currentTags, newTag] });
        }
        setTagInput('');
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        const currentTags = item.tags || [];
        await db.items.update(item.id, {
            tags: currentTags.filter(t => t !== tagToRemove)
        });
    };

    return (
        <div className="settings-overlay" onClick={closeSummary}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{item.title || item.source}</h2>
                    <div className="modal-actions">
                        <button onClick={() => handleCopy(item.rawText)} className="action-btn" title="Copy Raw Text">📄 Raw</button>
                        <button onClick={() => handleCopy(item.summary || '')} className="action-btn" title="Copy Summary">📋 Summary</button>
                        <button
                            onClick={handleRedistill}
                            className="action-btn redistill-btn"
                            disabled={isRedistilling || item.status === 'processing'}
                        >
                            {isRedistilling ? '⏳ Processing...' : '🔄 Re-Distill'}
                        </button>
                        <button onClick={closeSummary} className="close-btn">✕</button>
                    </div>
                </div>

                <div className="tags-container">
                    <div className="tags-list">
                        {(item.tags || []).map(tag => (
                            <span key={tag} className="tag-badge">
                                #{tag} <button onClick={() => handleRemoveTag(tag)} className="tag-remove">×</button>
                            </span>
                        ))}
                    </div>
                    <form onSubmit={handleAddTag} className="tag-form">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            placeholder="Add tag..."
                            className="tag-input"
                        />
                    </form>
                </div>

                <div className="modal-body">
                    {item.summary ? (
                        <div className="markdown-content">
                            {/* For Phase 1 strict UI, we just render as text. 
                  A proper markdown parser is outside minimal scope unless requested. */}
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                {item.summary}
                            </pre>
                        </div>
                    ) : (
                        <p>{item.status === 'processing' ? 'Distilling thick summary...' : 'Summary not available.'}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
