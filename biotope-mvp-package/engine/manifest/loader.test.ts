import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ManifestParseError,
  parseManifest,
  stringifyManifest,
  validateManifest,
} from './loader';
import type { Manifest } from './schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, 'fixtures/backyard-bird-hour.yaml');
const fixtureYaml = readFileSync(FIXTURE_PATH, 'utf8');

describe('parseManifest — Backyard Bird Hour fixture', () => {
  it('parses the doc fixture without errors', () => {
    const m = parseManifest(fixtureYaml);
    expect(m.id).toBe('backyard-bird-hour');
    expect(m.manifest_version).toBe(1);
    expect(m.audience.default_rung).toBe('7-8');
  });

  it('preserves all loop phases', () => {
    const m = parseManifest(fixtureYaml);
    expect(m.loop.brief.duration_seconds_target).toBe(60);
    expect(m.loop.sim_episode.interactions[0]?.id).toBe('tap_to_learn');
    expect(m.loop.field_activity.safety.max_distance_from_origin_m['5-6']).toBe(20);
    expect(m.loop.re_encoding.accept).toHaveLength(2);
    expect(m.loop.reflection.unlocks.next_scenario).toBe('whose-tracks');
  });

  it('preserves skill_rung_overrides verbatim (free-form per phase)', () => {
    const m = parseManifest(fixtureYaml);
    expect(m.loop.brief.skill_rung_overrides?.['5-6']).toEqual({
      duration_seconds_target: 30,
      narrative_node: 'brief.start_5_6',
    });
    expect(m.loop.sim_episode.skill_rung_overrides?.['11-12']).toEqual({
      add_call_recognition: true,
      require_predict_before_show: true,
    });
  });

  it('preserves discriminated re_encoding.accept entries', () => {
    const m = parseManifest(fixtureYaml);
    const [photo, selfReported] = m.loop.re_encoding.accept;
    expect(photo).toMatchObject({ kind: 'photo', subject: 'bird', confidence_min: 0.4 });
    expect(selfReported).toMatchObject({ kind: 'self_reported_id', from_species_pack: true });
  });
});

describe('round-trip stability', () => {
  it('YAML: parse → stringify → parse is data-stable', () => {
    const parsed = parseManifest(fixtureYaml);
    const restringified = stringifyManifest(parsed);
    const reparsed = parseManifest(restringified);
    expect(reparsed).toEqual(parsed);
  });

  it('YAML: stringify is idempotent (stringify == stringify∘parse∘stringify)', () => {
    const parsed = parseManifest(fixtureYaml);
    const once = stringifyManifest(parsed);
    const twice = stringifyManifest(parseManifest(once));
    expect(twice).toBe(once);
  });

  it('JSON: byte-stable round-trip', () => {
    const parsed = parseManifest(fixtureYaml);
    const json = stringifyManifest(parsed, { format: 'json' });
    const reparsed = parseManifest(json, { format: 'json' });
    expect(reparsed).toEqual(parsed);
    // JSON output is canonical: stringifying a parsed-from-JSON manifest
    // produces byte-identical output.
    const json2 = stringifyManifest(reparsed, { format: 'json' });
    expect(json2).toBe(json);
  });

  it('top-level keys are emitted in canonical (doc) order', () => {
    const parsed = parseManifest(fixtureYaml);
    const json = stringifyManifest(parsed, { format: 'json' });
    const obj = JSON.parse(json);
    expect(Object.keys(obj)).toEqual([
      'manifest_version',
      'id',
      'title',
      'version',
      'authors',
      'license',
      'language_default',
      'languages_available',
      'audience',
      'locality',
      'estimated_minutes',
      'hardware',
      'permissions_explainer',
      'content',
      'loop',
      'mentor_apprentice',
      'privacy',
      'assets',
    ]);
  });
});

describe('format autodetection', () => {
  it('parses JSON when first non-space char is "{"', () => {
    const parsed = parseManifest(fixtureYaml);
    const json = stringifyManifest(parsed, { format: 'json' });
    expect(parseManifest(json)).toEqual(parsed);
  });
});

describe('validation errors', () => {
  function reject(transform: (m: Manifest) => Manifest, expectPath: string) {
    const m = transform(parseManifest(fixtureYaml));
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === expectPath)).toBe(true);
    }
  }

  it('rejects unknown manifest_version', () => {
    reject(
      (m) => ({ ...m, manifest_version: 2 as unknown as 1 }),
      'manifest_version',
    );
  });

  it('rejects ids that are not lowercase slugs', () => {
    reject((m) => ({ ...m, id: 'Backyard Bird Hour' }), 'id');
  });

  it('rejects non-SemVer versions', () => {
    reject((m) => ({ ...m, version: '1.0' }), 'version');
  });

  it('rejects default_rung not in age_rungs', () => {
    reject(
      (m) => ({
        ...m,
        audience: { ...m.audience, default_rung: '11-12', age_rungs: ['5-6', '7-8'] },
      }),
      'audience.default_rung',
    );
  });

  it('rejects language_default not in languages_available', () => {
    reject((m) => ({ ...m, languages_available: ['fr'] }), 'language_default');
  });

  it('rejects mentor_apprentice mode without the mentor_apprentice block', () => {
    const m = parseManifest(fixtureYaml);
    const broken = { ...m };
    delete (broken as Partial<Manifest>).mentor_apprentice;
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'mentor_apprentice')).toBe(true);
    }
  });

  it('rejects unknown top-level fields (strict)', () => {
    const m = parseManifest(fixtureYaml);
    const withExtra = { ...m, secret_field: 'nope' };
    const result = validateManifest(withExtra);
    expect(result.ok).toBe(false);
  });

  it('parseManifest throws ManifestParseError on bad YAML', () => {
    expect(() => parseManifest(': : : not yaml')).toThrow(ManifestParseError);
  });

  it('parseManifest throws ManifestParseError on schema failure', () => {
    expect(() => parseManifest('manifest_version: 99\n')).toThrow(ManifestParseError);
  });

  it('rejects sim_episode interactions with empty targets', () => {
    const m = parseManifest(fixtureYaml);
    const broken = {
      ...m,
      loop: {
        ...m.loop,
        sim_episode: {
          ...m.loop.sim_episode,
          interactions: [
            { ...m.loop.sim_episode.interactions[0]!, targets_from_species: [] },
          ],
        },
      },
    };
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-range confidence_min', () => {
    const m = parseManifest(fixtureYaml);
    const broken = {
      ...m,
      loop: {
        ...m.loop,
        re_encoding: {
          ...m.loop.re_encoding,
          accept: [
            { kind: 'photo' as const, subject: 'bird', confidence_min: 1.5 },
            ...m.loop.re_encoding.accept.slice(1),
          ],
        },
      },
    };
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
  });
});

describe('error reporting', () => {
  it('returns dotted paths for nested errors', () => {
    const result = validateManifest({
      manifest_version: 1,
      id: 'test',
      title: 'Test',
      version: '1.0.0',
      authors: [{ name: 'a' }],
      license: 'MIT',
      language_default: 'en',
      languages_available: ['en'],
      // Missing everything else.
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths.some((p) => p.startsWith('audience'))).toBe(true);
    }
  });
});
