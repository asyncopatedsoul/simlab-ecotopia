/**
 * Region pack build CLI (bd-spec.2).
 *
 * Usage:
 *   tsx tools/region-pack/build.ts \
 *     --curation content/region-packs/la-greater-v1/curation.csv \
 *     --meta     content/region-packs/la-greater-v1/meta.json \
 *     --out      content/region-packs/la-greater-v1/dist
 *
 * Optional inputs (deferred to bd-spec.2b — real-data ingest):
 *   --inat     <jsonl>   iNaturalist research-grade observations (one obs per line)
 *   --gbif     <dir>     GBIF Darwin Core Archive (extracted)
 *   --photos   <dir>     Pre-downloaded photos: <dir>/<taxon_id>/NNN.webp
 *   --audio    <dir>     Pre-downloaded audio: <dir>/<taxon_id>/NNN.ogg
 *
 * If neither --photos nor real iNat data is supplied, the build falls back
 * to stub photos (sharp-generated 64×64 webps). Stub mode is the default for
 * the dev pack and is loud about it: every stub asset's attribution carries
 * "Stub placeholder (dev build)".
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRegionPack,
  writePackToFs,
  type OccurrenceInput,
  type PhotoInput,
  type RegionPackInput,
  type TaxonInput,
} from '@engine/region-pack';
import { parseCurationCsv, reportScenarioCoverage, type CurationRow } from './curation';
import { generateStubPhotos } from './stubs';
import { validatePackDir } from './validate';

type CliArgs = {
  curation: string;
  meta: string;
  out: string;
  inat?: string;
  gbif?: string;
  photos?: string;
  audio?: string;
  /** Hard fail if budget exceeded. Default 50 MB per bd-spec.2 acceptance. */
  budgetMb: number;
};

type MetaFile = {
  pack_id: string;
  pack_version: string;
  title: string;
  license: string;
  region: {
    name: string;
    bbox: { w: number; s: number; e: number; n: number };
  };
};

const DEFAULT_BUDGET_MB = 50;

function parseArgs(argv: string[]): CliArgs {
  const out: Partial<CliArgs> = { budgetMb: DEFAULT_BUDGET_MB };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      return v;
    };
    switch (a) {
      case '--curation':
        out.curation = next();
        break;
      case '--meta':
        out.meta = next();
        break;
      case '--out':
        out.out = next();
        break;
      case '--inat':
        out.inat = next();
        break;
      case '--gbif':
        out.gbif = next();
        break;
      case '--photos':
        out.photos = next();
        break;
      case '--audio':
        out.audio = next();
        break;
      case '--budget-mb':
        out.budgetMb = Number(next());
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`unknown argument: ${a}`);
    }
  }
  if (!out.curation || !out.meta || !out.out) {
    printHelp();
    throw new Error('--curation, --meta, and --out are required');
  }
  return out as CliArgs;
}

function printHelp(): void {
  process.stderr.write(
    [
      'tsx tools/region-pack/build.ts',
      '  --curation <csv>   curation CSV (required)',
      '  --meta     <json>  pack metadata (required)',
      '  --out      <dir>   output pack directory (required)',
      '  --inat     <jsonl> iNat observations export (optional; bd-spec.2b)',
      '  --gbif     <dir>   GBIF DwC-A directory (optional; bd-spec.2b)',
      '  --photos   <dir>   pre-downloaded photos (optional; stub mode if absent)',
      '  --audio    <dir>   pre-downloaded audio (optional; no audio if absent)',
      '  --budget-mb <n>    hard size budget (default 50)',
      '',
    ].join('\n'),
  );
}

