export type ItemType = 'url' | 'youtube' | 'file';

export interface Item {
    id: string;
    type: ItemType;
    source: string;
    title: string;
    status: 'pending' | 'extracting' | 'processing' | 'done' | 'error';
    createdAt: number;
    rawText: string;
    summary: string;
    tags?: string[];
    error?: string;
}
