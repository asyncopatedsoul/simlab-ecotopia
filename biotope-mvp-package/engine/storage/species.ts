import { SQLocal } from 'sqlocal';
import type { SpeciesDB, SpeciesParam } from './types';

/**
 * Wrap sqlocal in the storage facade's SpeciesDB interface.
 *
 * sqlocal runs wa-sqlite over OPFS in a dedicated worker — this gives us
 * SyncAccessHandle-grade IO without blocking the main thread. The runtime
 * never blocks on a query; everything is awaited.
 *
 * The database file lives under OPFS at the path passed in `databasePath`.
 * Region packs (bd-spec.1) replace this file wholesale via `loadFromBytes`.
 */
export async function createSpeciesDB(databasePath: string): Promise<SpeciesDB> {
  const db = new SQLocal(databasePath);

  return {
    async query<T = Record<string, unknown>>(sql: string, params: SpeciesParam[] = []): Promise<T[]> {
      return db.sql<T extends Record<string, unknown> ? T : Record<string, unknown>>(
        sql,
        ...params,
      ) as Promise<T[]>;
    },
    async exec(sql: string, params: SpeciesParam[] = []): Promise<void> {
      await db.sql(sql, ...params);
    },
    async loadFromBytes(bytes: Uint8Array): Promise<void> {
      await db.overwriteDatabaseFile(bytes as Uint8Array<ArrayBuffer>);
    },
    async close(): Promise<void> {
      await db.destroy();
    },
  };
}
