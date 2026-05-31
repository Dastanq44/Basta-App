import * as SQLite from 'expo-sqlite';
import { DB_NAME, QUEUE_ITEMS_DDL } from './schema';

let cached: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton database handle, opening it on first use and applying schema.
 * Safe to call from concurrent contexts — only one open happens because subsequent calls
 * await the same promise.
 */
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (cached) return Promise.resolve(cached);
  if (openPromise) return openPromise;
  openPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(QUEUE_ITEMS_DDL);
    cached = db;
    return db;
  })();
  return openPromise;
}
