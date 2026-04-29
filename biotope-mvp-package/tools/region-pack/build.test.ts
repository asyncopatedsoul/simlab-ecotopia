import { mkdtempSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createFsPackSource,
  findTaxaNear,
  loadRegionPack,
} from '@engine/region-pack';
import { createInMemoryStorage } from '@engine/region-pack/test-helpers';
import { runBuild } from './build';
import { parseCurationCsv, reportScenarioCoverage } from './curation';
import { validatePackDir } from './validate';

const SAMPLE_CSV = `id,scientific_name,rank,kingdom,class,common_name_en,common_name_es,inat_taxon_id,gbif_taxon_id,scenarios,notes
1,Turdus migratorius,species,Animalia,Aves,American Robin,Petirrojo,,,window-watch,Common
2,Quercus agrifolia,species,Plantae,,Coast Live Oak,Encino,,,leaf-detective,
3,Procyon lotor,species,Animalia,Mammalia,Raccoon,Mapache,,,whose-tracks,Nocturnal
`;

const SAMPLE_META = {
  pack_id: 'test-pack-v1',
  pack_version: '0.1.0',
  title: 'Test Pack',
  license: 'CC-BY-4.0',
  region: {
    name: 'Test Region',
    bbox: { w: -118.7, s: 33.7, e: -117.6, n: 34.4 },
  },
};

describe('curation parser', () => {
  it('parses a well-formed CSV', () => {
    const rows = parseCurationCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.scientific_name).toBe('Turdus migratorius');
    expect(rows[0]!.scenarios).toEqual(['window-watch']);
    expect(rows[1]!.class).toBeNull();
    expect(rows[1]!.common_name_es).toBe('Encino');
  });

  it('rejects duplicate ids', () => {
    const dup = SAMPLE_CSV + '1,Foo bar,species,Animalia,Aves,Foo,,,,,\n';
    expect(() => parseCurationCsv(dup)).toThrow(/duplicate id/);
  });

  it('rejects rows with wrong column count', () => {
    const bad = SAMPLE_CSV + 'oops\n';
    expect(() => parseCurationCsv(bad)).toThrow(/expected 11 columns/);
  });

  it('reports scenario coverage', () => {
    const cov = reportScenarioCoverage(parseCurationCsv(SAMPLE_CSV));
    expect(cov.scenarioCounts.get('window-watch')).toBe(1);
    expect(cov.scenarioCounts.get('whose-tracks')).toBe(1);
    expect(cov.unscoped).toHaveLength(0);
  });

  it('handles RFC-4180 quoted cells with embedded commas', () => {
    const csv = `id,scientific_name,rank,kingdom,class,common_name_en,common_name_es,inat_taxon_id,gbif_taxon_id,scenarios,notes
1,"Genus species","species","Animalia","Aves","Bird, Common","",,,window-watch,"Note with, comma"
`;
    const rows = parseCurationCsv(csv);
    expect(rows[0]!.common_name_en).toBe('Bird, Common');
    expect(rows[0]!.notes).toBe('Note with, comma');
  });
});

