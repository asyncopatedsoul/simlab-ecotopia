import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import {
  REGION_PACK_SCHEMA_SQL,
  REGION_PACK_SCHEMA_VERSION,
  latToCell,
  lonToCell,
} from './schema';
import {
  packMetaSchema,
  RegionPackError,
  type PackMeta,
  type RegionPackInput,
} from './types';

/**
 * The builder turns a typed `RegionPackInput` into the raw bytes of a region
 * pack. It runs in Node (for `tools/region-pack`) and in the browser (for any
 * future authoring tool); both go through `sql.js`.
 *
 * Runtime *queries* against an already-loaded pack go through `sqlocal` over
 * OPFS — see `engine/storage/species.ts`. The builder is build-time only.
 */

export type BuildResult = {
  /** Validated pack.json with stats filled in. */
  meta: PackMeta;
  /** SQLite database bytes for `data.sqlite`. */
  databaseBytes: Uint8Array;
  /** All files of the pack, keyed by path relative to the pack root. */
  files: Map<string, Uint8Array>;
};

let cachedSqlJs: Promise<SqlJsStatic> | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (!cachedSqlJs) {
    cachedSqlJs = initSqlJs();
  }
  return cachedSqlJs;
}

/**
 * Build a region pack from typed input.
 *
 * The result includes `pack.json` (with computed stats), `schema.sql`, and
 * `data.sqlite` plus every asset under `assets/`. Persist with `writePackToFs`
 * (Node) or hand to `createMemoryPackSource` for an in-memory round-trip.
 */
export async function buildRegionPack(input: RegionPackInput): Promise<BuildResult> {
  validateInputShape(input);

  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  try {
    db.exec(REGION_PACK_SCHEMA_SQL);

    const generatedAt = input.meta.generated_at ?? new Date().toISOString();

    insertPackMeta(db, {
      schema_version: String(REGION_PACK_SCHEMA_VERSION),
      pack_id: input.meta.pack_id,
      pack_version: input.meta.pack_version,
      generated_at: generatedAt,
    });

    let photosCount = 0;
    let audioCount = 0;
    let assetBytesTotal = 0;
    const assetFiles = new Map<string, Uint8Array>();

    const insertTaxon = db.prepare(`
      INSERT INTO taxa (id, scientific_name, rank, kingdom, class, inat_taxon_id, gbif_taxon_id, source)
      VALUES ($id, $sn, $rank, $kg, $cls, $inat, $gbif, $src)
    `);
    const insertCommonName = db.prepare(`
      INSERT INTO common_names (taxon_id, language, name, is_primary)
      VALUES ($id, $lang, $name, $prim)
    `);
    const insertPhoto = db.prepare(`
      INSERT INTO photos_manifest (taxon_id, path, width, height, byte_size, attribution, license, source_url)
      VALUES ($id, $p, $w, $h, $sz, $attr, $lic, $url)
    `);
    const insertAudio = db.prepare(`
      INSERT INTO audio_manifest (taxon_id, path, duration_ms, byte_size, kind, attribution, license, source_url)
      VALUES ($id, $p, $dur, $sz, $kind, $attr, $lic, $url)
    `);
    const insertOcc = db.prepare(`
      INSERT OR REPLACE INTO occurrences_summary (taxon_id, cell_lat, cell_lon, observation_count)
      VALUES ($id, $lat, $lon, COALESCE((SELECT observation_count FROM occurrences_summary WHERE taxon_id=$id AND cell_lat=$lat AND cell_lon=$lon), 0) + $n)
    `);

    try {
      db.exec('BEGIN');
      for (const t of input.taxa) {
        insertTaxon.run({
          $id: t.id,
          $sn: t.scientific_name,
          $rank: t.rank,
          $kg: t.kingdom,
          $cls: t.class ?? null,
          $inat: t.inat_taxon_id ?? null,
          $gbif: t.gbif_taxon_id ?? null,
          $src: t.source,
        });
        for (const cn of t.common_names) {
          insertCommonName.run({
            $id: t.id,
            $lang: cn.language,
            $name: cn.name,
            $prim: cn.is_primary ? 1 : 0,
          });
        }
        for (const p of t.photos) {
          insertPhoto.run({
            $id: t.id,
            $p: p.path,
            $w: p.width,
            $h: p.height,
            $sz: p.byte_size,
            $attr: p.attribution,
            $lic: p.license,
            $url: p.source_url ?? null,
          });
          assetFiles.set(`assets/${p.path}`, p.bytes);
          assetBytesTotal += p.bytes.byteLength;
          photosCount++;
        }
        for (const a of t.audio) {
          insertAudio.run({
            $id: t.id,
            $p: a.path,
            $dur: a.duration_ms,
            $sz: a.byte_size,
            $kind: a.kind,
            $attr: a.attribution,
            $lic: a.license,
            $url: a.source_url ?? null,
          });
          assetFiles.set(`assets/${a.path}`, a.bytes);
          assetBytesTotal += a.bytes.byteLength;
          audioCount++;
        }
        for (const o of t.occurrences) {
          insertOcc.run({
            $id: t.id,
            $lat: latToCell(o.lat),
            $lon: lonToCell(o.lon),
            $n: o.observation_count,
          });
        }
      }
      db.exec('COMMIT');
    } finally {
      insertTaxon.free();
      insertCommonName.free();
      insertPhoto.free();
      insertAudio.free();
      insertOcc.free();
    }

    const databaseBytes = db.export();
    const dbBytes = new Uint8Array(
      databaseBytes.buffer,
      databaseBytes.byteOffset,
      databaseBytes.byteLength,
    );

    const meta: PackMeta = packMetaSchema.parse({
      manifest_version: 1,
      pack_id: input.meta.pack_id,
      pack_version: input.meta.pack_version,
      schema_version: REGION_PACK_SCHEMA_VERSION,
      title: input.meta.title,
      license: input.meta.license,
      generated_at: generatedAt,
      region: input.meta.region,
      stats: {
        taxa_count: input.taxa.length,
        photos_count: photosCount,
        audio_count: audioCount,
        byte_size_total: dbBytes.byteLength + assetBytesTotal,
      },
    });

    const files = new Map<string, Uint8Array>();
    files.set('pack.json', encodeUtf8(JSON.stringify(meta, null, 2) + '\n'));
    files.set('schema.sql', encodeUtf8(REGION_PACK_SCHEMA_SQL + '\n'));
    files.set('data.sqlite', dbBytes);
    for (const [path, bytes] of assetFiles) {
      files.set(path, bytes);
    }

    return { meta, databaseBytes: dbBytes, files };
  } finally {
    db.close();
  }
}

