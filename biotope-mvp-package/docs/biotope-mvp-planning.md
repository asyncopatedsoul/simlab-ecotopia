# Biotope MVP — Planning & Scenario Design Template

*Scope: Variation B-3 (mobile-first) · Audience: parent + 5–12yo*

This document narrows the v3 design down to a buildable first version. It defines the MVP scope, the first set of scenarios, and — the centerpiece — a **scenario manifest template** specifically tuned for parent-and-child play in the 5–12 age range. Companion to `biotope-design.md`.

---

## 1. MVP Scope

### Why this MVP

The platform's structure most distinctively benefits the audiences that mainstream learning software underserves: **young children with a co-playing parent**, and **tweens at the edge of independent fieldwork**. Mobile is where those families have devices. B-3 is the right starting variation because it reaches that audience with the lowest distribution friction (App Store / Play / PWA), the lowest engineering cost, and the shortest path to the first real player.

The MVP proves one claim end-to-end: **the alternation of sim and field, scaffolded by a parent, produces measurably better engagement and retention than either half alone**. Everything that doesn't directly support proving that claim gets deferred.

### What's in

| Layer | MVP scope |
|---|---|
| **Distribution** | iOS App Store, Google Play, PWA at one URL |
| **Wrapper** | Capacitor for stores; PWA install-to-homescreen as a fallback |
| **Engine** | Three.js + R3F + drei (per Variation B) |
| **Physics** | Rapier via `@react-three/rapier`, only where needed (most MVP scenarios are physics-light) |
| **Narrative** | Ink + `inkjs` |
| **State** | Zustand (UI), XState (one statechart per scenario) |
| **Storage** | Dexie (IndexedDB) for app state; OPFS for ≥10 MB blobs |
| **Maps** | MapLibre GL JS + a small PMTiles regional extract |
| **Species data** | A pre-baked SQLite-WASM region pack (~50–200 species, photos, audio) |
| **Player modes** | Solo (9–12) and Mentor + apprentice (5–8). Co-located peer co-op is *prepared for* in the manifest format but not shipped. |
| **Field activity verification** | Photo capture (camera permission), basic time-on-task, optional GPS bounding |
| **Languages** | English at launch; manifest format supports localization for v1.1+ |

### What's deliberately out (for now)

- **XR / AR.** No `immersive-vr` or `immersive-ar`; no `getUserMedia` AR overlay. Pure 2D + 3D-on-screen.
- **Dedicated server / remote multiplayer.** No Colyseus, no LiveKit, no voice chat. Multiplayer is co-located only and uses local LAN peer-to-peer for two-device cases (deferred to v1.1).
- **Embedded systems / RC vehicles.** No MCU emulation, no Web Serial bridges. The whole RC research vehicle layer waits for the adult-audience release.
- **Hard-engineering domain solvers.** No circuits, fluids, reactions, or population solvers in MVP scenarios. Soft-skills (observation, identification, simple cause-and-effect) only.
- **Procedural generation.** All scenarios are hand-authored with hand-placed assets.
- **B-1 / B-2 distribution.** No Steam, no Steam Deck, no Switch.
- **Modding / UGC.** The manifest format is published and authored against, but there is no in-app editor and no third-party mod loader yet.
- **Sync across devices.** Solo-device only. Cross-device save sync waits for v1.1 once a backend exists.

### MVP constraints

- **Asset budget:** ≤ 250 MB total install size; ≤ 30 MB per scenario; texture format is KTX2 / Basis Universal; 3D models are Draco-compressed glTF.
- **Performance target:** smooth (≥ 30 fps) on iPad 9th gen, Galaxy Tab A8, and a 2022-class mid-range Android phone in landscape.
- **Offline:** every shipped scenario runs cold with no network after first install.
- **Privacy posture (because of the audience):**
  - Camera and GPS permissions requested only at the moment a scenario uses them, with a child-friendly explainer screen.
  - Photos default to local-only; sharing is an opt-in with parent gate.
  - No third-party analytics. Crash reporting is opt-in and aggregated.
  - Apple App Store Kids Category and Google Designed for Families compliance from day one.

### MVP scenario set

