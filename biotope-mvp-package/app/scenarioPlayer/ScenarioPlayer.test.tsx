import 'fake-indexeddb/auto';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgeRung, Mode } from '@engine/manifest';
import { createKvStore, type KvStore } from '@engine/storage';
import { createMemoryScenarioSource } from '@engine/scenario';
import { ScenarioPlayer } from './ScenarioPlayer';

const FIXTURE_INK = `
=== brief ===
= start
Welcome — let's find some birds.
-> END
= start_5_6
Look out the window!
-> END

=== sim ===
= done
Sim done.
-> END

=== field ===
= instruction
Watch a window for a few minutes.
-> END
= indoor_fallback
Indoors works too.
-> END

=== encode ===
= success
Found something. Nice work.
-> END
= encouragement
Empty-handed is fine — try tomorrow.
-> END

=== reflection ===
= start
Which one was your favorite?
-> END

=== permissions ===
= camera
We use the camera so you can take a picture.
-> END

=== parent_hints ===
= during_sim
While they tap, ask which one looks familiar.
-> END
= during_field
A few minutes is plenty.
-> END
`;

const FIXTURE_MANIFEST = `
manifest_version: 1
id: e2e-scenario
title: End-to-End Scenario
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
        narrative_node: brief.start_5_6
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
      next_scenario: next-scenario

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

function makeSource() {
  return createMemoryScenarioSource(
    new Map<string, Uint8Array>([
      ['manifest.yaml', new TextEncoder().encode(FIXTURE_MANIFEST)],
      ['narrative/en.ink', new TextEncoder().encode(FIXTURE_INK)],
    ]),
  );
}

function makeKv(): KvStore {
  return createKvStore(`scenario-player-test-${Math.random().toString(36).slice(2)}`);
}

let activeKv: KvStore | null = null;
afterEach(async () => {
  cleanup();
  if (activeKv) await activeKv.clear();
  activeKv = null;
});

async function renderAndAdvance({
  ageRung,
  mode,
  kv,
}: {
  ageRung: AgeRung;
  mode: Mode;
  kv: KvStore;
}) {
  const source = makeSource();
  const user = userEvent.setup();
  const { unmount } = render(
    <ScenarioPlayer
      scenarioId="e2e-scenario"
      ageRung={ageRung}
      mode={mode}
      source={source}
      kv={kv}
    />,
  );
  return { user, unmount, source };
}

describe('ScenarioPlayer — end-to-end on every age rung (mentor_apprentice)', () => {
  for (const ageRung of ['5-6', '7-8', '9-10', '11-12'] as const) {
    it(`plays brief → sim → field → re-encoding → reflection → done at rung ${ageRung}`, async () => {
      const kv = makeKv();
      activeKv = kv;
      const { user } = await renderAndAdvance({ ageRung, mode: 'mentor_apprentice', kv });

      // Brief.
      const beginButton = await screen.findByRole('button', { name: 'Begin' });
      const expectedBriefLine =
        ageRung === '5-6' ? 'Look out the window!' : "Welcome — let's find some birds.";
      expect(screen.getByText(expectedBriefLine)).toBeInTheDocument();
      // Mentor overlay shows the parent's coaching aside in mentor mode (sim/field phases).
      // Brief phase has no coaching node — overlay should be absent here.
      expect(screen.queryByLabelText('Parent coaching')).toBeNull();
      await user.click(beginButton);

      // Sim.
      await screen.findByRole('button', { name: 'Done with sim' });
      // Mentor overlay should appear now (parent_hints.during_sim).
      expect(screen.getByLabelText('Parent coaching')).toBeInTheDocument();
      const targets = screen.getAllByRole('listitem').filter((li) =>
        li.classList.contains('scenario-sim-target'),
      );
      const expectedTargetCount = ageRung === '5-6' ? 2 : 3;
      expect(targets).toHaveLength(expectedTargetCount);
      await user.click(screen.getByRole('button', { name: 'Done with sim' }));

      // Field.
      const fieldDone = await screen.findByRole('button', { name: "I'm done watching" });
      expect(screen.getByText('Watch a window for a few minutes.')).toBeInTheDocument();
      expect(screen.getByLabelText('Parent coaching')).toBeInTheDocument();
      await user.click(fieldDone);

      // Re-encoding (defaults to encouragement node).
      const reContinue = await screen.findByRole('button', { name: 'Continue' });
      expect(screen.getByText('Empty-handed is fine — try tomorrow.')).toBeInTheDocument();
      await user.click(reContinue);

      // Reflection.
      const finishBtn = await screen.findByRole('button', { name: 'Finish' });
      expect(screen.getByText('Which one was your favorite?')).toBeInTheDocument();
      await user.click(finishBtn);

      // Done.
      await waitFor(() => {
        expect(screen.getByText('Done!')).toBeInTheDocument();
      });
      expect(screen.getByText(/Next time:/)).toBeInTheDocument();
    });
  }
});

describe('ScenarioPlayer — solo mode for older rungs', () => {
  for (const ageRung of ['9-10', '11-12'] as const) {
    it(`plays end-to-end at ${ageRung} solo with no parent overlay`, async () => {
      const kv = makeKv();
      activeKv = kv;
      const { user } = await renderAndAdvance({ ageRung, mode: 'solo', kv });

      await user.click(await screen.findByRole('button', { name: 'Begin' }));
      // No coaching overlay in solo, ever.
      expect(screen.queryByLabelText('Parent coaching')).toBeNull();
      await user.click(await screen.findByRole('button', { name: 'Done with sim' }));
      expect(screen.queryByLabelText('Parent coaching')).toBeNull();
      await user.click(await screen.findByRole('button', { name: "I'm done watching" }));
      await user.click(await screen.findByRole('button', { name: 'Continue' }));
      await user.click(await screen.findByRole('button', { name: 'Finish' }));
      await waitFor(() => {
        expect(screen.getByText('Done!')).toBeInTheDocument();
      });
    });
  }
});

describe('ScenarioPlayer — persistence', () => {
  it('resumes mid-loop after unmount via the loop runtime KV snapshot', async () => {
    const kv = makeKv();
    activeKv = kv;

    // Session 1: advance into sim, then unmount.
    const r1 = await renderAndAdvance({
      ageRung: '7-8',
      mode: 'mentor_apprentice',
      kv,
    });
    await r1.user.click(await screen.findByRole('button', { name: 'Begin' }));
    await screen.findByRole('button', { name: 'Done with sim' });
    r1.unmount();

    // Wait for the persistence write to drain. createLoopRuntime chains
    // saves; in tests we just await a microtask loop.
    await new Promise((r) => setTimeout(r, 20));

    // Session 2: fresh mount with the same kv key. Should land in sim.
    const source2 = makeSource();
    render(
      <ScenarioPlayer
        scenarioId="e2e-scenario"
        ageRung="7-8"
        mode="mentor_apprentice"
        source={source2}
        kv={kv}
      />,
    );
    await screen.findByRole('button', { name: 'Done with sim' });
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull();
  });
});

describe('ScenarioPlayer — error paths', () => {
  it('surfaces a friendly error when the manifest is missing', async () => {
    const kv = makeKv();
    activeKv = kv;
    const empty = createMemoryScenarioSource(new Map());
    render(
      <ScenarioPlayer
        scenarioId="e2e-scenario"
        ageRung="7-8"
        mode="solo"
        source={empty}
        kv={kv}
      />,
    );
    await screen.findByText("Couldn't load this scenario");
  });
});
