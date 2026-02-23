import type { Item } from '../types/item';
import { useAppStore } from '../store/useAppStore';

interface Props {
    item: Item;
}

export function ItemRow({ item }: Props) {
    const openSummary = useAppStore((state) => state.openSummary);

    const getStatusDisplay = (status: Item['status']) => {
        switch (status) {
            case 'pending': return 'Pending...';
            case 'extracting': return 'Extracting...';
            case 'processing': return 'Distilling...';
            case 'done': return 'View Summary';
            case 'error': return 'Error';
        }
    };

    return (
        <article className={`item-row status-${item.status}`}>
            <div className="item-content">
                <h3 className="item-title">{item.title || item.source}</h3>
                {item.error && <p className="item-error">{item.error}</p>}
            </div>
            <div className="item-actions">
                <span className="status-badge">{getStatusDisplay(item.status)}</span>
                {item.status === 'done' && (
                    <button
                        onClick={() => openSummary(item.id)}
                        className="view-btn"
                    >
                        Open
                    </button>
                )}
            </div>
        </article>
    );
}
