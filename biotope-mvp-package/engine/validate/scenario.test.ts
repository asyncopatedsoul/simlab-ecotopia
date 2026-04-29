import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringifyManifest, parseManifest, type Manifest } from '@engine/manifest';
import { ISSUE_CODES } from './types';
import { validateScenario } from './scenario';

const VALID_INK = `
=== brief ===
= start
Hello.
+ [ok] -> END

= start_5_6
Hi there.
-> END

=== sim_complete ===
Done.
-> END

=== field ===
= instruction
Look out the window.
-> END

= indoor_fallback
Look around inside.
-> END

=== encode ===
= success
Nice.
-> END

= encouragement
That's ok.
-> END

=== reflection ===
= start
What did you see?
-> END

=== permissions ===
= camera
We need the camera so you can take a picture.
-> END

= gps
We use your location to bound the activity.
-> END

=== parent_hints ===
= during_sim
While they explore, you can ask "which one do you think it is?"
-> END

= during_field
If they get bored after 5 minutes, that's fine.
-> END
`.trim();

const VALID_MANIFEST_YAML = `
manifest_version: 1
id: "test-scenario"
title: "Test Scenario"
version: "1.0.0"
authors:
  - name: "Test"
license: "CC0"
language_default: "en"
languages_available: ["en"]

audience:
  age_rungs: ["7-8"]
  default_rung: "7-8"
  modes: ["mentor_apprentice", "solo"]
  reading_level:
    "7-8": "early_reader"

locality:
  biome_any: true
  biome_preferred: []
  season_any: true
  season_preferred: []
  daypart: []
  weather_unsuitable: []

estimated_minutes:
  "7-8": 10

hardware:
  camera: "required_for_field"
  microphone: "unused"
  gps: "unused"
  accelerometer: "unused"

permissions_explainer:
  camera: "permissions.camera"
  gps: "permissions.gps"

content:
  species_pack: "species.json"
  region_pack: "region/"
  narrative: "narrative/en.ink"

loop:
  brief:
    duration_seconds_target: 60
    narrative_node: "brief.start"
    voice_over: true
    skill_rung_overrides:
      "7-8":
        narrative_node: "brief.start_5_6"

  sim_episode:
    type: "3d_scene"
    scene: "scenes/main.glb"
    duration_seconds_target: 300
    interactions:
      - id: "tap"
        targets_from_species: ["robin"]
        per_target_max_seconds: 60
        on_complete: "sim_complete"

  field_activity:
    type: "photo_observation"
    duration_minutes_target: 10
    instruction_node: "field.instruction"
    completion:
      requires_photo: true
      photo_subject_hint: "any_bird"
      offline_capable: true
      species_recognition:
        attempt: true
        require_correct: false
    safety:
      adult_present_required:
        "7-8": true
      max_distance_from_origin_m:
        "7-8": 50
      time_limit_minutes: 30
    fallback_indoor:
      narrative_node: "field.indoor_fallback"

  re_encoding:
    accept:
      - kind: "photo"
        subject: "bird"
        confidence_min: 0.4
      - kind: "self_reported_id"
        from_species_pack: true
    sim_response:
      action: "place_player_observation_in_scene"
      narrative_node: "encode.success"
      on_no_observation: "encode.encouragement"

  reflection:
    duration_seconds_target: 60
    narrative_node: "reflection.start"
    prompts:
      - kind: "favorite"
    unlocks:
      next_scenario: "next-one"

mentor_apprentice:
  parent_seat:
    overlay_during: ["sim_episode"]
    can_pause: true
    can_explain: true
    coaching_prompts:
      sim_episode: "parent_hints.during_sim"
      field_activity: "parent_hints.during_field"
    photo_gate: true
  child_seat:
    can_solo_during: ["reflection"]

privacy:
  photo_storage: "local_only_default"
  voice_input: "off_by_default"
  location_obscure: true
  share_button_visible:
    "7-8": false

assets:
  total_size_max_mb: 5
  bundles:
    - path: "scenes/main.glb"
      size_kb: 4
    - path: "narrative/en.ink"
      size_kb: 1
`.trim();

