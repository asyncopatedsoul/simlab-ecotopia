/**
 * Region pack SQL schema, version 1.
 *
 * Contract: `docs/region-pack-format.md`. Additive changes (new tables, new
 * nullable columns, new indexes) DO NOT bump REGION_PACK_SCHEMA_VERSION.
 * Anything that breaks reads from a prior schema version requires a bump and
 * a migration plan.
 *
 * Both the runtime loader and the Node-side builder apply this DDL via the
 * same `REGION_PACK_SCHEMA_SQL` string — keeping a single source avoids
 * doc/code drift on the table layout.
 */

export const REGION_PACK_SCHEMA_VERSION = 1;

export const REGION_PACK_SCHEMA_SQL = `
PRAGMA user_version = 1;
PRAGMA foreign_keys = ON;

CREATE TABLE pack_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE taxa (
  id              INTEGER PRIMARY KEY,
  scientific_name TEXT NOT NULL,
  rank            TEXT NOT NULL,
  kingdom         TEXT NOT NULL,
  class           TEXT,
  inat_taxon_id   INTEGER,
  gbif_taxon_id   INTEGER,
  source          TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_taxa_inat ON taxa(inat_taxon_id) WHERE inat_taxon_id IS NOT NULL;
CREATE INDEX idx_taxa_class ON taxa(class);

CREATE TABLE common_names (
  taxon_id   INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  language   TEXT NOT NULL,
  name       TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (taxon_id, language, name)
);
CREATE INDEX idx_common_names_lang_name ON common_names(language, name);

CREATE TABLE photos_manifest (
  taxon_id    INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  byte_size   INTEGER NOT NULL,
  attribution TEXT NOT NULL,
  license     TEXT NOT NULL,
  source_url  TEXT,
  PRIMARY KEY (taxon_id, path)
);

CREATE TABLE audio_manifest (
  taxon_id    INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  byte_size   INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  attribution TEXT NOT NULL,
  license     TEXT NOT NULL,
  source_url  TEXT,
  PRIMARY KEY (taxon_id, path)
);

CREATE TABLE occurrences_summary (
  taxon_id          INTEGER NOT NULL REFERENCES taxa(id) ON DELETE CASCADE,
  cell_lat          INTEGER NOT NULL,
  cell_lon          INTEGER NOT NULL,
  observation_count INTEGER NOT NULL,
  PRIMARY KEY (taxon_id, cell_lat, cell_lon)
);
CREATE INDEX idx_occ_cell ON occurrences_summary(cell_lat, cell_lon);
`.trim();

/**
 * 0.1° grid cells. ~11 km at the equator, ~9 km at LA's latitude.
 * Used for both indexing and the geo query's bounding-box arithmetic.
 */
export const OCCURRENCE_CELL_DEGREES = 0.1;

export function latToCell(lat: number): number {
  return Math.floor(lat / OCCURRENCE_CELL_DEGREES);
}

export function lonToCell(lon: number): number {
  return Math.floor(lon / OCCURRENCE_CELL_DEGREES);
}
