import { z } from 'zod';

/**
 * pack.json schema. Validated on load; rejected on malformed.
 *
 * Contract: `docs/region-pack-format.md` §3.
 */
export const packMetaSchema = z
  .object({
    manifest_version: z.literal(1),
    pack_id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'pack_id must be a lowercase slug'),
    pack_version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:[-+].+)?$/, 'pack_version must be SemVer'),
    schema_version: z.number().int().positive(),
    title: z.string().min(1),
    license: z.string().min(1),
    generated_at: z.string().datetime({ offset: true }),
    region: z
      .object({
        name: z.string().min(1),
        bbox: z
          .object({
            w: z.number().min(-180).max(180),
            s: z.number().min(-90).max(90),
            e: z.number().min(-180).max(180),
            n: z.number().min(-90).max(90),
          })
          .strict()
          .superRefine((b, ctx) => {
            if (b.s > b.n) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'bbox.s must be <= bbox.n',
                path: ['s'],
              });
            }
          }),
      })
      .strict(),
    stats: z
      .object({
        taxa_count: z.number().int().nonnegative(),
        photos_count: z.number().int().nonnegative(),
        audio_count: z.number().int().nonnegative(),
        byte_size_total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type PackMeta = z.infer<typeof packMetaSchema>;

// ─── builder input types ──────────────────────────────────────────────

export type Kingdom = 'Animalia' | 'Plantae' | 'Fungi';
export type TaxonRank = 'species' | 'subspecies' | 'genus';
export type TaxonSource = 'inat' | 'gbif' | 'manual';

export type TaxonInput = {
  id: number;
  scientific_name: string;
  rank: TaxonRank;
  kingdom: Kingdom;
  /** e.g. 'Aves', 'Mammalia'. Null for plants/fungi. */
  class?: string | null;
  inat_taxon_id?: number | null;
  gbif_taxon_id?: number | null;
  source: TaxonSource;
  /** At least one common name per language a scenario will display. */
  common_names: ReadonlyArray<{
    language: string;
    name: string;
    is_primary?: boolean;
  }>;
  photos: ReadonlyArray<PhotoInput>;
  audio: ReadonlyArray<AudioInput>;
  /** Coarse-cell occurrences. Empty array = pack-level only (no geo query hits). */
  occurrences: ReadonlyArray<OccurrenceInput>;
};

export type PhotoInput = {
  /** Relative to assets/. e.g. 'photos/42/001.webp' */
  path: string;
  width: number;
  height: number;
  byte_size: number;
  attribution: string;
  license: string;
  source_url?: string | null;
  /** Raw bytes for the asset; the builder writes them to the asset map. */
  bytes: Uint8Array;
};

export type AudioKind = 'call' | 'song' | 'alarm' | 'flight';

export type AudioInput = {
  path: string;
  duration_ms: number;
  byte_size: number;
  kind: AudioKind;
  attribution: string;
  license: string;
  source_url?: string | null;
  bytes: Uint8Array;
};

export type OccurrenceInput = {
  /** Latitude in WGS-84 degrees. The builder buckets to 0.1° cells. */
  lat: number;
  lon: number;
  observation_count: number;
};

export type RegionPackInput = {
  meta: Omit<PackMeta, 'stats' | 'manifest_version' | 'schema_version'> & {
    /** If omitted, the builder fills in current time. */
    generated_at?: string;
  };
  taxa: ReadonlyArray<TaxonInput>;
};

// ─── loaded-pack runtime types ────────────────────────────────────────

export type LoadedPack = {
  meta: PackMeta;
  taxaCount: number;
  photoCount: number;
  audioCount: number;
  /** Total bytes copied into BlobStore for this pack's assets. */
  bytesCopied: number;
};

export type Taxon = {
  id: number;
  scientific_name: string;
  rank: string;
  kingdom: string;
  class: string | null;
  inat_taxon_id: number | null;
  gbif_taxon_id: number | null;
  source: string;
};

export type CommonName = {
  taxon_id: number;
  language: string;
  name: string;
  is_primary: number;
};

export type PhotoEntry = {
  taxon_id: number;
  path: string;
  width: number;
  height: number;
  byte_size: number;
  attribution: string;
  license: string;
  source_url: string | null;
};

export type AudioEntry = {
  taxon_id: number;
  path: string;
  duration_ms: number;
  byte_size: number;
  kind: string;
  attribution: string;
  license: string;
  source_url: string | null;
};

export type TaxaNearResult = {
  id: number;
  scientific_name: string;
  class: string | null;
  observation_count: number;
};

// ─── error types ──────────────────────────────────────────────────────

export class RegionPackError extends Error {
  override readonly name = 'RegionPackError';
  constructor(
    message: string,
    public readonly code:
      | 'PACK_META_INVALID'
      | 'MANIFEST_VERSION_UNSUPPORTED'
      | 'SCHEMA_VERSION_UNSUPPORTED'
      | 'PACK_META_MISMATCH'
      | 'ASSET_MISSING'
      | 'BUILDER_INVALID_INPUT',
    public override readonly cause?: unknown,
  ) {
    super(message);
  }
}
