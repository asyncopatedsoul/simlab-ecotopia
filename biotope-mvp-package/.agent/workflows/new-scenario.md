# Workflow: Adding a new scenario

End-to-end playbook for authoring a scenario from scratch. Use this for any of the `bd-scen.*` issues.

**Prerequisite issues:** the runtime (`bd-rntm.*`) and authoring tooling (`bd-auth.1, .2`) must be functional.

**Reads:**
- `docs/biotope-mvp-planning.md` § 2 (the manifest template) — **the contract for this work.**
- `docs/biotope-mvp-planning.md` § 3 (the worked Backyard Bird Hour example) — concrete reference.
- `docs/biotope-mvp-planning.md` § 4 (authoring workflow) — testing matrix.

---

## 0. Confirm scope before scaffolding

Re-read the issue (`bd show bd-scen.X`) and the corresponding section in `docs/biotope-mvp-planning.md` § 1 (MVP scenario set). Confirm:

- Which age rungs the scenario supports
- Which player modes (mentor+apprentice, solo, both)
- Approximate target time per rung
- Whether camera / GPS / kit is required

If any of these conflict with the design, stop and clarify before scaffolding.

---

## 1. Scaffold

```bash
bd update bd-scen.X --claim

# CLI scaffolder from bd-auth.1
npx create-biotope-scenario backyard-bird-hour
```

Produces:

```
content/scenarios/backyard-bird-hour/
├── manifest.yaml             ← stub
├── narrative/en.ink          ← stub
├── scenes/                   ← empty
├── audio/                    ← empty
├── images/                   ← empty
└── species/species.json      ← references region pack
```

---

## 2. Storyboard

Before writing a single line of code or asset:

- Sketch the five loop phases on paper (or a whiteboard tool). One frame per phase per rung if rungs differ meaningfully.
- Write a one-paragraph story for each rung's playthrough — what's the parent doing, what's the child doing, what changes between rungs?
- Identify which 3D assets are *hero* (need contracted animation), which are *reusable* (already in the asset library or CC-licensed), which are *simple* (founder-buildable in Blender).

Capture the storyboard as a markdown file in the scenario folder:

```
content/scenarios/backyard-bird-hour/STORYBOARD.md
```

---

## 3. Author the manifest

Fill out `manifest.yaml` per the template in `docs/biotope-mvp-planning.md` § 2. Required minimum:

- Identity (id, title, version, license)
- Audience (`age_rungs`, `default_rung`, `modes`, `reading_level`)
- Locality (`biome_any` or specific, season preferences, `weather_unsuitable`)
- Estimated minutes per rung
- Hardware needs and `permissions_explainer` Ink node refs
- Five loop phases with their `narrative_node` refs
- `mentor_apprentice` seat config if applicable
- Privacy posture (use the strict defaults; only relax with rationale)
- Assets manifest with budgets

Validate as you go:

```bash
npx biotope-validate ./content/scenarios/backyard-bird-hour
```

Don't move on until this passes.

---

## 4. Author the narrative

`narrative/en.ink` is the script. Reference the manifest's node names exactly.

Key conventions:

- **Reading-level branches.** A scenario supporting both `pre_reader` and `fluent` rungs has two parallel narrative tracks. Use Ink's `EXTERNAL` functions to query the resolved rung at runtime:
  ```ink
  EXTERNAL get_reading_level()

  === brief.start ===
  {get_reading_level():
    - "pre_reader": -> brief.start_pre
    - else: -> brief.start_fluent
  }
  ```
- **Parent coaching.** The `mentor_apprentice.parent_seat.coaching_prompts` Ink nodes live in a separate file, `narrative/parent_coaching.ink`, woven via `INCLUDE`. Coaching is parent-track-only; it must never reach the child seat.
- **Field activity prompts.** Two variants per rung: a "let's go outside" prompt and an indoor fallback. Both flow into the same re-encoding node downstream.
- **External functions.** The runtime binds these standard externals: `get_reading_level()`, `get_player_age()`, `get_player_name()`, `get_recent_observation()`, `get_locality()`. Reference docs for the full list are in `engine/narrative/externals.ts`.

Once written:

```bash
# Compile Ink to JSON for runtime
npx inklecate narrative/en.ink -o narrative/en.json

# Validate referenced nodes match the manifest
npx biotope-validate ./content/scenarios/backyard-bird-hour
```

---

## 5. Build assets

### 3D scenes

Most MVP scenes are simple. Author in Blender, export to glTF 2.0, run through the asset pipeline (`bd-auth.3`):

```bash
# Raw export
blender --python-text "..." --background --render-output ...

# Compress
npm run build:scenario backyard-bird-hour
```

This produces `scenes/backyard_morning.glb` Draco+KTX2-compressed under the asset budget.

