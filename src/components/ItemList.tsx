// @ts-nocheck
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ItemRow } from './ItemRow';
import { useAppStore } from '../store/useAppStore';
import * as ReactWindow from 'react-window';
import { useState, useEffect } from 'react';
import type { Item } from '../types/item';

let RealList = null;
try {
    if (ReactWindow) {
        RealList = (ReactWindow as any).FixedSizeList ||
            (ReactWindow as any).List ||
            (ReactWindow as any).default?.FixedSizeList ||
            (ReactWindow as any).default?.List;
    }
} catch (e) {
    // Ignore runtime resolution errors, FallbackList will take over
}

// Fallback component if react-window fails to load (React 18/19 Strict Mode)
const FallbackList = ({ itemData, itemSize, children: RowComponent, height, width, style }: any) => {
    const containerStyle = {
        height: height,
        width: width,
        overflowY: 'auto' as const,
        ...style
    };
    return (
        <div style={containerStyle}>
            {itemData.map((_: any, index: number) => (
                <RowComponent key={itemData[index]?.id || index} index={index} style={{ height: itemSize }} data={itemData} />
            ))}
        </div>
    );
};

const List = FallbackList;

export function ItemList() {
    const { searchQuery, sortOption } = useAppStore();
    const [listHeight, setListHeight] = useState(800);

    useEffect(() => {
        const updateHeight = () => setListHeight(Math.max(400, window.innerHeight - 250));
        window.addEventListener('resize', updateHeight);
        updateHeight();
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const items = useLiveQuery(async () => {
        let collection = await db.items.toArray();

        // 1. Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            collection = collection.filter(item =>
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.summary && item.summary.toLowerCase().includes(q)) ||
                (item.source && item.source.toLowerCase().includes(q)) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)))
            );
        }

        // 2. Sort
        collection.sort((a, b) => {
            switch (sortOption) {
                case 'date-desc': return b.createdAt - a.createdAt;
                case 'date-asc': return a.createdAt - b.createdAt;
                case 'title-asc':
                    const titleA = (a.title || a.source).toLowerCase();
                    const titleB = (b.title || b.source).toLowerCase();
                    return titleA.localeCompare(titleB);
                case 'status':
                    return a.status.localeCompare(b.status);
                default: return b.createdAt - a.createdAt;
            }
        });

        return collection;
    }, [searchQuery, sortOption]);

    if (!items || items.length === 0) {
        return (
            <section className="item-list empty">
                <p>No items distilled yet. Paste a URL above to start.</p>
            </section>
        );
    }

    if (!RealList) {
        // Fallback gracefully if Vite kills the import
        return (
            <section className="item-list">
                {items.map((item) => <ItemRow key={item.id} item={item} />)}
            </section>
        );
    }

    return (
        <section className="item-list">
            <List
                height={listHeight}
                itemCount={items.length}
                itemSize={88} // Fixed row height matching CSS
                width="100%"
                itemData={items}
                style={{ overflowX: 'hidden' }}
            >
                {Row}
            </List>
        </section>
    );
}

// React Window Row Renderer
const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data: Item[] }) => {
    const item = data && data[index];
    if (!item) return null;
    return (
        <div style={{ ...style, paddingRight: '12px' }}>
            <ItemRow item={item} />
        </div>
    );
};
