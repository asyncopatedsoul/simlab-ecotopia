import { describe, expect, it } from 'vitest';
import {
  createMemoryScenarioSource,
  loadScenario,
  resolveRungOverrides,
  ScenarioLoadError,
} from './index';

const FIXTURE_INK = `
=== brief ===
= start
Welcome to the test scenario.
+ [Begin] -> END

=== sim ===
= done
Sim done.
-> END

=== field ===
= instruction
Look around.
-> END
= indoor_fallback
Indoors works too.
-> END

=== encode ===
= success
Found something.
-> END
= encouragement
Empty-handed is fine.
-> END

=== reflection ===
= start
What did you like?
-> END

=== permissions ===
= camera
We use the camera to take photos.
-> END

=== parent_hints ===
= during_sim
Let them tap whichever bird looks interesting.
-> END
= during_field
Five minutes of looking is plenty.
-> END
`;

const FIXTURE_MANIFEST = `
manifest_version: 1
id: test-scenario
title: Test Scenario
version: 1.0.0
authors:
  - name: Test Author
license: CC-BY-SA-4.0
language_default: en
languages_available: ["en"]

audience:
  age_rungs: ["5-6", "7-8", "9-10", "11-12"]
  default_rung: "7-8"
  modes: ["mentor_apprentice", "solo"]
  reading_level:
    "5-6": pre_reader
    "7-8": early_reader
    "9-10": fluent_simple
    "11-12": fluent

locality:
  biome_any: true
  season_any: true

estimated_minutes:
  "5-6": 5
  "7-8": 10
  "9-10": 15
  "11-12": 20

hardware:
  camera: optional
  microphone: unused
  gps: unused
  accelerometer: unused

permissions_explainer:
  camera: permissions.camera

content:
  species_pack: species.json
  region_pack: region/
  narrative: narrative/en.ink

loop:
  brief:
    duration_seconds_target: 60
    narrative_node: brief.start
    voice_over: false
    skill_rung_overrides:
      "5-6":
        duration_seconds_target: 30
      "11-12":
        duration_seconds_target: 90
        narrative_node: brief.start
  sim_episode:
    type: 3d_scene
    scene: scenes/main.glb
    duration_seconds_target: 180
    interactions:
      - id: tap
        targets_from_species: ["bird-1", "bird-2", "bird-3"]
        per_target_max_seconds: 30
        on_complete: sim.done
    skill_rung_overrides:
      "5-6":
        targets_from_species: ["bird-1", "bird-2"]
      "11-12":
        add_call_recognition: true
  field_activity:
    type: photo_observation
    duration_minutes_target: 5
    instruction_node: field.instruction
    completion:
      requires_photo: false
      photo_subject_hint: any
      offline_capable: true
      species_recognition:
        attempt: false
        require_correct: false
    safety:
      adult_present_required:
        "5-6": true
        "7-8": true
        "9-10": false
        "11-12": false
      max_distance_from_origin_m:
        "5-6": 20
        "7-8": 50
        "9-10": 200
        "11-12": 500
      time_limit_minutes: 15
    fallback_indoor:
      narrative_node: field.indoor_fallback
  re_encoding:
    accept:
      - kind: self_reported_id
        from_species_pack: true
    sim_response:
      action: place_player_observation_in_scene
      narrative_node: encode.success
      on_no_observation: encode.encouragement
  reflection:
    duration_seconds_target: 60
    narrative_node: reflection.start
    prompts:
      - kind: favorite
    unlocks:
      next_scenario: next-test

mentor_apprentice:
  parent_seat:
    overlay_during: ["sim_episode", "field_activity"]
    can_pause: true
    can_explain: true
    coaching_prompts:
      sim_episode: parent_hints.during_sim
      field_activity: parent_hints.during_field
    photo_gate: true
  child_seat:
    can_solo_during: ["reflection"]

privacy:
  photo_storage: local_only_default
  voice_input: off_by_default
  location_obscure: true
  share_button_visible:
    "5-6": false
    "7-8": false
    "9-10": with_parent_confirm
    "11-12": with_parent_confirm

assets:
  total_size_max_mb: 30
  bundles:
    - path: scenes/main.glb
      size_kb: 2
    - path: narrative/en.ink
      size_kb: 1
`;

function fixtureSource() {
  return createMemoryScenarioSource(
    new Map<string, Uint8Array>([
      ['manifest.yaml', new TextEncoder().encode(FIXTURE_MANIFEST)],
      ['narrative/en.ink', new TextEncoder().encode(FIXTURE_INK)],
    ]),
  );
}

