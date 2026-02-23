import Dexie, { type EntityTable } from 'dexie';
import type { Item } from '../types/item';

// Initialize the database
const db = new Dexie('DistyVaultDB') as Dexie & {
    items: EntityTable<Item, 'id'>;
};

// Define the schema: only id, source, default indexes
db.version(1).stores({
    items: 'id, source, type, status, createdAt'
});

export async function recoverStuckItems() {
    try {
        await db.items
            .where('status')
            .anyOf(['pending', 'extracting', 'processing'])
            .modify({
                status: 'error',
                error: 'Recovered from unexpected shutdown before completion.'
            });
    } catch (err) {
        console.error("Failed to recover stuck items:", err);
    }
}

export { db };
