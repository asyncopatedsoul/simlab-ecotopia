import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import type {
  BlobStore,
  KvStore,
  QuotaObserver,
  SpeciesDB,
  SpeciesParam,
  Storage,
} from '../storage/types';

/**
 * In-test backings for the storage facade. The runtime uses sqlocal (OPFS +
 * worker) and OPFS-direct blobs; neither is available under jsdom, so the
 * round-trip tests substitute these.
 *
 * The SpeciesDB binding wraps sql.js so we can run real SQL — the loader's
 * version checks and the geo query are exercised end-to-end.
 */

export async function createSqlJsSpeciesDB(): Promise<SpeciesDB> {
  const SQL = await initSqlJs();
  let db: Database = new SQL.Database();

  const toRows = <T>(execResult: ReturnType<Database['exec']>): T[] => {
    if (execResult.length === 0) return [];
    const { columns, values } = execResult[0]!;
    return values.map((row) => {
      const obj = {} as Record<string, SqlValue>;
      columns.forEach((c, i) => {
        obj[c] = row[i] ?? null;
      });
      return obj as T;
    });
  };

  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params: SpeciesParam[] = [],
    ): Promise<T[]> {
      const execResult = db.exec(sql, params as SqlValue[]);
      return toRows<T extends Record<string, unknown> ? T : Record<string, unknown>>(
        execResult,
      ) as T[];
    },
    async exec(sql: string, params: SpeciesParam[] = []): Promise<void> {
      if (params.length === 0) {
        db.exec(sql);
      } else {
        db.run(sql, params as SqlValue[]);
      }
    },
    async loadFromBytes(bytes: Uint8Array): Promise<void> {
      db.close();
      db = new SQL.Database(bytes);
    },
    async close(): Promise<void> {
      db.close();
    },
  };
}

export function createMemoryBlobStore(): BlobStore {
  const map = new Map<string, Uint8Array>();
  return {
    async put(path, data) {
      let bytes: Uint8Array;
      if (data instanceof Blob) {
        bytes = new Uint8Array(await data.arrayBuffer());
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.byteLength);
        bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      } else {
        throw new Error('createMemoryBlobStore.put: unsupported data type');
      }
      map.set(path, bytes);
    },
    async get(path) {
      const bytes = map.get(path);
      return bytes ? new Blob([new Uint8Array(bytes)]) : undefined;
    },
    async delete(path) {
      map.delete(path);
    },
    async list(prefix) {
      const out: string[] = [];
      for (const k of map.keys()) {
        if (!prefix || k === prefix || k.startsWith(prefix + '/')) out.push(k);
      }
      return out;
    },
    async bytesUsed() {
      let total = 0;
      for (const v of map.values()) total += v.byteLength;
      return total;
    },
  };
}

export function createNoopKvStore(): KvStore {
  const map = new Map<string, unknown>();
  return {
    async get(key) {
      return map.get(key) as never;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    async keys(prefix) {
      const out: string[] = [];
      for (const k of map.keys()) {
        if (!prefix || k.startsWith(prefix)) out.push(k);
      }
      return out;
    },
    async clear() {
      map.clear();
    },
  };
}

export function createNoopQuotaObserver(): QuotaObserver {
  return {
    onThreshold() {
      return () => {};
    },
    async refresh() {
      return { usageBytes: 0, quotaBytes: 0, ratio: 0 };
    },
    stop() {},
  };
}

export async function createInMemoryStorage(): Promise<Storage> {
  const species = await createSqlJsSpeciesDB();
  return {
    species,
    blobs: createMemoryBlobStore(),
    kv: createNoopKvStore(),
    quota: createNoopQuotaObserver(),
    async requestPersist() {
      return false;
    },
    async close() {
      await species.close();
    },
  };
}