describe('region-pack build CLI', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'region-pack-build-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('builds a pack from curation + meta in stub mode', async () => {
    const curationPath = join(tmp, 'curation.csv');
    const metaPath = join(tmp, 'meta.json');
    const outDir = join(tmp, 'out');
    writeFileSync(curationPath, SAMPLE_CSV);
    writeFileSync(metaPath, JSON.stringify(SAMPLE_META));

    await runBuild({
      curation: curationPath,
      meta: metaPath,
      out: outDir,
      budgetMb: 50,
    });

    const packDir = join(outDir, 'test-pack-v1.biotope-region');
    expect(statSync(join(packDir, 'pack.json')).isFile()).toBe(true);
    expect(statSync(join(packDir, 'data.sqlite')).isFile()).toBe(true);
    expect(statSync(join(packDir, 'schema.sql')).isFile()).toBe(true);
    // 3 taxa × 3 photos = 9 stub photos.
    expect(statSync(join(packDir, 'assets/photos/1/001.webp')).isFile()).toBe(true);
    expect(statSync(join(packDir, 'assets/photos/3/003.webp')).isFile()).toBe(true);
  });

  it('built pack passes validatePackDir', async () => {
    const curationPath = join(tmp, 'curation.csv');
    const metaPath = join(tmp, 'meta.json');
    const outDir = join(tmp, 'out');
    writeFileSync(curationPath, SAMPLE_CSV);
    writeFileSync(metaPath, JSON.stringify(SAMPLE_META));
    await runBuild({
      curation: curationPath,
      meta: metaPath,
      out: outDir,
      budgetMb: 50,
    });

    const report = await validatePackDir(join(outDir, 'test-pack-v1.biotope-region'));
    expect(report.ok).toBe(true);
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('built pack round-trips through loadRegionPack', async () => {
    const curationPath = join(tmp, 'curation.csv');
    const metaPath = join(tmp, 'meta.json');
    const outDir = join(tmp, 'out');
    writeFileSync(curationPath, SAMPLE_CSV);
    writeFileSync(metaPath, JSON.stringify(SAMPLE_META));
    await runBuild({
      curation: curationPath,
      meta: metaPath,
      out: outDir,
      budgetMb: 50,
    });

    const storage = await createInMemoryStorage();
    const source = await createFsPackSource(join(outDir, 'test-pack-v1.biotope-region'));
    const loaded = await loadRegionPack(source, storage);
    expect(loaded.taxaCount).toBe(3);
    expect(loaded.photoCount).toBe(9);

    // Synthesized occurrences should put every taxon somewhere in the bbox.
    const near = await findTaxaNear(storage.species, 34.0, -118.2, { radiusKm: 100 });
    expect(near.length).toBeGreaterThan(0);

    await storage.close();
  });

  it('hard-fails on budget overflow', async () => {
    const curationPath = join(tmp, 'curation.csv');
    const metaPath = join(tmp, 'meta.json');
    const outDir = join(tmp, 'out');
    writeFileSync(curationPath, SAMPLE_CSV);
    writeFileSync(metaPath, JSON.stringify(SAMPLE_META));
    await expect(
      runBuild({
        curation: curationPath,
        meta: metaPath,
        out: outDir,
        budgetMb: 0.001, // 1 KB — guaranteed to fail
      }),
    ).rejects.toThrow(/budget/);
  });

  it('uses --photos directory when provided', async () => {
    // Drop one fake webp and verify the build picks it up instead of stub.
    const photosDir = join(tmp, 'photos');
    mkdirSync(join(photosDir, '1'), { recursive: true });
    mkdirSync(join(photosDir, '2'), { recursive: true });
    mkdirSync(join(photosDir, '3'), { recursive: true });
    writeFileSync(join(photosDir, '1', '001.webp'), Buffer.from([1, 2, 3, 4]));
    writeFileSync(join(photosDir, '2', '001.webp'), Buffer.from([5, 6]));
    writeFileSync(join(photosDir, '3', '001.webp'), Buffer.from([7, 8, 9]));

    const curationPath = join(tmp, 'curation.csv');
    const metaPath = join(tmp, 'meta.json');
    const outDir = join(tmp, 'out');
    writeFileSync(curationPath, SAMPLE_CSV);
    writeFileSync(metaPath, JSON.stringify(SAMPLE_META));
    await runBuild({
      curation: curationPath,
      meta: metaPath,
      out: outDir,
      photos: photosDir,
      budgetMb: 50,
    });

    const packDir = join(outDir, 'test-pack-v1.biotope-region');
    const f = statSync(join(packDir, 'assets/photos/1/001.webp'));
    expect(f.size).toBe(4);
  });
});

describe('la-greater-v1 dev pack (built artifact)', () => {
  it('exists and passes validation', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const repo = join(here, '..', '..');
    const packDir = join(
      repo,
      'content/region-packs/la-greater-v1/built/la-greater-v1.biotope-region',
    );
    let exists = false;
    try {
      exists = statSync(join(packDir, 'pack.json')).isFile();
    } catch {
      // Pack not built yet — skip rather than fail. Run `npm run region-pack:build`.
    }
    if (!exists) {
      console.warn(
        'la-greater-v1 pack not built; skipping. Run `npm run region-pack:build`.',
      );
      return;
    }
    const report = await validatePackDir(packDir);
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(report.ok).toBe(true);
    // bd-spec.2 acceptance: <50 MB.
    expect(report.totalBytes).toBeLessThan(50 * 1024 * 1024);
  });
});
