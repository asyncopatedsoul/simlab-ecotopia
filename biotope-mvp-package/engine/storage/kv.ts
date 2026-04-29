import Dexie, { type Table } from 'dexie';
import type { KvStore } from './types';

type KvRow = { key: string; value: unknown };

class KvDexie extends Dexie {
  rows!: Table<KvRow, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({ rows: '&key' });
  }
}

export function createKvStore(dbName = 'biotope-kv'): KvStore {
  const db = new KvDexie(dbName);

  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      const row = await db.rows.get(key);
      return row?.value as T | undefined;
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      await db.rows.put({ key, value });
    },
    async delete(key: string): Promise<void> {
      await db.rows.delete(key);
    },
    async keys(prefix?: string): Promise<string[]> {
      if (prefix == null) {
        return db.rows.toCollection().primaryKeys();
      }
      const upper = prefix + '￿';
      return db.rows.where('key').between(prefix, upper, true, true).primaryKeys();
    },
    async clear(): Promise<void> {
      await db.rows.clear();
    },
  };
}
