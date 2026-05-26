
import { openDB } from 'idb';
import { supabase } from './supabaseClient';

const DB_NAME = 'fitvlr_offline_db';
const STORE_NAME = 'pending_updates';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  },
});

export const addToSyncQueue = async (operation: 'insert' | 'update', table: string, data: any) => {
  const db = await dbPromise;
  await db.add(STORE_NAME, { operation, table, data, timestamp: Date.now() });
};

export const processSyncQueue = async () => {
    if (!navigator.onLine) return;

    const db = await dbPromise;
    const items = await db.getAll(STORE_NAME);
    
    if (items.length === 0) return;

    for (const item of items) {
        try {
            if (item.operation === 'insert') {
               const { error } = await supabase.from(item.table).insert(item.data);
               if (error) throw error;
            } else if (item.operation === 'update') {
               const { error } = await supabase.from(item.table).update(item.data).eq('id', item.data.id);
               if (error) throw error;
            }
            // If successful, remove from DB
            await db.delete(STORE_NAME, item.id);
        } catch (e) {
            console.error('Failed to sync item', item, e);
            // Keep in queue to try again later
        }
    }
};