function makeScenario(extras?: { manifestOverride?: (m: Manifest) => Manifest; ink?: string; bundleSizes?: Record<string, number> }): string {
  const folder = mkdtempSync(join(tmpdir(), 'biotope-validate-'));
  const ink = extras?.ink ?? VALID_INK;

  // Files: scenes/main.glb, narrative/en.ink, species.json, region/<dir>
  mkdirSync(join(folder, 'scenes'), { recursive: true });
  mkdirSync(join(folder, 'narrative'), { recursive: true });
  mkdirSync(join(folder, 'region'), { recursive: true });
  writeFileSync(join(folder, 'species.json'), '{}');
  writeFileSync(join(folder, 'region', '.gitkeep'), '');

  // Synthesize a 4 KB binary "scene" and stash it.
  const sceneBytes = new Uint8Array(extras?.bundleSizes?.['scenes/main.glb'] ?? 4 * 1024);
  writeFileSync(join(folder, 'scenes', 'main.glb'), sceneBytes);
  writeFileSync(join(folder, 'narrative', 'en.ink'), ink);

  let manifest = parseManifest(VALID_MANIFEST_YAML);
  if (extras?.manifestOverride) manifest = extras.manifestOverride(manifest);
  writeFileSync(join(folder, 'manifest.yaml'), stringifyManifest(manifest));
  void dirname;
  return folder;
}

