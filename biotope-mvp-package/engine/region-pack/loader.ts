import type { Storage } from '../storage/types';
import { REGION_PACK_SCHEMA_VERSION } from './schema';
import type { PackSource } from './sources';
import {
  packMetaSchema,
  RegionPackError,
  type LoadedPack,
  type PackMeta,
} from './types';

/**
 * Load a `.biotope-region` pack into the storage facade.
 *
 * Order:
 *   1. Read pack.json, validate, version-check.
 *   2. Replace species DB from data.sqlite (wholesale).
 *   3. Cross-check pack_meta in the loaded DB matches pack.json.
 *   4. Copy every asset referenced by photos_manifest / audio_manifest into
 *      BlobStore under `region-packs/<pack_id>/<path>`.
 *
 * The loader is idempotent: re-loading the same pack overwrites the species
 * DB and the asset blobs at their existing paths. It does NOT delete a
 * previously-loaded pack's stale assets — call `unloadRegionPack` for that.
 */
export async function loadRegionPack(
  source: PackSource,
  storage: Storage,
): Promise<LoadedPack> {
  const meta = await readPackMeta(source);

  if (meta.manifest_version !== 1) {
    throw new RegionPackError(
      `unsupported pack manifest_version: ${meta.manifest_version} (loader supports 1)`,
      'MANIFEST_VERSION_UNSUPPORTED',
    );
  }
  if (meta.schema_version !== REGION_PACK_SCHEMA_VERSION) {
    throw new RegionPackError(
      `unsupported pack schema_version: ${meta.schema_version} (loader supports ${REGION_PACK_SCHEMA_VERSION})`,
      'SCHEMA_VERSION_UNSUPPORTED',
    );
  }

  const dbBytes = await source.read('data.sqlite');
  await storage.species.loadFromBytes(dbBytes);

  await crossCheckPackMeta(storage, meta);

  const photoRows = await storage.species.query<{ path: string }>(
    'SELECT path FROM photos_manifest ORDER BY taxon_id, path',
  );
  const audioRows = await storage.species.query<{ path: string }>(
    'SELECT path FROM audio_manifest ORDER BY taxon_id, path',
  );

  let bytesCopied = 0;
  for (const { path } of photoRows) {
    bytesCopied += await copyAsset(source, storage, meta.pack_id, path);
  }
  for (const { path } of audioRows) {
    bytesCopied += await copyAsset(source, storage, meta.pack_id, path);
  }

  const taxaCount = (
    await storage.species.query<{ n: number }>('SELECT COUNT(*) AS n FROM taxa')
  )[0]?.n;

  return {
    meta,
    taxaCount: taxaCount ?? 0,
    photoCount: photoRows.length,
    audioCount: audioRows.length,
    bytesCopied,
  };
}

/**
 * Tear down a loaded pack's blob storage. The species DB is not cleared here
 * (a fresh `loadRegionPack` overwrites it wholesale). Call this when switching
 * between packs to reclaim OPFS space from a no-longer-used region.
 */
export async function unloadRegionPack(packId: string, storage: Storage): Promise<void> {
  const prefix = `region-packs/${packId}`;
  const paths = await storage.blobs.list(prefix);
  for (const p of paths) {
    await storage.blobs.delete(p);
  }
}

async function readPackMeta(source: PackSource): Promise<PackMeta> {
  let bytes: Uint8Array;
  try {
    bytes = await source.read('pack.json');
  } catch (e) {
    throw new RegionPackError(
      'pack.json missing from pack source',
      'PACK_META_INVALID',
      e,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    throw new RegionPackError(
      'pack.json is not valid JSON',
      'PACK_META_INVALID',
      e,
    );
  }
  const result = packMetaSchema.safeParse(raw);
  if (!result.success) {
    throw new RegionPackError(
      `pack.json failed schema validation: ${result.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ')}`,
      'PACK_META_INVALID',
      result.error,
    );
  }
  return result.data;
}

async function crossCheckPackMeta(storage: Storage, meta: PackMeta): Promise<void> {
  const rows = await storage.species.query<{ key: string; value: string }>(
    "SELECT key, value FROM pack_meta WHERE key IN ('pack_id', 'schema_version', 'pack_version')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const dbPackId = map.get('pack_id');
  const dbSchemaVersion = map.get('schema_version');
  if (dbPackId !== meta.pack_id) {
    throw new RegionPackError(
      `pack.json declares pack_id=${meta.pack_id} but data.sqlite says pack_id=${dbPackId ?? '<missing>'}`,
      'PACK_META_MISMATCH',
    );
  }
  if (Number(dbSchemaVersion) !== meta.schema_version) {
    throw new RegionPackError(
      `pack.json declares schema_version=${meta.schema_version} but data.sqlite says ${dbSchemaVersion ?? '<missing>'}`,
      'PACK_META_MISMATCH',
    );
  }
}

async function copyAsset(
  source: PackSource,
  storage: Storage,
  packId: string,
  manifestPath: string,
): Promise<number> {
  const bytes = await source.read(`assets/${manifestPath}`);
  // Copy into a fresh ArrayBuffer-backed view so BlobStore.put accepts it
  // under strict ArrayBuffer typing (Uint8Array<ArrayBufferLike> isn't a
  // BufferSource). Same pattern as engine/assets/hash.ts.
  const fresh = new Uint8Array(bytes.byteLength);
  fresh.set(bytes);
  await storage.blobs.put(`region-packs/${packId}/${manifestPath}`, fresh);
  return bytes.byteLength;
}
