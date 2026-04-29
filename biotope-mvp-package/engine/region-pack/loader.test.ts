import { describe, expect, it } from 'vitest';
import {
  buildRegionPack,
  createMemoryPackSource,
  findTaxaNear,
  getCommonName,
  listAudio,
  listPhotos,
  loadRegionPack,
  lookupByCommonName,
  REGION_PACK_SCHEMA_VERSION,
  resolveAssetPath,
  unloadRegionPack,
  type AudioInput,
  type PhotoInput,
  type RegionPackInput,
  type TaxonInput,
} from './index';
import { createInMemoryStorage } from './test-helpers';

/**
 * Build a synthetic LA-area pack matching the bd-spec.1 acceptance shape:
 * 100 taxa (90 birds + 10 plants for variety), 3 photos per taxon (= 300),
 * and 30 audio calls split across 10 of the birds (3 each).
 *
 * Occurrences are sprinkled across the LA bbox so findTaxaNear has real
 * (cell_lat, cell_lon) data to chew on.
 */
function buildSyntheticInput(): RegionPackInput {
  const taxa: TaxonInput[] = [];
  const audioBirdsCount = 10;

  for (let i = 0; i < 100; i++) {
    const isBird = i < 90;
    const id = i + 1;
    const photos: PhotoInput[] = Array.from({ length: 3 }, (_, k) => {
      const bytes = new TextEncoder().encode(`photo-${id}-${k}`);
      return {
        path: `photos/${id}/${String(k + 1).padStart(3, '0')}.webp`,
        width: 800,
        height: 600,
        byte_size: bytes.byteLength,
        attribution: `Photo by Author ${id} (CC-BY-4.0)`,
        license: 'CC-BY-4.0',
        source_url: `https://www.inaturalist.org/observations/${1000 + id}`,
        bytes,
      };
    });
    const audio: AudioInput[] =
      isBird && i < audioBirdsCount
        ? Array.from({ length: 3 }, (_, k) => {
            const bytes = new TextEncoder().encode(`audio-${id}-${k}`);
            return {
              path: `audio/${id}/${String(k + 1).padStart(3, '0')}.ogg`,
              duration_ms: 4500,
              byte_size: bytes.byteLength,
              kind: 'call' as const,
              attribution: `Audio by Recordist ${id} (CC-BY-4.0)`,
              license: 'CC-BY-4.0',
              source_url: null,
              bytes,
            };
          })
        : [];
    // Spread occurrences across the LA bbox: 33.7..34.4 N, -118.7..-117.6 E.
    // Each taxon gets 4–8 cell hits to make the index do work.
    const occCount = 4 + (i % 5);
    const occurrences = Array.from({ length: occCount }, (_, k) => ({
      lat: 33.7 + ((i * 7 + k * 11) % 70) / 100,
      lon: -118.7 + ((i * 13 + k * 17) % 110) / 100,
      observation_count: 1 + ((i + k) % 20),
    }));

    taxa.push({
      id,
      scientific_name: isBird
        ? `Birdus speciesnumber${id}`
        : `Plantus speciesnumber${id}`,
      rank: 'species',
      kingdom: isBird ? 'Animalia' : 'Plantae',
      class: isBird ? 'Aves' : null,
      inat_taxon_id: 50000 + id,
      gbif_taxon_id: null,
      source: 'inat',
      common_names: [
        { language: 'en', name: `Common Name ${id}`, is_primary: true },
        { language: 'es', name: `Nombre Común ${id}`, is_primary: true },
      ],
      photos,
      audio,
      occurrences,
    });
  }

  return {
    meta: {
      pack_id: 'la-greater-test-v1',
      pack_version: '1.0.0',
      title: 'Greater LA — synthetic test pack',
      license: 'CC-BY-4.0',
      generated_at: '2026-04-28T00:00:00Z',
      region: {
        name: 'Greater Los Angeles',
        bbox: { w: -118.7, s: 33.7, e: -117.6, n: 34.4 },
      },
    },
    taxa,
  };
}

describe('region pack — round trip', () => {
  it('builds a 100-taxon pack with 300 photos + 30 audio and loads it', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    expect(built.meta.stats.taxa_count).toBe(100);
    expect(built.meta.stats.photos_count).toBe(300);
    expect(built.meta.stats.audio_count).toBe(30);
    expect(built.meta.schema_version).toBe(REGION_PACK_SCHEMA_VERSION);

    const storage = await createInMemoryStorage();
    const source = createMemoryPackSource(built.files);
    const loaded = await loadRegionPack(source, storage);

    expect(loaded.taxaCount).toBe(100);
    expect(loaded.photoCount).toBe(300);
    expect(loaded.audioCount).toBe(30);

    // Every photo and audio file ended up in BlobStore under the pack-scoped prefix.
    const blobPaths = await storage.blobs.list('region-packs/la-greater-test-v1');
    expect(blobPaths.length).toBe(330);
    const samplePath = resolveAssetPath('la-greater-test-v1', 'photos/1/001.webp');
    const got = await storage.blobs.get(samplePath);
    expect(got).toBeInstanceOf(Blob);

    await storage.close();
  });

  it('answers find-taxa-near queries in <50 ms (acceptance bar)', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    const storage = await createInMemoryStorage();
    await loadRegionPack(createMemoryPackSource(built.files), storage);

    // Warm-up — first query in any sqlite engine is JIT-cold.
    await findTaxaNear(storage.species, 34.05, -118.25);

    const ITERATIONS = 10;
    const samples: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = performance.now();
      const rows = await findTaxaNear(storage.species, 34.05, -118.25, {
        radiusKm: 5,
      });
      samples.push(performance.now() - t0);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]!.observation_count).toBeGreaterThan(0);
    }
    const max = Math.max(...samples);
    // The acceptance bar is 50ms on tablet-class hardware. In Node this should
    // be well under that — flag a regression if we ever exceed 50ms here.
    expect(max).toBeLessThan(50);

    await storage.close();
  });
});

