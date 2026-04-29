import type { SpeciesDB } from '../storage/types';
import { OCCURRENCE_CELL_DEGREES } from './schema';
import type {
  AudioEntry,
  CommonName,
  PhotoEntry,
  TaxaNearResult,
  Taxon,
} from './types';

/**
 * Runtime queries against a loaded region pack. Every function takes the
 * `SpeciesDB` from the storage facade — no hidden global. Keeps tests trivial
 * and lets us swap the backing DB (sqlocal in browser, sql.js in tests).
 */

export type FindTaxaNearOptions = {
  /** Search radius in km. Default 5. */
  radiusKm?: number;
  /** Max results. Default 50. */
  limit?: number;
  /** Optional kingdom or class filter, e.g. 'Aves'. */
  classFilter?: string;
};

/**
 * "What taxa are common near (lat, lon)?" The query the bd-spec.1 acceptance
 * bar (<50 ms on tablet-class) is measured against.
 *
 * Implementation: bucket the (lat, lon) point to a 0.1° grid cell, expand
 * the search to all cells overlapping the radius, hit the
 * (cell_lat, cell_lon) index, and roll up observation counts per taxon.
 */
export async function findTaxaNear(
  species: SpeciesDB,
  lat: number,
  lon: number,
  options: FindTaxaNearOptions = {},
): Promise<TaxaNearResult[]> {
  const radiusKm = options.radiusKm ?? 5;
  const limit = options.limit ?? 50;

  // 1° latitude ≈ 110.574 km. 1° longitude ≈ 111.320 * cos(lat) km.
  // Add a small safety so radius=5 km hits the cell containing the point even
  // when the point sits near a cell edge.
  const dLat = radiusKm / 110.574 + OCCURRENCE_CELL_DEGREES;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const dLon = radiusKm / (111.32 * cosLat) + OCCURRENCE_CELL_DEGREES;

  const cellLatMin = Math.floor((lat - dLat) / OCCURRENCE_CELL_DEGREES);
  const cellLatMax = Math.floor((lat + dLat) / OCCURRENCE_CELL_DEGREES);
  const cellLonMin = Math.floor((lon - dLon) / OCCURRENCE_CELL_DEGREES);
  const cellLonMax = Math.floor((lon + dLon) / OCCURRENCE_CELL_DEGREES);

  const filter = options.classFilter ? 'AND t.class = ?' : '';
  const params: (string | number)[] = [
    cellLatMin,
    cellLatMax,
    cellLonMin,
    cellLonMax,
  ];
  if (options.classFilter) params.push(options.classFilter);
  params.push(limit);

  return species.query<TaxaNearResult>(
    `
    SELECT
      t.id,
      t.scientific_name,
      t.class,
      SUM(o.observation_count) AS observation_count
    FROM occurrences_summary o
    JOIN taxa t ON t.id = o.taxon_id
    WHERE o.cell_lat BETWEEN ? AND ?
      AND o.cell_lon BETWEEN ? AND ?
      ${filter}
    GROUP BY t.id
    ORDER BY observation_count DESC, t.id ASC
    LIMIT ?
    `,
    params,
  );
}

export async function getTaxon(species: SpeciesDB, id: number): Promise<Taxon | undefined> {
  const rows = await species.query<Taxon>('SELECT * FROM taxa WHERE id = ?', [id]);
  return rows[0];
}

/**
 * Resolve the common name for a taxon. Prefers the `is_primary=1` row in the
 * requested language; falls back to any row in that language; returns
 * `undefined` if no localization exists.
 */
export async function getCommonName(
  species: SpeciesDB,
  taxonId: number,
  language: string,
): Promise<string | undefined> {
  const rows = await species.query<CommonName>(
    `SELECT * FROM common_names WHERE taxon_id = ? AND language = ?
     ORDER BY is_primary DESC, name ASC LIMIT 1`,
    [taxonId, language],
  );
  return rows[0]?.name;
}

/**
 * Reverse lookup: find taxa by partial common name. Used by the
 * "self-report ID" picker in the field activity (bd-flda.5).
 */
export async function lookupByCommonName(
  species: SpeciesDB,
  partial: string,
  language: string,
  limit = 25,
): Promise<Taxon[]> {
  return species.query<Taxon>(
    `SELECT t.* FROM taxa t
     JOIN common_names cn ON cn.taxon_id = t.id
     WHERE cn.language = ? AND cn.name LIKE ?
     GROUP BY t.id
     ORDER BY t.scientific_name ASC
     LIMIT ?`,
    [language, `%${partial}%`, limit],
  );
}

export async function listPhotos(species: SpeciesDB, taxonId: number): Promise<PhotoEntry[]> {
  return species.query<PhotoEntry>(
    'SELECT * FROM photos_manifest WHERE taxon_id = ? ORDER BY path ASC',
    [taxonId],
  );
}

export async function listAudio(species: SpeciesDB, taxonId: number): Promise<AudioEntry[]> {
  return species.query<AudioEntry>(
    'SELECT * FROM audio_manifest WHERE taxon_id = ? ORDER BY path ASC',
    [taxonId],
  );
}

/** Translate a manifest-relative path to the BlobStore key for a given pack. */
export function resolveAssetPath(packId: string, manifestPath: string): string {
  return `region-packs/${packId}/${manifestPath}`;
}