Five hand-authored scenarios, all in one biome (the player's local backyard / nearby park / neighborhood). They unlock in order; the order is suggested by gentle gating, not enforced rigidly.

| # | Working title | Domain | Modes | Time (5–8 / 9–12) |
|---|---|---|---|---|
| 1 | **Window Watch** | Observation | Mentor+apprentice | 8 / 12 min |
| 2 | **Backyard Bird Hour** | Bird identification | Mentor+apprentice, Solo | 15 / 25 min |
| 3 | **Whose Tracks?** | Mammal sign / inference | Mentor+apprentice, Solo | 15 / 25 min |
| 4 | **Leaf Detective** | Plant identification | Mentor+apprentice, Solo | 15 / 25 min |
| 5 | **Pond Window** | Pond / micro-aquatic | Mentor+apprentice | 20 / 30 min |

Five is small on purpose. It's enough to validate the loop and show progression; small enough to ship.

---

## 2. The Scenario Manifest Template

A scenario is a folder with a manifest, narrative, assets, and (optionally) scripts. The manifest is YAML (JSON also accepted) and describes everything the runtime needs to load and play the scenario across age rungs and modes.

### Folder layout

```
scenarios/
  backyard-bird-hour/
    manifest.yaml              ← the file specified below
    narrative/
      en.ink                   ← Ink script, English
    scenes/
      backyard_morning.glb     ← Draco+KTX2 compressed glTF
    audio/
      vo/
        en/
          brief.5-8.ogg
          brief.9-12.ogg
          field.5-8.ogg
          ...
      birds/
        american_robin.ogg
        ...
    images/
      thumb.webp
      birds/
        american_robin.webp
        ...
    species/
      species.json             ← scenario-specific species subset
```

### The template

The annotated full template follows. Each section after this code block explains what its fields do, what's required vs optional, and what the parent-and-child-specific considerations are.

```yaml
# manifest.yaml

# ─── identity ────────────────────────────────────────────────────
manifest_version: 1
id: "backyard-bird-hour"             # globally unique slug
title: "Backyard Bird Hour"
version: "1.0.0"                      # SemVer; bumped on content edits
authors:
  - name: "Author Name"
    contact: "author@example.org"
license: "CC-BY-SA-4.0"
language_default: "en"
languages_available: ["en"]

# ─── audience ────────────────────────────────────────────────────
audience:
  age_rungs: ["5-6", "7-8", "9-10", "11-12"]
  default_rung: "7-8"
  modes:
    - "mentor_apprentice"             # parent + child
    - "solo"                          # older child alone
  reading_level:
    "5-6":  "pre_reader"              # voice-only; no required text
    "7-8":  "early_reader"            # short words, voice on tap
    "9-10": "fluent_simple"
    "11-12": "fluent"

# ─── locality & timing ────────────────────────────────────────────
locality:
  biome_any: true
  biome_preferred: ["temperate_residential", "urban_park"]
  season_any: true
  season_preferred: ["spring", "summer", "fall"]
  daypart: ["morning", "midday", "afternoon"]
  weather_unsuitable: ["heavy_rain", "lightning", "extreme_heat"]

estimated_minutes:
  "5-6": 10
  "7-8": 15
  "9-10": 20
  "11-12": 25

# ─── hardware & permissions ──────────────────────────────────────
hardware:
  camera: required_for_field
  microphone: optional
  gps: optional
  accelerometer: unused
permissions_explainer:
  camera: "narrative/permissions/camera"   # Ink node shown before request
  gps:    "narrative/permissions/gps"

# ─── content references ──────────────────────────────────────────
content:
  species_pack: "species.json"
  region_pack:  "../../region-packs/local-birds-v2/"
  narrative:    "narrative/en.ink"

# ─── the loop ─────────────────────────────────────────────────────
loop:

  brief:
    duration_seconds_target: 60
    narrative_node: "brief.start"
    voice_over: true
    skill_rung_overrides:
      "5-6":   { duration_seconds_target: 30, narrative_node: "brief.start_5_6" }
      "11-12": { duration_seconds_target: 90 }

  sim_episode:
    type: "3d_scene"
    scene: "scenes/backyard_morning.glb"
    duration_seconds_target: 300
    interactions:
      - id: "tap_to_learn"
        targets_from_species: ["robin", "house_sparrow", "blue_jay"]
        per_target_max_seconds: 60
        on_complete: "narrative.sim_complete"
    skill_rung_overrides:
      "5-6":
        targets_from_species: ["robin", "house_sparrow"]
      "9-10":
        add_call_recognition: true
      "11-12":
        add_call_recognition: true
        require_predict_before_show: true

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
        require_correct: false       # don't gate on a model getting it right
    safety:
      adult_present_required:
        "5-6":  true
        "7-8":  true
        "9-10": false
        "11-12": false
      max_distance_from_origin_m:
        "5-6":  20
        "7-8":  50
        "9-10": 200
        "11-12": 500
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
      - kind: "favorite_of_encountered"
      - kind: "where_seen"
        rungs: ["9-10", "11-12"]
    unlocks:
      next_scenario: "whose-tracks"

# ─── seat configuration for mentor_apprentice ────────────────────
mentor_apprentice:
  parent_seat:
    overlay_during: ["sim_episode", "field_activity"]
    can_pause: true
    can_explain: true
    coaching_prompts:
      sim_episode:    "narrative.parent_hints_sim"
      field_activity: "narrative.parent_hints_field"
    photo_gate: true                    # parent confirms before save
  child_seat:
    can_solo_during: ["reflection"]

# ─── privacy & safeguarding ──────────────────────────────────────
privacy:
  photo_storage: "local_only_default"
  voice_input: "off_by_default"
  location_obscure: true                 # never store precise coords for child
  share_button_visible:
    "5-6":  false
    "7-8":  false
    "9-10": "with_parent_confirm"
    "11-12": "with_parent_confirm"

# ─── assets manifest ─────────────────────────────────────────────
assets:
  total_size_max_mb: 30
  bundles:
    - { path: "scenes/backyard_morning.glb",  size_kb: 4200 }
    - { path: "audio/vo/en/*.ogg",            size_kb: 1800 }
    - { path: "audio/birds/*.ogg",            size_kb: 900  }
    - { path: "images/birds/*.webp",          size_kb: 350  }
    - { path: "narrative/en.ink",             size_kb: 12   }
```

### Section-by-section explanation

#### Identity

The first block is metadata that lets the runtime address the scenario, the registry recognize it, and authoring tools track changes. `id` is the unique slug used everywhere internally. `version` is SemVer — bump the patch on content edits, the minor when you add a new age rung or mode, the major on incompatible manifest changes. `license` matters because content is meant to be shareable; the default for community-contributed scenarios should be CC-BY-SA-4.0.

`language_default` and `languages_available` declare which voice/text translations exist; the runtime falls back to the default if a player's language isn't shipped.

#### Audience

This is the section that does the most work for the parent-and-5–12yo case.

- **`age_rungs`** declares which rungs the scenario *supports*. Rungs are 2-year buckets so authors can write content that targets a specific developmental window. A scenario can support a subset; the runtime greys out unsupported rungs.
- **`default_rung`** is what runs if the player's age profile isn't specified.
- **`modes`** declares which player configurations work. For the MVP, `mentor_apprentice` (parent + child) and `solo` (older child alone) are the two we ship. Co-located peer co-op is in the format but not in the runtime yet.
- **`reading_level`** is the most parent-friendly field. It's not just decorative — the runtime uses it to choose: which text variant to render, whether to auto-play voice-over, whether tappable text is required, and whether parent coaching prompts are visible.

The four reading levels (`pre_reader`, `early_reader`, `fluent_simple`, `fluent`) each have a corresponding UI mode in the app. A `pre_reader` 5-year-old will see big illustrated buttons with no text below them and the narrator will read everything aloud automatically. A `fluent` 11-year-old will see normal text with optional voice-on-tap.

#### Locality & timing

- **`biome_any: true`** is the inclusive default — most parent-and-child scenarios should work *anywhere*, because that's the audience's reality. `biome_preferred` is a soft hint; if the player's location is in a preferred biome the scenario will show first in their queue.
- **`weather_unsuitable`** is checked against a local-cached weather snapshot before suggesting a field activity. The runtime won't push a child outside in lightning.
- **`estimated_minutes`** is per rung. A 5-year-old's "Backyard Bird Hour" is 10 minutes total because that's the attention span; an 11-year-old's is 25. The same scenario, the same loop — different pacing.

#### Hardware & permissions

`required_for_field` means the scenario needs the camera but only at the field-activity step — and the runtime knows to request permission at that moment, not at scenario start. This matters for kids' apps: just-in-time permission prompts with child-friendly explanation screens are the right pattern. The `permissions_explainer` field references an Ink node that runs before the OS-level prompt; that node lets the parent read the explanation aloud or have the child see an illustrated reason.

#### Content references

- **`species_pack`** is a small JSON file in the scenario folder listing the specific species this scenario uses.
- **`region_pack`** is a reference to a larger shared species pack (with photos, audio, taxonomy) that lives outside the scenario.
- **`narrative`** is the Ink script for this scenario.

#### The loop

The `loop:` block is the heart of the manifest. It maps the five-phase core experience loop (brief → sim → field → re-encoding → reflection) onto concrete content. Every phase has the same general shape:

- A type and the assets it needs.
- A target duration (the runtime is forgiving — it's a target, not a hard cap, except for safety-critical fields like `time_limit_minutes` in the field activity).
- A reference to one or more Ink narrative nodes for the text/voice content.
- An optional `skill_rung_overrides` block.

**Skill rung overrides** are the mechanism that lets one manifest serve a 5-year-old and an 11-year-old. The base values describe the default-rung experience; the overrides patch it for other rungs. In the example: 5–6-year-olds see only two birds (not three), 9–10s gain audio call recognition, 11–12s additionally have to predict-before-show ("which one do you think it is before tapping?").

For the **field activity**, the parent-and-child specifics live in `safety:`. `adult_present_required` makes the under-8 cohort require an adult on premises (the runtime can prompt for the parent's confirmation with a quick re-auth or face-check). `max_distance_from_origin_m` is a soft GPS bound: if a 5-year-old wanders more than 20 m from the activity origin, the parent gets a gentle ping. `fallback_indoor` references a narrative node that lets the activity continue indoors if going outside isn't viable that day — bad weather, sleeping baby, whatever. **Field activities that can't gracefully degrade indoors should fail review for the 5–12 audience.** Outdoors must always be optional, never required.

For **re-encoding**, the `accept:` array describes what the runtime is allowed to count as a successful field-side input. A photo of a bird at 0.4 confidence (a deliberately low bar — we don't gate on the local model getting it right), or a self-reported ID picked from the species pack. If neither comes back, `on_no_observation` references an encouraging Ink node that says "no luck today, that's fine — birds are good at hiding" and still lets the loop progress.

For **reflection**, the prompts are short and the unlock chain is declared inline.

#### Seat configuration

This block configures what the parent and child see when both are playing. `coaching_prompts` references Ink nodes in the *parent's* track only — the child never sees the parent's coaching hints. `photo_gate: true` is the parent confirming the photo before save; this is on by default for under-8 and is a privacy default, not a paranoia setting.

`can_solo_during` enumerates which phases the child can complete alone even when in mentor-apprentice mode — useful for, e.g., the parent stepping out to start dinner during the reflection phase.

#### Privacy & safeguarding

The defaults here are deliberately strict for the audience. Photos local-only; voice off by default; location obscured (never store the child's precise coordinates, only round to the nearest 100 m for area context); share buttons hidden under 9, parent-gated above. Authors *can* relax these per scenario if there's a reason, but the platform UI will surface a warning during authoring.

#### Assets manifest

`total_size_max_mb` is enforced at build time — the asset pipeline refuses to bundle a scenario over budget. The `bundles:` array enumerates the files (or globs) that make up the scenario; sizes are pre-computed by the build tool to keep the manifest honest.

---

## 3. Worked Example: *Backyard Bird Hour*

The template above is concrete already; this section walks through how it plays out for a real family, to make the design intent vivid.

### Brief (60s)

Parent and child open the app on a tablet. The narrator (warm voice, conversational): *"Look out the window. I'll bet there's a bird out there right now. Want to find out who?"* The 3D scene shows a stylized window with an out-of-focus garden behind it. A robin lands on the sill. Tap-to-continue is a giant illustrated button. No text required. (For an 11-year-old the same brief is text-and-voice with a more complex framing: *"You're going to learn three local birds. Pick the one you think you'll see first and we'll find out."*)

### Sim episode (5 min)

The 3D backyard scene at morning light. Three birds are present in different parts of the scene; tapping each bird zooms in, plays its call, and surfaces a single fact card ("American Robin · eats worms from the ground · the orange chest is how you spot one"). For a 9–10-year-old, the bird call plays *first* and they're asked to pick which bird made it before the visual identification is revealed. For a 5–6-year-old, only two birds appear and the call recognition step is skipped.

### Field activity (10 min)

The narrator: *"Now let's see if we can find a real one. Take the tablet outside — or you can leave it inside and just watch through a window — and try to spot any bird at all. Doesn't have to be one of these three."*

Parent-mode adds an overlay on the parent's view (or split-screen if same device): *"If they get bored after 5 minutes, that's fine — pretending to be quiet and still is the lesson. You can also just look at the photo together later."*

The camera permission is requested with an illustrated child-friendly screen explaining *why* the camera is needed (one short sentence and a picture of a phone aimed at a tree). Photo capture happens; the photo is held in a local pending state until the parent confirms it (under 8) or directly saved (9+). If 30 minutes pass with no photo, the activity gracefully ends and the loop continues — no scolding, no failure state.

### Re-encoding (1–2 min)

Back in the app. The photo (if any) is dropped into a small slot in the 3D scene; if the local model recognized a species above 0.4 confidence, the matching bird flies into the scene with a small celebration animation. If not, the player picks from the species pack ("which one was it most like?"). If no photo at all, the narrator says: *"Birds are sneaky. Let's just remember to keep watching tomorrow."*

### Reflection (60s)

A single short prompt: *"Which bird was your favorite?"* The choices are illustrated, voice-narrated, with their names. Tap one. The next scenario unlocks — *Whose Tracks?* — and gets queued in the player's "next time" slot.

---

## 4. Authoring Workflow

A scenario is hand-authored against this template. The MVP toolchain:

1. **Scaffold** — `npx create-biotope-scenario backyard-bird-hour` produces the folder layout above with empty stubs.
2. **Author the manifest** — fill out the YAML, leaving asset references to the next steps.
3. **Author the narrative** — write `narrative/en.ink` against the node names referenced in the manifest. The Ink linter validates that every referenced node exists.
4. **Add assets** — drop in 3D glTF, audio, images. The asset pipeline auto-compresses (Draco + KTX2 for glTF, Opus for audio, AVIF/WebP for images) and rewrites paths.
5. **Validate** — `npx biotope-validate ./` runs schema validation, asset budget checks, missing-narrative-node checks, missing-localization checks, and a per-rung playthrough check.
6. **Test** — run the scenario in the in-app preview mode against a **testing matrix**:

   |  | mentor+apprentice | solo |
   |---|---|---|
   | 5–6 | required | n/a |
   | 7–8 | required | optional |
   | 9–10 | optional | required |
   | 11–12 | optional | required |

   "Required" cells must be played end-to-end before publish. "Optional" cells are played if the manifest declares the rung+mode combination.

7. **Publish** — for first-party MVP scenarios, this is a build artifact in the app bundle. The same pipeline produces sideloadable packs for v1.1+ when UGC opens up.

---

## 5. Open Questions / Next Steps

1. **Manifest schema versioning.** v1 of the manifest is described above; how will v2 (when XR / multiplayer / embedded systems land) maintain compatibility with v1 scenarios? Default proposal: additive-only changes within a major version; parsers tolerate unknown fields.
2. **Local species ID model.** A small on-device model for "is this a bird? is this a tree? is this a mammal track?" is enough for re-encoding; full species ID is out of scope. Which model? PlantNet's mobile model? A custom trained subset? An iNaturalist computer-vision API call when online, with degraded local fallback?
3. **Voice-over production.** Each scenario needs ~5 minutes of warm, age-appropriate VO per language. In-house? Volunteer? AI synthesis with human review? For MVP, a small set of recorded voice talents is probably right — TTS for prototype, real voice for ship.
4. **Parent coaching content.** The `coaching_prompts` Ink nodes are essentially a parallel mini-curriculum *for the parent*. Who writes that? It needs a different voice and a different sensibility than the child-facing content. This is a design role to fill.
5. **Failure-state design.** Field activities that can't be completed (weather, time, attention) must end gracefully. The current default — narrator says something kind, loop continues — needs playtesting. What if a child fails three field activities in a row? Auto-suggest indoor variants? Pause progression?
6. **Indoor fallback parity.** Each scenario currently has a `fallback_indoor` node, but the *quality* of the indoor experience varies by scenario. Should indoor variants be a separate sub-scenario? A flag on the field activity? A different content tier?
7. **Age-rung transitions.** When a 7-year-old turns 8, do they replay scenarios at the new rung? Get an upgrade nudge? Have everything quietly recompute? Default proposal: nudge the parent at the rung boundary, let them choose.
8. **The first three scenarios actually authored.** Window Watch and Backyard Bird Hour are good first candidates; the third is less obvious. Pick after the first two are playable.
9. **Playtest cadence.** A real family with a real 6-year-old needs to play this in a real backyard, with a parent who isn't on the team, before any of the above answers itself confidently.