export async function runBuild(args: CliArgs): Promise<void> {
  const log = (s: string): void => {
    process.stdout.write(s + '\n');
  };

  log(`region-pack build`);
  log(`  curation: ${args.curation}`);
  log(`  meta:     ${args.meta}`);
  log(`  out:      ${args.out}`);
  if (args.inat) log(`  inat:     ${args.inat}`);
  if (args.gbif) log(`  gbif:     ${args.gbif}`);
  log(`  photos:   ${args.photos ?? '(stub mode)'}`);
  log(`  audio:    ${args.audio ?? '(none)'}`);
  log(`  budget:   ${args.budgetMb} MB`);
  log('');

  if (args.inat || args.gbif) {
    log(
      'WARNING: --inat / --gbif ingest is not yet implemented (deferred to bd-spec.2b). Inputs are ignored.',
    );
  }

  const curationText = await readFile(args.curation, 'utf8');
  const rows = parseCurationCsv(curationText);
  log(`curation rows: ${rows.length}`);

  const coverage = reportScenarioCoverage(rows);
  for (const [scenario, n] of [...coverage.scenarioCounts.entries()].sort()) {
    log(`  scenario "${scenario}": ${n} taxa`);
  }
  if (coverage.unscoped.length > 0) {
    log(`  unscoped: ${coverage.unscoped.length} taxa (no scenario tag)`);
  }

  const metaText = await readFile(args.meta, 'utf8');
  const metaFile = JSON.parse(metaText) as MetaFile;

  const taxa = await Promise.all(
    rows.map((r) => buildTaxonInput(r, metaFile.region.bbox, args.photos)),
  );

  const input: RegionPackInput = {
    meta: {
      pack_id: metaFile.pack_id,
      pack_version: metaFile.pack_version,
      title: metaFile.title,
      license: metaFile.license,
      region: metaFile.region,
    },
    taxa,
  };

  const built = await buildRegionPack(input);
  log('');
  log(`built pack: taxa=${built.meta.stats.taxa_count} photos=${built.meta.stats.photos_count} audio=${built.meta.stats.audio_count}`);
  log(`           bytes (db + assets): ${built.meta.stats.byte_size_total.toLocaleString()}`);

  const outDir = resolve(args.out, `${built.meta.pack_id}.biotope-region`);
  await writePackToFs(built, outDir);
  log(`wrote: ${outDir}`);

  log('');
  log('validating...');
  const report = await validatePackDir(outDir);
  for (const issue of report.issues) {
    log(`  ${issue.severity.toUpperCase()} [${issue.code}] ${issue.message}`);
  }
  log(`total bytes (incl. metadata files): ${report.totalBytes.toLocaleString()}`);

  const budgetBytes = args.budgetMb * 1024 * 1024;
  if (report.totalBytes > budgetBytes) {
    throw new Error(
      `pack exceeds ${args.budgetMb} MB budget: ${(report.totalBytes / 1024 / 1024).toFixed(2)} MB`,
    );
  }
  if (!report.ok) {
    throw new Error('pack failed validation (see errors above)');
  }
  log('OK');
}

async function buildTaxonInput(
  row: CurationRow,
  bbox: { w: number; s: number; e: number; n: number },
  photosDir: string | undefined,
): Promise<TaxonInput> {
  const common_names = [
    { language: 'en', name: row.common_name_en, is_primary: true },
    ...(row.common_name_es
      ? [{ language: 'es', name: row.common_name_es, is_primary: true }]
      : []),
  ];

  const photos = photosDir
    ? await loadPhotosFromDir(row.id, photosDir)
    : await generateStubPhotos({ taxonId: row.id });

  const occurrences: OccurrenceInput[] = synthesizeOccurrences(row.id, bbox);

  return {
    id: row.id,
    scientific_name: row.scientific_name,
    rank: row.rank,
    kingdom: row.kingdom,
    class: row.class,
    inat_taxon_id: row.inat_taxon_id,
    gbif_taxon_id: row.gbif_taxon_id,
    source: row.inat_taxon_id != null ? 'inat' : 'manual',
    common_names,
    photos,
    audio: [],
    occurrences,
  };
}

async function loadPhotosFromDir(
  taxonId: number,
  photosDir: string,
): Promise<PhotoInput[]> {
  const { readdir } = await import('node:fs/promises');
  const dir = join(photosDir, String(taxonId));
  let entries: string[];
  try {
    entries = (await readdir(dir)).filter((n) => n.endsWith('.webp')).sort();
  } catch {
    throw new Error(
      `photos directory missing for taxon ${taxonId}: ${dir}. Drop in NNN.webp files or omit --photos to use stubs.`,
    );
  }
  const out: PhotoInput[] = [];
  for (const name of entries) {
    const buf = await readFile(join(dir, name));
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    // Real photo metadata would come from the iNat ingest in bd-spec.2b. For
    // the photos-dir path we use placeholders; users supplying their own
    // photos should use the iNat ingest path to populate dimensions and
    // attribution properly.
    out.push({
      path: `photos/${taxonId}/${name}`,
      width: 0,
      height: 0,
      byte_size: bytes.byteLength,
      attribution: 'Pre-downloaded photo (CC-BY assumed; verify before ship)',
      license: 'CC-BY-4.0',
      source_url: null,
      bytes,
    });
  }
  if (out.length === 0) {
    throw new Error(`no .webp photos found in ${dir}`);
  }
  return out;
}

/**
 * Synthesize 5 occurrences across the pack's bbox so findTaxaNear has data
 * to return. Deterministic per-taxon. Real iNat occurrences replace these in
 * bd-spec.2b.
 */
function synthesizeOccurrences(
  taxonId: number,
  bbox: { w: number; s: number; e: number; n: number },
): OccurrenceInput[] {
  const out: OccurrenceInput[] = [];
  const latRange = bbox.n - bbox.s;
  const lonRange = bbox.e - bbox.w;
  for (let i = 0; i < 5; i++) {
    out.push({
      lat: bbox.s + ((taxonId * 7 + i * 11) % 100) / 100 * latRange,
      lon: bbox.w + ((taxonId * 13 + i * 17) % 100) / 100 * lonRange,
      observation_count: 1 + ((taxonId + i) % 10),
    });
  }
  return out;
}

// ─── CLI entry point ──────────────────────────────────────────────────

const isMain = (() => {
  try {
    return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  runBuild(parseArgs(process.argv.slice(2))).catch((e) => {
    process.stderr.write(`build failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}

// Re-export for tests + downstream tools.
export { parseArgs };
export type { MetaFile };
