import { useRef } from 'react';
import { db } from '../lib/db';

export function VaultControls() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = async () => {
        try {
            const allItems = await db.items.toArray();
            const jsonString = JSON.stringify(allItems, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `DistyVault_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export vault:', error);
            alert('Failed to export vault. See console for details.');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const items = JSON.parse(text);

                if (!Array.isArray(items)) {
                    throw new Error('Invalid backup file format');
                }

                if (confirm(`Warning: This will overwrite your current vault with ${items.length} items. Continue?`)) {
                    await db.transaction('rw', db.items, async () => {
                        await db.items.clear();
                        await db.items.bulkAdd(items);
                    });
                    alert('Vault successfully restored!');
                }
            } catch (error) {
                console.error('Failed to import vault:', error);
                alert('Failed to import vault. Make sure it is a valid DistyVault JSON backup.');
            }
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="vault-controls">
            <h3>Vault Controls</h3>
            <p className="help-text">Backup or restore your entire local database.</p>
            <div className="vault-actions">
                <button onClick={handleExport} className="action-btn export-btn">
                    ↓ Export JSON
                </button>
                <div className="import-wrapper">
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleImport}
                        className="hidden-file-input"
                        id="vault-import"
                    />
                    <label htmlFor="vault-import" className="action-btn import-btn">
                        ↑ Import JSON
                    </label>
                </div>
            </div>
        </div>
    );
}
