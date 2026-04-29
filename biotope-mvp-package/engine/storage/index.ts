import { createBlobStore } from './blobs';
import { createKvStore } from './kv';
import { requestPersist } from './persist';
import { createQuotaObserver } from './quota';
import { createSpeciesDB } from './species';
import type { QuotaObserverOptions } from './quota';
import type { Storage } from './types';

export type CreateStorageOptions = {
  kvDbName?: string;
  speciesDbPath?: string;
  quota?: QuotaObserverOptions;
};

export async function createStorage(opts: CreateStorageOptions = {}): Promise<Storage> {
  const kv = createKvStore(opts.kvDbName);
  const blobs = await createBlobStore();
  const species = await createSpeciesDB(opts.speciesDbPath ?? 'biotope-species.sqlite3');
  const quota = createQuotaObserver(opts.quota);

  return {
    kv,
    blobs,
    species,
    quota,
    requestPersist,
    async close() {
      await species.close();
      quota.stop();
    },
  };
}

export { createKvStore } from './kv';
export { createBlobStore } from './blobs';
export { createSpeciesDB } from './species';
export { createQuotaObserver } from './quota';
export { requestPersist } from './persist';
export { LARGE_BLOB_THRESHOLD_BYTES } from './types';
export type {
  BlobStore,
  KvStore,
  QuotaListener,
  QuotaObserver,
  QuotaSnapshot,
  SpeciesDB,
  SpeciesParam,
  Storage,
} from './types';
