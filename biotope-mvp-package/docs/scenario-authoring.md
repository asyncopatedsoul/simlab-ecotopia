# Scenario Authoring Guide

How to build, test, and ship a Biotope scenario. Covers the general authoring cycle, the minimal smoke-test pattern, and a walkthrough of Window Watch as the reference implementation.

**Deep production workflow** (asset pipeline, contractor handoff, budget enforcement): `.agent/workflows/new-scenario.md` and `.agent/workflows/asset-pipeline.md`.
**Manifest schema contract**: `docs/biotope-mvp-planning.md` §2.
**MVP scenario set and timing targets**: `docs/biotope-mvp-planning.md` §1.

---

## 1. The authoring cycle

```
scaffold → manifest → narrative → validate → unit test → e2e test
```

Each step gates the next. Don't move to narrative until `biotope-validate` passes the manifest. Don't write the e2e test until the validator and unit tests pass.

```bash
# 1. Scaffold
npx create-biotope-scenario my-scenario

# 2. Edit manifest.yaml and narrative/en.ink

# 3. Validate (run after every non-trivial edit)
npm run scenario:validate -- scenarios/my-scenario

# 4. Run all tests
npm test
```

The validator is fast (~100ms). Run it constantly; don't batch up errors.

---

## 2. What lives where

```
scenarios/<slug>/
├── manifest.yaml            # required — the contract
├── narrative/en.ink         # required — all Ink nodes referenced by manifest
├── species.json             # required — scenario's species subset
├── region/                  # symlink or stub dir pointing at region pack
└── scenes/
    └── <scene>.glb          # required by manifest; can be a 1-byte stub in dev
```

The loader reads only `manifest.yaml` and the `content.narrative` file at scenario boot. Everything else (3D assets, audio, images) is lazy-loaded when a phase starts. This means **the runtime and narrative run in full without any real assets**, which is the key property that makes the minimal scenario pattern work.

---

## 3. The minimal scenario

The smallest possible scenario that exercises the full runtime stack. Use this to:

- Prove a new feature end-to-end before adding real content.
- Write a new e2e test before the scenario's assets exist.
- Debug a runtime issue without asset-loading noise.

### What "minimal" means

Required fields only, no `skill_rung_overrides`, placeholder species, 1-byte scene stub, camera unused, no photos required.

### Inline pattern (for unit tests)

`app/scenarioPlayer/ScenarioPlayer.test.tsx` shows this directly. The full scenario lives as string constants inside the test — no files on disk:

```ts
import { createMemoryScenarioSource } from '@engine/scenario';

const MANIFEST = `
manifest_version: 1
id: smoke-scenario
title: Smoke
version: 1.0.0
authors:
  - name: Test
license: CC-BY-SA-4.0
language_default: en
languages_available: ["en"]
audience:
  age_rungs: ["7-8"]
  default_rung: "7-8"
  modes: ["mentor_apprentice"]
  reading_level:
    "7-8": early_reader
locality:
  biome_any: true
  season_any: true
estimated_minutes:
  "7-8": 5
hardware:
  camera: unused
  microphone: unused
  gps: unused
  accelerometer: unused
permissions_explainer: {}
content:
  species_pack: species.json
  region_pack: region/
  narrative: narrative/en.ink
loop:
  brief:
    duration_seconds_target: 30
    narrative_node: brief.start
    voice_over: false
  sim_episode:
    type: 3d_scene
    scene: scenes/main.glb
    duration_seconds_target: 60
    interactions:
      - id: look
        targets_from_species: ["bird-a"]
        per_target_max_seconds: 30
        on_complete: sim.done
  field_activity:
    type: photo_observation
    duration_minutes_target: 2
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
        "7-8": true
      max_distance_from_origin_m:
        "7-8": 0
      time_limit_minutes: 5
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
    duration_seconds_target: 30
    narrative_node: reflection.start
    prompts:
      - kind: favorite
    unlocks:
      next_scenario: next-scenario
mentor_apprentice:
  parent_seat:
    overlay_during: ["sim_episode", "field_activity"]
    can_pause: true
    can_explain: true
    coaching_prompts:
      sim_episode: parent_hints.during_sim
      field_activity: parent_hints.during_field
    photo_gate: false
  child_seat:
    can_solo_during: ["reflection"]
privacy:
  photo_storage: local_only_default
  voice_input: off_by_default
  location_obscure: true
  share_button_visible:
    "7-8": false
assets:
  total_size_max_mb: 1
  bundles:
    - path: scenes/main.glb
      size_kb: 1
    - path: narrative/en.ink
      size_kb: 1
`;

const INK = `
=== brief ===
= start
A line of brief text.
-> END

=== sim ===
= done
Sim done.
-> END

=== field ===
= instruction
Watch a window.
-> END
= indoor_fallback
Indoors is fine.
-> END

=== encode ===
= success
Nice work.
-> END
= encouragement
Nothing today — that's fine.
-> END

=== reflection ===
= start
What did you notice?
-> END

