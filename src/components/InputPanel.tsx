import { useState } from 'react';
import { processItemProcess } from '../lib/pipeline';
import { useAppStore } from '../store/useAppStore';

export function InputPanel() {
    const [url, setUrl] = useState('');
    const { searchQuery, setSearchQuery, sortOption, setSortOption } = useAppStore();
    const [isDragging, setIsDragging] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        // Fire and forget (sequential inside)
        processItemProcess({ url });
        setUrl('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processItemProcess({ file: e.target.files[0] });
            e.target.value = ''; // Reset
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processItemProcess({ file: e.dataTransfer.files[0] });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    return (
        <section className="input-panel">
            <div
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <form onSubmit={handleSubmit} className="input-form">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste URL (YouTube / Articles) to distill..."
                        className="url-input"
                    />
                    <div className="file-input-wrapper">
                        <label className="file-label">
                            📄 Upload File
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept=".txt,.md,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                                className="hidden-file-input"
                            />
                        </label>
                    </div>
                    <button type="submit" className="distill-btn" disabled={!url.trim()}>
                        Distill URL
                    </button>
                </form>
            </div>

            <div className="filter-controls">
                <input
                    type="text"
                    placeholder="Search title or summary..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="sort-select"
                >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="title-asc">Title (A-Z)</option>
                    <option value="status">Status</option>
                </select>
            </div>
        </section>
    );
}
