# Region Pack Format (`.biotope-region`)

*Version: pack format v1 · Schema: v1 · Status: stable for MVP*

A **region pack** is a self-contained, license-clean species dataset for a geographic region. The runtime loads one region pack at a time; scenarios reference taxa from the loaded pack by stable IDs.

This document is the contract for `bd-spec.1`. The first concrete pack (`la-greater-v1`) is built per `bd-spec.2`; the online iNaturalist fallback (`bd-spec.3`) shares the same SQL schema.

---

## 1. Goals and non-goals

A region pack must:

- Be **fully offline-playable** after first install — no network for queries, photos, or audio.
- Round-trip through the storage layer (`engine/storage`) without conversion: the SQLite blob is fed directly to `species.loadFromBytes()`.
- Answer **`find taxa near (lat, lon)`** in <50 ms on tablet-class hardware (the bd-spec.1 acceptance bar).
- Carry per-asset attribution and license metadata so the app can display credits and so a human reviewer can audit the pack.
- Stay **under 50 MB** for the LA pack (bd-spec.2 acceptance bar). The format itself is unbounded; budget enforcement is per-pack.

It is explicitly **not** a goal to:

- Be a general-purpose taxonomic database. We track only what scenarios use: identity, common names, photos, calls, occurrence cells.
- Support full-text search over descriptions, range maps, behavior notes. Those live in scenario content, not the pack.
- Mirror iNaturalist or GBIF in full. We curate down to ~150 taxa per region.

---

## 2. Directory layout

```
la-greater-v1.biotope-region/
  pack.json              ← metadata + integrity, machine-readable
  schema.sql             ← the SQL DDL applied to data.sqlite (informational, for diffs)
  data.sqlite            ← the populated database (the only file the runtime parses)
  assets/
    photos/
      <taxon-id>/
        001.webp
        002.webp
        003.webp
    audio/
      <taxon-id>/
        001.ogg
```

`<taxon-id>` is the integer id from the `taxa` table, zero-padded is *not* required — `1`, `42`, `1234` are all fine.

A pack may also be distributed as a single `.biotope-region.zip` archive containing the same layout — the loader's `PackSource` interface lets the runtime accept either.

### Path conventions

- **Forward slashes only.** Even on Windows hosts, paths in `pack.json` and the manifest tables use `/`.
- **Asset paths in SQL are relative to `assets/`.** `photos_manifest.path = 'photos/42/001.webp'` resolves to `assets/photos/42/001.webp`.
- **Asset paths in BlobStore are namespaced by pack id.** When the loader copies assets to OPFS, it writes to `region-packs/<pack_id>/<asset-path>` so multiple packs can coexist.

---

## 3. `pack.json`

```json
{
  "manifest_version": 1,
  "pack_id": "la-greater-v1",
  "pack_version": "1.0.0",
  "schema_version": 1,
  "title": "Greater Los Angeles",
  "license": "CC-BY-4.0",
  "generated_at": "2026-04-28T12:00:00Z",
  "region": {
    "name": "Greater Los Angeles",
    "bbox": { "w": -118.7, "s": 33.7, "e": -117.6, "n": 34.4 }
  },
  "stats": {
    "taxa_count": 150,
    "photos_count": 450,
    "audio_count": 120,
    "byte_size_total": 45300000
  }
}
```

Field definitions:

| Field | Required | Notes |
|---|---|---|
| `manifest_version` | yes | Top-level format version. Currently `1`. Bumped only on incompatible changes to `pack.json` itself. |
| `pack_id` | yes | Globally unique slug, lowercase, `[a-z0-9-]+`. Convention: `<region>-<scope>-v<n>` (e.g. `la-greater-v1`). |
| `pack_version` | yes | SemVer for *content* edits within a pack id. Bump patch on photo swaps, minor on adding species, major on schema_version change. |
| `schema_version` | yes | The SQL `schema.sql` version this pack uses. Loader rejects mismatches. |
| `title` | yes | Human-readable name. |
| `license` | yes | SPDX-style license id. Pack-level — individual photos/audio carry their own. |
| `generated_at` | yes | ISO 8601 UTC timestamp from the build tool. |
| `region.name` | yes | Human-readable region label. |
| `region.bbox` | yes | Bounding box in WGS-84 degrees. `w/s/e/n` ordering. The loader treats this as a soft hint, not a query filter. |
| `stats` | yes | Pre-computed counts and total byte size. The loader cross-checks against the SQL tables; mismatches are warnings, not errors. |

---

## 4. SQL schema (v1)

Applied via `schema.sql` at build time; the populated DB is `data.sqlite`. Keep this file in source so diffs are visible.