=== parent_hints ===
= during_sim
Point things out.
-> END
= during_field
Let them lead.
-> END
`;

function makeSource() {
  return createMemoryScenarioSource(new Map([
    ['manifest.yaml', new TextEncoder().encode(MANIFEST)],
    ['narrative/en.ink', new TextEncoder().encode(INK)],
  ]));
}
```

`createMemoryScenarioSource` satisfies `ScenarioSource` entirely from in-memory bytes. No disk access, no asset loading, fast.

### On-disk minimal pattern (for validator smoke tests)

Same idea, but as a real folder. The key insight: the validator and loader only care that files *exist* and *parse*. A 1-byte placeholder is enough for binary assets.

```bash
npx create-biotope-scenario smoke-scenario
# then pare down the manifest to a single age rung, single mode,
# and set all hardware fields to "unused"
echo -n "" > scenarios/smoke-scenario/scenes/main.glb   # 0-byte placeholder
npm run scenario:validate -- scenarios/smoke-scenario
```

---

## 4. Narrative nodes and manifest wiring

Every string in the manifest that references a narrative knot/stitch must exist in `en.ink`. The validator catches mismatches.

The player routes each phase to an Ink node via `nodeForPhase()` in `useScenarioPlayer.ts`:

| Phase | Ink node used |
|---|---|
| `brief` | `resolved.brief.narrative_node` |
| `sim_episode` | `resolved.brief.narrative_node` (same node — sim is interaction-driven, not narrative-driven yet) |
| `field_activity` | `resolved.field_activity.instruction_node` |
| `re_encoding` | `resolved.re_encoding.sim_response.on_no_observation` (default; success path wired by re-encoder) |
| `reflection` | `resolved.reflection.narrative_node` |

Practical implication: **the brief narrative node appears twice** (once for brief, once for sim). If your sim text should differ from your brief text, that requires a runtime extension — currently walking skeleton behavior. File a `bd-rntm` issue before working around it.

### Ink conventions

- Every phase transition is `-> END` — the runtime advances the loop machine via `ADVANCE` events, not Ink divert chains.
- Choices in the brief phase are presented as buttons and resolve inline (using `choose(index)` + `continueMaximally()`). They don't advance the loop. If your brief has a choice that should advance the loop, remove the choice and let the advance button do it.
- All `on_complete`, `narrative_node`, `instruction_node`, and `on_no_observation` references in the manifest are validated by `biotope-validate`. Every referenced knot/stitch must exist in the ink file.

---

## 5. skill_rung_overrides

Each phase except `re_encoding` and `reflection` accepts a `skill_rung_overrides` block. The resolver (`engine/scenario/resolveRung.ts`) does a **shallow merge** of the override keys over the base phase object.

```yaml
sim_episode:
  interactions:
    - id: tap
      targets_from_species: ["robin", "sparrow", "jay"]  # base: 3 targets
      per_target_max_seconds: 60
      on_complete: sim.done
  skill_rung_overrides:
    "5-6":
      targets_from_species: ["robin", "sparrow"]         # override: 2 targets
    "9-10":
      add_call_recognition: true                          # runtime flag; not in schema
```

After resolving for rung `5-6`, the merged object has `targets_from_species: ["robin", "sparrow"]` at the top level. `SimEpisodeView.readTargets()` reads this top-level key first, falling back to `interactions[0].targets_from_species` if absent.

Runtime-resolved flags like `add_call_recognition` are not in the Zod schema — the schema uses `z.record(z.string(), z.unknown())` for override values specifically to allow them. The phase views read these by casting to `Record<string, unknown>`.

**Shallow merge means**: if a rung override sets `interactions`, it replaces the entire array. There is no deep merge. Design overrides knowing this.

---

## 6. Window Watch — reference implementation

`scenarios/window-watch/` is the reference implementation for the MVP's first scenario. It's the simplest production scenario: works from any window, no outdoor required, no camera required, self-report re-encoding only.

### What makes it minimal for a production scenario

- `hardware.camera: optional` — not required, so no permission prompt
- `field_activity.completion.requires_photo: false` — field completes on timer/self-report
- `re_encoding.accept`: only `self_reported_id` — no photo upload path
- `max_distance_from_origin_m` for all rungs: `0` — no GPS bounding (window = fixed location)
- No VO, no ambient audio, no real 3D (1-byte GLB stub in dev)

### Age-rung differentiation

Window Watch supports all four rungs. The two axes of differentiation:

**Different brief copy.** The 5-6 rung override points to a different narrative node:

```yaml
loop:
  brief:
    narrative_node: "brief.start"           # used for 7-8, 9-10, 11-12
    skill_rung_overrides:
      "5-6":
        narrative_node: "brief.start_5_6"   # shorter, simpler copy
        duration_seconds_target: 30         # shorter target duration
```

**Different sim targets.** 5-6 gets 2 birds; older rungs get 3:

```yaml
  sim_episode:
    interactions:
      - id: tap_bird_card
        targets_from_species: ["american-robin", "house-sparrow", "annas-hummingbird"]
    skill_rung_overrides:
      "5-6":
        targets_from_species: ["american-robin", "house-sparrow"]
      "9-10":
        add_call_recognition: true
      "11-12":
        add_call_recognition: true
```