describe('region pack — query helpers', () => {
  it('resolves common names by language with primary preference', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    const storage = await createInMemoryStorage();
    await loadRegionPack(createMemoryPackSource(built.files), storage);

    expect(await getCommonName(storage.species, 1, 'en')).toBe('Common Name 1');
    expect(await getCommonName(storage.species, 1, 'es')).toBe('Nombre Común 1');
    expect(await getCommonName(storage.species, 1, 'fr')).toBeUndefined();

    await storage.close();
  });

  it('looks up taxa by partial common name', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    const storage = await createInMemoryStorage();
    await loadRegionPack(createMemoryPackSource(built.files), storage);

    const matches = await lookupByCommonName(storage.species, 'Common Name 5', 'en', 5);
    // 'Common Name 5' matches 'Common Name 5', 'Common Name 50'..'Common Name 59'.
    expect(matches.length).toBe(5);
    expect(matches[0]!.scientific_name).toMatch(/speciesnumber/);

    await storage.close();
  });

  it('lists photos and audio per taxon in stable order', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    const storage = await createInMemoryStorage();
    await loadRegionPack(createMemoryPackSource(built.files), storage);

    const photos = await listPhotos(storage.species, 1);
    expect(photos.map((p) => p.path)).toEqual([
      'photos/1/001.webp',
      'photos/1/002.webp',
      'photos/1/003.webp',
    ]);
    expect(photos[0]!.license).toBe('CC-BY-4.0');

    const audio = await listAudio(storage.species, 1);
    expect(audio.length).toBe(3);
    expect(audio[0]!.kind).toBe('call');

    // Plants (id >= 91) have no audio.
    expect((await listAudio(storage.species, 95)).length).toBe(0);

    await storage.close();
  });

  it('classFilter narrows findTaxaNear to a class', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    const storage = await createInMemoryStorage();
    await loadRegionPack(createMemoryPackSource(built.files), storage);

    const aves = await findTaxaNear(storage.species, 34.05, -118.25, {
      classFilter: 'Aves',
      radiusKm: 50,
    });
    expect(aves.length).toBeGreaterThan(0);
    for (const r of aves) expect(r.class).toBe('Aves');

    await storage.close();
  });
});

describe('region pack — error paths', () => {
  it('rejects unsupported manifest_version', async () => {
    const storage = await createInMemoryStorage();
    const source = createMemoryPackSource(
      new Map([
        [
          'pack.json',
          new TextEncoder().encode(
            JSON.stringify({
              manifest_version: 99,
              pack_id: 'x',
              pack_version: '1.0.0',
              schema_version: 1,
              title: 't',
              license: 'CC-BY-4.0',
              generated_at: '2026-04-28T00:00:00Z',
              region: {
                name: 'r',
                bbox: { w: 0, s: 0, e: 1, n: 1 },
              },
              stats: { taxa_count: 0, photos_count: 0, audio_count: 0, byte_size_total: 0 },
            }),
          ),
        ],
      ]),
    );
    await expect(loadRegionPack(source, storage)).rejects.toThrow(/manifest_version/);
    await storage.close();
  });

  it('rejects pack_id mismatch between pack.json and data.sqlite', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    // Forge: rewrite pack.json to claim a different pack_id, leave data.sqlite alone.
    const tampered = new Map(built.files);
    const meta = JSON.parse(new TextDecoder().decode(built.files.get('pack.json')!));
    meta.pack_id = 'la-greater-test-v2';
    tampered.set('pack.json', new TextEncoder().encode(JSON.stringify(meta)));

    const storage = await createInMemoryStorage();
    await expect(
      loadRegionPack(createMemoryPackSource(tampered), storage),
    ).rejects.toThrow(/pack_id/);
    await storage.close();
  });

  it('rejects malformed pack.json', async () => {
    const storage = await createInMemoryStorage();
    const source = createMemoryPackSource(
      new Map([['pack.json', new TextEncoder().encode('not json')]]),
    );
    await expect(loadRegionPack(source, storage)).rejects.toThrow(/JSON/);
    await storage.close();
  });

  it('rejects builder input with duplicate taxon ids', async () => {
    const input = buildSyntheticInput();
    const dupTaxa: TaxonInput[] = [...input.taxa, { ...input.taxa[0]! }];
    await expect(buildRegionPack({ ...input, taxa: dupTaxa })).rejects.toThrow(/duplicate/);
  });

  it('rejects builder input with mismatched photo byte_size', async () => {
    const input = buildSyntheticInput();
    const bad: TaxonInput = {
      ...input.taxa[0]!,
      photos: [
        {
          ...input.taxa[0]!.photos[0]!,
          byte_size: 99999,
        },
      ],
    };
    await expect(
      buildRegionPack({ ...input, taxa: [bad, ...input.taxa.slice(1)] }),
    ).rejects.toThrow(/byte_size/);
  });
});

describe('region pack — unload', () => {
  it('clears blob storage for the pack on unload', async () => {
    const built = await buildRegionPack(buildSyntheticInput());
    const storage = await createInMemoryStorage();
    await loadRegionPack(createMemoryPackSource(built.files), storage);

    expect((await storage.blobs.list('region-packs/la-greater-test-v1')).length).toBe(330);
    await unloadRegionPack('la-greater-test-v1', storage);
    expect((await storage.blobs.list('region-packs/la-greater-test-v1')).length).toBe(0);

    await storage.close();
  });
});