```sql
PRAGMA user_version = 1;
PRAGMA foreign_keys = ON;

CREATE TABLE pack_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Required rows: schema_version, pack_id, pack_version, generated_at.

CREATE TABLE taxa (
  id              INTEGER PRIMARY KEY,
  scientific_name TEXT NOT NULL,
  rank            TEXT NOT NULL,    -- 'species' | 'subspecies' | 'genus'
  kingdom         TEXT NOT NULL,    -- 'Animalia' | 'Plantae' | 'Fungi'
  class           TEXT,             -- 'Aves' | 'Mammalia' | 'Reptilia' | 'Insecta' | NULL for plants
  inat_taxon_id   INTEGER,          -- iNaturalist taxon id; nullable
  gbif_taxon_id   INTEGER,          -- GBIF taxonKey; nullable
  source          TEXT NOT NULL     -- 'inat' | 'gbif' | 'manual'
);
CREATE UNIQUE INDEX idx_taxa_inat ON taxa(inat_taxon_id) WHERE inat_taxon_id IS NOT NULL;
CREATE INDEX idx_taxa_class ON taxa(class);

CREATE TABLE common_names (
  taxon_id   INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  language   TEXT NOT NULL,         -- BCP-47 language tag
  name       TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (taxon_id, language, name)
);
CREATE INDEX idx_common_names_lang_name ON common_names(language, name);

CREATE TABLE photos_manifest (
  taxon_id    INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,            -- relative to assets/, e.g. 'photos/42/001.webp'
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  byte_size   INTEGER NOT NULL,
  attribution TEXT NOT NULL,            -- e.g. 'Photo by Jane Doe (CC-BY-4.0)'
  license     TEXT NOT NULL,            -- SPDX id; pack builder rejects non-permissive
  source_url  TEXT,                     -- e.g. iNat observation URL
  PRIMARY KEY (taxon_id, path)
);

CREATE TABLE audio_manifest (
  taxon_id    INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,            -- relative to assets/
  duration_ms INTEGER NOT NULL,
  byte_size   INTEGER NOT NULL,
  kind        TEXT NOT NULL,            -- 'call' | 'song' | 'alarm' | 'flight'
  attribution TEXT NOT NULL,
  license     TEXT NOT NULL,
  source_url  TEXT,
  PRIMARY KEY (taxon_id, path)
);

CREATE TABLE occurrences_summary (
  taxon_id          INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  cell_lat          INTEGER NOT NULL,   -- floor(lat * 10); ~11 km cells at the equator
  cell_lon          INTEGER NOT NULL,   -- floor(lon * 10)
  observation_count INTEGER NOT NULL,   -- # of records summarized into this cell
  PRIMARY KEY (taxon_id, cell_lat, cell_lon)
);
CREATE INDEX idx_occ_cell ON occurrences_summary(cell_lat, cell_lon);
```

### Why this shape

- **`taxa.id` is integer** to keep the join columns small. Source-side ids (`inat_taxon_id`, `gbif_taxon_id`) are kept for traceability but never used as foreign keys.
- **`occurrences_summary` is a coarse 0.1° grid** rather than a per-observation table or a real spatial index. Reasoning: the only geo query the runtime asks is "what taxa are common near here?", a 0.1° (~11 km) cell is the right granularity for a parent-and-child app, and a B-tree index on `(cell_lat, cell_lon)` is well within sqlite-WASM's strengths. Adding R*Tree would mean compiling a custom sqlite build — not worth it for this access pattern.
- **`photos_manifest.path` is the source of truth for assets.** The loader iterates these to copy assets into BlobStore; orphan files in `assets/` are ignored (and flagged by the validator).
- **No FTS tables.** The pack is small and lookups are by id or geo. If we need full-text search later, add an FTS5 table in schema_version 2.

### Index strategy

| Query | Uses |
|---|---|
| `findTaxaNear(lat, lon)` | `idx_occ_cell` → `taxa` PK |
| `getCommonName(taxonId, lang)` | `common_names` PK prefix |
| `lookupByCommonName('robin', 'en')` | `idx_common_names_lang_name` |
| `listByClass('Aves')` | `idx_taxa_class` |
| `listPhotos(taxonId)` | `photos_manifest` PK prefix |

---

## 5. Loader behavior

The loader's contract (`engine/region-pack/loader.ts`):

```ts
loadRegionPack(source: PackSource, storage: Storage): Promise<LoadedPack>
```

What it does, in order:

1. Read `pack.json`. Validate against `packMetaSchema` (zod). Reject on malformed.
2. Verify `manifest_version === 1` and `schema_version === REGION_PACK_SCHEMA_VERSION`. Hard error on mismatch — the loader does not migrate.
3. Read `data.sqlite` as bytes. Pass to `storage.species.loadFromBytes(bytes)`. This **replaces** any prior species DB.
4. Cross-check: query `pack_meta` for `pack_id` and `schema_version`. Must match `pack.json`. Hard error on mismatch.
5. Iterate `photos_manifest` and `audio_manifest`. For each row, read `assets/<path>` from the source and write to `storage.blobs.put('region-packs/<pack_id>/<path>', bytes)`. The loader is idempotent — re-loading the same pack overwrites existing assets at the same paths.
6. Return a `LoadedPack` summary: `{ meta, taxaCount, photoCount, audioCount, bytesCopied }`.

The loader does **not**:

- Delete a previously-loaded pack's assets from BlobStore. Use `unloadRegionPack(packId, storage)` for that.
- Verify per-asset checksums. Add in v2 if needed for over-the-air updates.
- Fetch missing assets from the network. The pack is the source of truth; missing files throw.

### Asset addressing at runtime

Once loaded, scenario code resolves a photo via the BlobStore at `region-packs/<pack_id>/photos/<taxon-id>/<file>`. The runtime exposes a helper `resolveAssetUrl(packId, relPath)` that hands back a `blob:` URL.

---

## 6. PackSource interface

The loader reads from a `PackSource` so the same loader serves multiple delivery modes:

```ts
export interface PackSource {
  /** Read a file relative to the pack root. Throws if missing. */
  read(path: string): Promise<Uint8Array>;
}
```

Built-in sources:

| Factory | Use case |
|---|---|
| `createMemoryPackSource(map: Map<string, Uint8Array>)` | Tests, builders. |
| `createFsPackSource(dir: string)` | Node — local pack directory. Used by `tools/region-pack`. |
| `createFetchPackSource(baseUrl: string)` | Browser — pack served over HTTP from `/region-packs/<id>/`. |

Zip-archive sources (`createZipPackSource`) are deliberately deferred to the over-the-air update story; the in-bundle pack ships unzipped under `/public/region-packs/`.

---

## 7. Versioning

Two version axes:

- **`manifest_version`** — the format version of `pack.json` itself. `1` for MVP. Bumped only on incompatible structural changes to `pack.json`.
- **`schema_version`** — the SQL schema version. `1` for MVP. Bumped on any change that breaks SELECTs the loader or runtime issues. **Additive changes (new tables, new nullable columns, new indexes) do NOT bump schema_version** — readers tolerate them.

`pack_version` is *not* a format axis — it's a SemVer string for content edits within a `(pack_id)` lifetime.

A loader rejects packs whose `manifest_version` or `schema_version` exceeds what it knows about. Older packs may be loadable by a newer runtime (bd-spec follow-up: define a forward-compat policy when `schema_version 2` lands).

---

## 8. Build pipeline

The Node-side builder (`engine/region-pack/builder.ts`) takes a `RegionPackInput` (typed) and emits the SQLite bytes plus the asset map. Used by:

- The `tools/region-pack` ingestion script (bd-spec.2) that consumes iNaturalist + GBIF + a curation CSV and writes the pack directory to disk.
- Tests that build synthetic packs in-memory.

The builder uses `sql.js` (pure WASM SQLite) so it runs in Node, in vitest, and in a browser-side pack authoring tool if we ever need one. Runtime queries against an *already loaded* pack go through `sqlocal` per the storage layer (no `sql.js` at runtime).

---

## 9. Validator hooks

`bd-auth.2` (scenario validator) gains an optional `--region-pack <path>` flag that runs:

- Schema-version sanity (`pack_meta.schema_version` matches `pack.json`).
- Stats consistency (`stats.taxa_count` matches `SELECT COUNT(*) FROM taxa`).
- Asset coverage: every row in `photos_manifest` / `audio_manifest` has a corresponding file under `assets/`.
- License audit: every row has a non-empty `license` and `attribution`.
- Orphan detection: every file under `assets/` has a manifest row (warning, not error).

These checks ship in `engine/region-pack/validate.ts` and are reused by the validator CLI and the build tool.

---

## 10. Open questions deferred to follow-ups

- **Over-the-air pack updates.** The format supports it (pack_version is SemVer; loader is idempotent), but the *delivery* and *signing* story is post-MVP.
- **Localization beyond `common_names.language`.** Photo captions and audio descriptions are not currently localized. Add when v1.1 ships non-English content.
- **Per-asset checksums.** Adding `sha256 TEXT` columns to the manifest tables is additive (no schema_version bump) but no consumer needs it yet.
- **R*Tree spatial index.** A future schema version may add it if "find taxa within polygon" or "nearest-N taxa" become hot queries. Not needed for the MVP geo lookup.