function insertPackMeta(db: Database, rows: Record<string, string>): void {
  const stmt = db.prepare('INSERT INTO pack_meta (key, value) VALUES (?, ?)');
  try {
    for (const [k, v] of Object.entries(rows)) {
      stmt.run([k, v]);
    }
  } finally {
    stmt.free();
  }
}

function validateInputShape(input: RegionPackInput): void {
  const ids = new Set<number>();
  for (const t of input.taxa) {
    if (ids.has(t.id)) {
      throw new RegionPackError(
        `duplicate taxon id: ${t.id}`,
        'BUILDER_INVALID_INPUT',
      );
    }
    ids.add(t.id);
    if (t.common_names.length === 0) {
      throw new RegionPackError(
        `taxon ${t.id} has no common_names; at least one required for runtime display`,
        'BUILDER_INVALID_INPUT',
      );
    }
    for (const p of t.photos) {
      if (!p.path.startsWith('photos/')) {
        throw new RegionPackError(
          `photo path must start with 'photos/': ${p.path}`,
          'BUILDER_INVALID_INPUT',
        );
      }
      if (p.bytes.byteLength !== p.byte_size) {
        throw new RegionPackError(
          `photo byte_size mismatch for ${p.path}: declared ${p.byte_size}, actual ${p.bytes.byteLength}`,
          'BUILDER_INVALID_INPUT',
        );
      }
    }
    for (const a of t.audio) {
      if (!a.path.startsWith('audio/')) {
        throw new RegionPackError(
          `audio path must start with 'audio/': ${a.path}`,
          'BUILDER_INVALID_INPUT',
        );
      }
      if (a.bytes.byteLength !== a.byte_size) {
        throw new RegionPackError(
          `audio byte_size mismatch for ${a.path}: declared ${a.byte_size}, actual ${a.bytes.byteLength}`,
          'BUILDER_INVALID_INPUT',
        );
      }
    }
  }
}

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Node-only: write a build result to disk as a `<pack_id>.biotope-region/` directory. */
export async function writePackToFs(
  result: BuildResult,
  outDir: string,
): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname, join, sep } = await import('node:path');
  await mkdir(outDir, { recursive: true });
  for (const [path, bytes] of result.files) {
    const native = path.split('/').join(sep);
    const full = join(outDir, native);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
}