**Hero assets** (animated rigged characters — birds, squirrels, frogs) are contracted out per the GTM doc. Place placeholder grayscale boxes during development and swap in finals when contracted assets arrive. The `assets.bundles[].path` entries support glob suffixes so you can ship the placeholder until the final lands.

### Audio

- **Voice-over:** record placeholder VO yourself first (founder voice is fine for dev). Final VO comes from contracted talent per the GTM budget.
- **Background ambient:** founder-produced via modular synth or sourced from CC-BY libraries (Free Music Archive, freesound.org).
- **SFX:** founder-recorded foley + Ableton; or sourced from CC-BY libraries.

Audio pipeline:

```bash
# Convert WAV/AIFF to Opus at 96 kbps for VO, 128 kbps for music
npm run build:scenario backyard-bird-hour
```

### Images

Source: founder photography of local fauna/flora, CC-BY-licensed iNat research-grade observations, or contracted illustration. Photo licensing must be CC-BY or CC-BY-SA; CC-BY-NC is incompatible with the Hybrid Subscription tier (commercial).

```bash
npm run build:scenario backyard-bird-hour  # produces AVIF + WebP
```

---

## 6. Build the species subset

Each scenario lists its specific species in `species/species.json`:

```json
{
  "scenario_id": "backyard-bird-hour",
  "region_pack": "la-greater-v1",
  "taxa": ["robin", "house_sparrow", "blue_jay"]
}
```

The runtime cross-references this with the region pack from `bd-spec.2`. If a species isn't in the region pack, validation fails.

---

## 7. Test the scenario

### Per-rung playthrough

```bash
npm run test:scenarios -- --scenario=backyard-bird-hour
```

This runs the harness from `bd-auth.4` against every (rung, mode) the manifest declares. The matrix:

|  | mentor+apprentice | solo |
|---|---|---|
| 5–6 | required | n/a |
| 7–8 | required | optional |
| 9–10 | optional | required |
| 11–12 | optional | required |

"Required" cells gate close-of-issue. Don't close `bd-scen.X` until they pass.

### Manual playtest

- Run the scenario yourself, both seats, on a real tablet.
- Run a 5–6yo playthrough on a real device with the parent overlay engaged.
- If a real family is available, do an external playtest before final close. Cmd-driven dev cycles miss things only kids notice.

---

## 8. Asset budget audit

```bash
npx biotope-validate ./content/scenarios/backyard-bird-hour --budget
```

Confirms total bundle ≤ the `assets.total_size_max_mb` declared in the manifest. If over budget, your options:

1. Reduce 3D mesh density (Decimate modifier in Blender).
2. Lower KTX2 quality (visual diff in `npm run preview:assets`).
3. Cut audio bitrate (Opus down to 64 kbps for ambient is usually fine).
4. Drop a non-essential asset.

Do NOT ship over-budget. The aggregate budget across all scenarios (≤250MB total install) depends on per-scenario discipline.

---

## 9. Final checklist before close

- [ ] Manifest validates clean (`biotope-validate`)
- [ ] All Ink nodes referenced by the manifest exist
- [ ] All declared (rung, mode) "required" cells pass the playthrough harness
- [ ] Asset bundle is under budget
- [ ] No CC-BY-NC content (commercial-incompatible)
- [ ] Indoor fallback path tested end-to-end
- [ ] Photo gating tested (mentor+apprentice mode)
- [ ] At least one external playtest (real family, not the founder solo)

```bash
bd close bd-scen.X --reason "Acceptance met. <rung-mode summary>. External playtest with <family> on <date>."
git commit -am "Add scenario: <title> (bd-scen.X)" && git push
```

---

## Quick reference: file layout for a complete scenario

```
content/scenarios/backyard-bird-hour/
├── manifest.yaml
├── STORYBOARD.md
├── narrative/
│   ├── en.ink
│   ├── en.json                ← compiled
│   ├── parent_coaching.ink
│   └── permissions/
│       └── camera.ink
├── scenes/
│   └── backyard_morning.glb   ← Draco+KTX2
├── audio/
│   ├── vo/
│   │   └── en/
│   │       ├── brief.5-8.opus
│   │       ├── brief.9-12.opus
│   │       ├── field.5-8.opus
│   │       └── field.9-12.opus
│   ├── birds/
│   │   ├── american_robin.opus
│   │   └── ...
│   └── ambient/
│       └── morning_garden.opus
├── images/
│   ├── thumb.avif
│   └── birds/
│       ├── american_robin.avif
│       └── ...
└── species/
    └── species.json
```

---

## When something doesn't fit the template

If you find a scenario genuinely needs something the manifest can't express:

1. **Don't add a one-off ad-hoc field.** That's how schemas die.
2. File a `bd-rntm` issue describing the missing capability with rationale and a proposed schema change.
3. Get the schema change merged via a manifest version bump (this is a major-version bump on `biotope-mvp-planning.md`).
4. Then come back and use the new field.

Schema discipline early prevents pain at scenario count >10.