The `add_call_recognition` flag is a runtime-future flag — nothing currently reads it. It's declared now so the sim phase view can check for it when call recognition is implemented without a manifest version bump.

### Safety configuration for a no-outdoor scenario

Because Window Watch is window-only, the safety block sets `max_distance_from_origin_m: 0` for all rungs. `adult_present_required` is still true for 5-6 and 7-8 — the parent seat is active regardless of whether they go outside.

### Unlock chain

Window Watch unlocks `backyard-bird-hour` (bd-scen.2). The unlock is declared in `reflection.unlocks.next_scenario`. The scenario lifecycle system (bd-rntm.6) reads this after reflection completes.

---

## 7. The e2e test pattern

Every scenario needs an e2e test at `app/scenarioPlayer/<slug>.e2e.test.tsx`. The test reads the real scenario files from disk using `readFileSync` (Node fs, available in Vitest's Node environment):

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMemoryScenarioSource } from '@engine/scenario';

const SCENARIO_DIR = resolve(__dirname, '../../scenarios/window-watch');

function makeSource() {
  const manifest = readFileSync(`${SCENARIO_DIR}/manifest.yaml`);
  const ink = readFileSync(`${SCENARIO_DIR}/narrative/en.ink`);
  return createMemoryScenarioSource(new Map([
    ['manifest.yaml', new Uint8Array(manifest.buffer, manifest.byteOffset, manifest.byteLength)],
    ['narrative/en.ink', new Uint8Array(ink.buffer, ink.byteOffset, ink.byteLength)],
  ]));
}
```

This pattern reads real files but bypasses the asset loader (3D scenes, audio). The test exercises: manifest parsing, Ink compilation, rung resolution, XState loop machine, and the full React render tree through to completion.

### Acceptance test matrix

Per `docs/biotope-mvp-planning.md` §4, the cells that must pass to close a scenario issue:

| Rung | mentor_apprentice | solo |
|---|---|---|
| 5-6 | **required** | n/a |
| 7-8 | **required** | optional |
| 9-10 | optional | **required** |
| 11-12 | optional | **required** |

Window Watch's e2e test at `app/scenarioPlayer/windowWatch.e2e.test.tsx` covers all required cells.

### What to assert per phase

- **Brief:** correct narrative line for the rung (verify rung differentiation is actually applied)
- **Sim:** correct target count for the rung (verify `skill_rung_overrides` shallow merge)
- **Mentor overlay:** present during `sim_episode` and `field_activity` in mentor_apprentice mode; absent in solo mode; absent in brief and reflection
- **Field → re-encoding → reflection:** advance each with the expected button label
- **Done state:** `Done!` renders; `Next time:` renders with the unlock slug

### What not to assert in e2e

- Asset loading (3D, audio, images) — those have their own unit tests in `engine/assets/`
- Photo capture — covered in `engine/camera/`
- Ink story logic beyond the entry line — Ink unit tests go in `engine/narrative/`

---

## 8. Validator reference

```bash
npm run scenario:validate -- scenarios/<slug>
```

**Errors** (exit 1, block CI):
- `MANIFEST_PARSE_ERROR` — manifest.yaml fails the Zod schema
- `INK_NODE_MISSING` — a node referenced in the manifest doesn't exist in the ink file
- `ASSET_MISSING` — a file listed in `assets.bundles` doesn't exist
- `ASSET_OVER_BUDGET` — total bundle size exceeds `assets.total_size_max_mb`

**Warnings** (exit 0, don't block CI):
- `ASSET_SIZE_MISMATCH` — declared `size_kb` is off from actual by >5%. Update with the real value after editing content. The tolerance is intentionally generous so minor edits don't break CI, but let drift accumulate and the manifest becomes a lie.

The simplest way to keep `size_kb` accurate is to update it whenever you touch the file:

```bash
wc -c scenarios/window-watch/narrative/en.ink
# 1465 bytes → 1.4 KB → set size_kb: 1.5 (round up slightly to avoid re-triggering)
```

---

## 9. Quick reference

```bash
# Scaffold a new scenario
npx create-biotope-scenario <slug>

# Validate
npm run scenario:validate -- scenarios/<slug>

# Run only a scenario's e2e test
npx vitest run app/scenarioPlayer/<slug>.e2e.test.tsx --reporter=verbose

# Run all tests
npm test

# Check what's next in beads
bd ready

# Claim a scenario issue
bd update bd-scen.X --claim

# Close when acceptance criteria are met
bd close bd-scen.X --reason "Acceptance met. <rung/mode summary>."
```

### Manifest fields that cause the most issues

| Field | Common mistake |
|---|---|
| `audience.default_rung` | Must be in `audience.age_rungs` |
| `language_default` | Must be in `languages_available` |
| `mentor_apprentice` | Required when `modes` includes `mentor_apprentice` |
| `permissions_explainer` | Keys must match hardware fields set to `required` or `required_for_field` |
| `loop.*.on_complete` / `narrative_node` / `instruction_node` | Must be valid Ink knot/stitch paths (`knot.stitch` or `knot`) |
| `skill_rung_overrides` | Shallow merge — setting a nested field replaces the parent key, not the subfield |