describe('loadScenario', () => {
  it('parses the manifest and compiles the .ink narrative', async () => {
    const bundle = await loadScenario('test-scenario', fixtureSource());
    expect(bundle.manifest.id).toBe('test-scenario');
    expect(bundle.manifest.audience.age_rungs).toEqual(['5-6', '7-8', '9-10', '11-12']);
    expect(bundle.storyJson.length).toBeGreaterThan(50);
    // Compiled JSON should contain knot identifiers.
    expect(bundle.storyJson).toContain('brief');
  });

  it('rejects when the requested scenarioId disagrees with manifest.id', async () => {
    await expect(loadScenario('wrong-id', fixtureSource())).rejects.toThrow(/wrong-id/);
  });

  it('passes through pre-compiled .json narratives', async () => {
    const json = '{"inkVersion":21,"root":[[null,{"#f":1}],"done"],"listDefs":{}}';
    const manifestWithJson = FIXTURE_MANIFEST.replace(
      'narrative: narrative/en.ink',
      'narrative: narrative/en.json',
    );
    const src = createMemoryScenarioSource(
      new Map([
        ['manifest.yaml', new TextEncoder().encode(manifestWithJson)],
        ['narrative/en.json', new TextEncoder().encode(json)],
      ]),
    );
    const bundle = await loadScenario('test-scenario', src);
    expect(bundle.storyJson).toBe(json);
    expect(bundle.inkWarnings).toEqual([]);
  });

  it('reports MANIFEST_MISSING when manifest.yaml is absent', async () => {
    const src = createMemoryScenarioSource(new Map());
    await expect(loadScenario('test-scenario', src)).rejects.toMatchObject({
      code: 'MANIFEST_MISSING',
    });
  });

  it('reports INK_COMPILE_FAILED on broken Ink source', async () => {
    // Divert to an undefined knot is a hard compile error in inkjs.
    const broken = '=== valid_knot ===\n-> nonexistent_knot\n';
    const src = createMemoryScenarioSource(
      new Map([
        ['manifest.yaml', new TextEncoder().encode(FIXTURE_MANIFEST)],
        ['narrative/en.ink', new TextEncoder().encode(broken)],
      ]),
    );
    await expect(loadScenario('test-scenario', src)).rejects.toMatchObject({
      code: 'INK_COMPILE_FAILED',
    });
  });

  it('rejects path-traversal narrative paths', async () => {
    const bad = FIXTURE_MANIFEST.replace(
      'narrative: narrative/en.ink',
      'narrative: ../escape.ink',
    );
    const src = createMemoryScenarioSource(
      new Map([['manifest.yaml', new TextEncoder().encode(bad)]]),
    );
    await expect(loadScenario('test-scenario', src)).rejects.toBeInstanceOf(ScenarioLoadError);
  });
});

describe('resolveRungOverrides', () => {
  it('returns base values for the default rung when no override exists', async () => {
    const bundle = await loadScenario('test-scenario', fixtureSource());
    const r = resolveRungOverrides(bundle.manifest, '7-8');
    expect(r.brief.duration_seconds_target).toBe(60);
    expect(r.sim_episode.interactions[0]!.targets_from_species).toEqual([
      'bird-1',
      'bird-2',
      'bird-3',
    ]);
  });

  it('applies a per-rung patch (5-6: shorter brief, fewer sim targets)', async () => {
    const bundle = await loadScenario('test-scenario', fixtureSource());
    const r = resolveRungOverrides(bundle.manifest, '5-6');
    expect(r.brief.duration_seconds_target).toBe(30);
    expect(
      (r.sim_episode as unknown as { targets_from_species: string[] }).targets_from_species,
    ).toEqual(['bird-1', 'bird-2']);
  });

  it('applies a runtime-flag override (11-12: add_call_recognition)', async () => {
    const bundle = await loadScenario('test-scenario', fixtureSource());
    const r = resolveRungOverrides(bundle.manifest, '11-12');
    expect((r.sim_episode as { add_call_recognition?: boolean }).add_call_recognition).toBe(true);
    expect(r.brief.duration_seconds_target).toBe(90);
  });

  it('strips skill_rung_overrides from the resolved phase', async () => {
    const bundle = await loadScenario('test-scenario', fixtureSource());
    const r = resolveRungOverrides(bundle.manifest, '5-6');
    expect(
      (r.brief as { skill_rung_overrides?: unknown }).skill_rung_overrides,
    ).toBeUndefined();
  });

  it('passes re_encoding and reflection through unchanged', async () => {
    const bundle = await loadScenario('test-scenario', fixtureSource());
    const r = resolveRungOverrides(bundle.manifest, '5-6');
    expect(r.re_encoding.sim_response.narrative_node).toBe('encode.success');
    expect(r.reflection.narrative_node).toBe('reflection.start');
  });
});