const tempFolders: string[] = [];
afterEach(() => {
  while (tempFolders.length) {
    try {
      rmSync(tempFolders.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});
beforeEach(() => {
  tempFolders.length = 0;
});

function track(folder: string): string {
  tempFolders.push(folder);
  return folder;
}

describe('validateScenario — happy path', () => {
  it('returns ok=true with no errors for a valid scenario folder', () => {
    const folder = track(makeScenario());
    const result = validateScenario(folder);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('validateScenario — narrative checks (acceptance: missing Ink node)', () => {
  it('catches a manifest that references a missing Ink node with a clear, actionable message', () => {
    const folder = track(
      makeScenario({
        manifestOverride: (m) => ({
          ...m,
          loop: {
            ...m.loop,
            brief: { ...m.loop.brief, narrative_node: 'brief.does_not_exist' },
          },
        }),
      }),
    );
    const result = validateScenario(folder);
    expect(result.ok).toBe(false);
    const missing = result.issues.find((i) => i.code === ISSUE_CODES.INK_MISSING_NODE);
    expect(missing).toBeDefined();
    expect(missing!.message).toContain('brief.does_not_exist');
    expect(missing!.message).toContain('narrative/en.ink');
    expect(missing!.path).toBe('loop.brief.narrative_node');
  });

  it('catches missing nodes referenced from coaching_prompts', () => {
    const folder = track(
      makeScenario({
        manifestOverride: (m) => ({
          ...m,
          mentor_apprentice: {
            ...m.mentor_apprentice!,
            parent_seat: {
              ...m.mentor_apprentice!.parent_seat,
              coaching_prompts: {
                sim_episode: 'parent_hints.missing',
                field_activity: 'parent_hints.during_field',
              },
            },
          },
        }),
      }),
    );
    const result = validateScenario(folder);
    expect(result.issues.some((i) => i.code === ISSUE_CODES.INK_MISSING_NODE && i.path === 'mentor_apprentice.parent_seat.coaching_prompts.sim_episode')).toBe(true);
  });

  it('catches missing skill_rung_overrides narrative_node', () => {
    const folder = track(
      makeScenario({
        manifestOverride: (m) => ({
          ...m,
          loop: {
            ...m.loop,
            brief: {
              ...m.loop.brief,
              skill_rung_overrides: { '7-8': { narrative_node: 'brief.also_missing' } },
            },
          },
        }),
      }),
    );
    const result = validateScenario(folder);
    expect(
      result.issues.some(
        (i) =>
          i.code === ISSUE_CODES.INK_MISSING_NODE &&
          i.path === 'loop.brief.skill_rung_overrides.7-8.narrative_node',
      ),
    ).toBe(true);
  });

  it('reports a clear error when the Ink file itself is missing', () => {
    const folder = track(makeScenario());
    rmSync(join(folder, 'narrative', 'en.ink'));
    const result = validateScenario(folder);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ISSUE_CODES.INK_FILE_MISSING)).toBe(true);
  });
});

describe('validateScenario — asset budget (acceptance: over-budget bundle)', () => {
  it('catches a scenario that exceeds total_size_max_mb', () => {
    const folder = track(makeScenario());
    // Replace scenes/main.glb with a 6 MB file, push over the 5 MB budget.
    writeFileSync(join(folder, 'scenes', 'main.glb'), new Uint8Array(6 * 1024 * 1024));
    // Update the bundle's size_kb so the SIZE_MISMATCH check doesn't fire
    // ahead of the budget check (both fire — budget is the meaningful one).
    const result = validateScenario(folder);
    expect(result.ok).toBe(false);
    const overBudget = result.issues.find((i) => i.code === ISSUE_CODES.ASSET_OVER_BUDGET);
    expect(overBudget).toBeDefined();
    expect(overBudget!.message).toContain('5 MB');
    expect(overBudget!.message).toContain('total_size_max_mb');
    expect(overBudget!.path).toBe('assets.total_size_max_mb');
  });

  it('warns when a bundle size_kb drifts >5% from actual', () => {
    const folder = track(makeScenario());
    // Change main.glb to 8 KB but the manifest says 4 KB → 100% drift.
    writeFileSync(join(folder, 'scenes', 'main.glb'), new Uint8Array(8 * 1024));
    const result = validateScenario(folder);
    expect(result.issues.some((i) => i.code === ISSUE_CODES.ASSET_SIZE_MISMATCH)).toBe(true);
  });

  it('errors when a bundle path matches no files', () => {
    const folder = track(
      makeScenario({
        manifestOverride: (m) => ({
          ...m,
          assets: {
            ...m.assets,
            bundles: [
              ...m.assets.bundles,
              { path: 'no/such/folder/*.glb', size_kb: 1 },
            ],
          },
        }),
      }),
    );
    const result = validateScenario(folder);
    expect(result.issues.some((i) => i.code === ISSUE_CODES.ASSET_MISSING)).toBe(true);
  });

  it('errors when a directly-referenced asset is missing (e.g. scene file)', () => {
    const folder = track(makeScenario());
    rmSync(join(folder, 'scenes', 'main.glb'));
    const result = validateScenario(folder);
    expect(
      result.issues.some(
        (i) => i.code === ISSUE_CODES.ASSET_MISSING && i.path === 'loop.sim_episode.scene',
      ),
    ).toBe(true);
  });
});

describe('validateScenario — schema errors short-circuit', () => {
  it('returns parse errors with manifest paths when the schema fails', () => {
    const folder = track(makeScenario());
    writeFileSync(
      join(folder, 'manifest.yaml'),
      VALID_MANIFEST_YAML.replace('manifest_version: 1', 'manifest_version: 99'),
    );
    const result = validateScenario(folder);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (i) => i.code === ISSUE_CODES.MANIFEST_INVALID && i.path === 'manifest_version',
      ),
    ).toBe(true);
  });

  it('errors with a clear message when manifest.yaml is missing', () => {
    const folder = track(makeScenario());
    rmSync(join(folder, 'manifest.yaml'));
    const result = validateScenario(folder);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe(ISSUE_CODES.MANIFEST_PARSE_FAILED);
  });
});

describe('validateScenario — localization', () => {
  it('errors when a declared language has no .ink file', () => {
    const folder = track(
      makeScenario({
        manifestOverride: (m) => ({ ...m, languages_available: ['en', 'fr'] }),
      }),
    );
    const result = validateScenario(folder);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ISSUE_CODES.LOCALE_MISSING)).toBe(true);
  });
});

describe('validateScenario — glob expansion', () => {
  it('matches single-segment globs in bundle paths', () => {
    const folder = track(
      makeScenario({
        manifestOverride: (m) => ({
          ...m,
          assets: {
            ...m.assets,
            bundles: [
              { path: 'scenes/*.glb', size_kb: 4 },
              { path: 'narrative/en.ink', size_kb: 1 },
            ],
          },
        }),
      }),
    );
    const result = validateScenario(folder);
    expect(result.issues.some((i) => i.code === ISSUE_CODES.ASSET_MISSING)).toBe(false);
  });
});
