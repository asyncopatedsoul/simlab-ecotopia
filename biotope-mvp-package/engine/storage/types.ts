/**
 * Three-tier storage facade.
 *
 * - kv: small JSON-y app state (progress, settings, scenario unlocks). Backed
 *   by Dexie (IndexedDB).
 * - blobs: large binary content (3D assets, audio, photos). Backed by OPFS.
 *   Anything below `LARGE_BLOB_THRESHOLD_BYTES` should still go through here
 *   for consistency, but the threshold is the inflection point where IndexedDB
 *   starts losing to OPFS for both throughput and quota.
 * - species: queryable species/region data. Backed by sqlocal (wa-sqlite over
 *   OPFS in a worker). Used by the runtime to resolve sightings, drive the
 *   scenario-step gates, and populate Field Guide entries.
 *
 * The quota observer is shared across stores. Persistence (`navigator.storage
 * .persist()`) is requested explicitly, never at app launch.
 */

export const LARGE_BLOB_THRESHOLD_BYTES = 10 * 1024 * 1024;

export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

export interface BlobStore {
  /** Write a blob at `path`. Overwrites existing. Path is a forward-slash key. */
  put(path: string, data: Blob | BufferSource): Promise<void>;
  /** Read a blob. Returns `undefined` if missing. */
  get(path: string): Promise<Blob | undefined>;
  delete(path: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  /** Total bytes used by this store (best-effort; may be approximate). */
  bytesUsed(): Promise<number>;
}

export type SpeciesParam = string | number | null | Uint8Array;

export interface SpeciesDB {
  /** Run a query, returning row objects. Read-only. */
  query<T = Record<string, unknown>>(sql: string, params?: SpeciesParam[]): Promise<T[]>;
  /** Run a statement (INSERT/UPDATE/DELETE/CREATE). Write path. */
  exec(sql: string, params?: SpeciesParam[]): Promise<void>;
  /** Bulk-load: replace the entire database from a SQLite blob. */
  loadFromBytes(bytes: Uint8Array): Promise<void>;
  /** Close the underlying worker. Idempotent. */
  close(): Promise<void>;
}

export type QuotaSnapshot = {
  usageBytes: number;
  quotaBytes: number;
  /** Fraction in [0, 1]. */
  ratio: number;
};

export type QuotaListener = (snapshot: QuotaSnapshot) => void;

export interface QuotaObserver {
  /** Subscribe to threshold-crossing events. Returns unsubscribe. */
  onThreshold(threshold: number, listener: QuotaListener): () => void;
  /** Force a fresh estimate now. */
  refresh(): Promise<QuotaSnapshot>;
  /** Stop polling. */
  stop(): void;
}

export interface Storage {
  kv: KvStore;
  blobs: BlobStore;
  species: SpeciesDB;
  quota: QuotaObserver;
  /**
   * Request that the browser mark this origin as persisted. MUST be called
   * from a user-gesture-or-scenario-load context, NOT at app boot.
   * Returns the resulting persisted state.
   */
  requestPersist(): Promise<boolean>;
  /** Tear down all backing stores. */
  close(): Promise<void>;
}
