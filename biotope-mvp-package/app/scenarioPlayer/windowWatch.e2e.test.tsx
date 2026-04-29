/**
 * End-to-end player test for Window Watch (bd-scen.1).
 *
 * Acceptance criteria:
 *   - Plays brief → sim → field → re-encoding → reflection → done on all
 *     four age rungs in mentor_apprentice mode.
 *   - Works in solo for 9-10 and 11-12.
 *   - Narrative content is age-rung-appropriate (different brief for 5-6).
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgeRung, Mode } from '@engine/manifest';
import { createKvStore, type KvStore } from '@engine/storage';
import { createMemoryScenarioSource } from '@engine/scenario';
import { ScenarioPlayer } from './ScenarioPlayer';

const SCENARIO_DIR = resolve(__dirname, '../../scenarios/window-watch');

function makeSource() {
  const manifestBytes = readFileSync(`${SCENARIO_DIR}/manifest.yaml`);
  const inkBytes = readFileSync(`${SCENARIO_DIR}/narrative/en.ink`);
  return createMemoryScenarioSource(
    new Map<string, Uint8Array>([
      ['manifest.yaml', new Uint8Array(manifestBytes.buffer, manifestBytes.byteOffset, manifestBytes.byteLength)],
      ['narrative/en.ink', new Uint8Array(inkBytes.buffer, inkBytes.byteOffset, inkBytes.byteLength)],
    ]),
  );
}

function makeKv(): KvStore {
  return createKvStore(`ww-e2e-${Math.random().toString(36).slice(2)}`);
}

let activeKv: KvStore | null = null;
afterEach(async () => {
  cleanup();
  if (activeKv) await activeKv.clear();
  activeKv = null;
});

async function playThrough(ageRung: AgeRung, mode: Mode) {
  const kv = makeKv();
  activeKv = kv;
  const source = makeSource();
  const user = userEvent.setup();
  render(
    <ScenarioPlayer
      scenarioId="window-watch"
      ageRung={ageRung}
      mode={mode}
      source={source}
      kv={kv}
    />,
  );

  // Brief
  const beginBtn = await screen.findByRole('button', { name: 'Begin' });
  if (ageRung === '5-6') {
    expect(screen.getByText('Look out your window!')).toBeInTheDocument();
  } else {
    expect(
      screen.getByText("Right now, somewhere outside your window, birds are doing their thing."),
    ).toBeInTheDocument();
  }
  await user.click(beginBtn);

  // Sim — check target counts
  await screen.findByRole('button', { name: 'Done with sim' });
  const targets = screen
    .getAllByRole('listitem')
    .filter((li) => li.classList.contains('scenario-sim-target'));
  const expectedCount = ageRung === '5-6' ? 2 : 3;
  expect(targets).toHaveLength(expectedCount);

  // Mentor overlay present only in mentor_apprentice during sim
  if (mode === 'mentor_apprentice') {
    expect(screen.getByLabelText('Parent coaching')).toBeInTheDocument();
  } else {
    expect(screen.queryByLabelText('Parent coaching')).toBeNull();
  }
  await user.click(screen.getByRole('button', { name: 'Done with sim' }));

  // Field
  await screen.findByRole('button', { name: "I'm done watching" });
  await user.click(screen.getByRole('button', { name: "I'm done watching" }));

  // Re-encoding (defaults to encouragement node since no observation submitted)
  await screen.findByRole('button', { name: 'Continue' });
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  // Reflection
  await screen.findByRole('button', { name: 'Finish' });
  await user.click(screen.getByRole('button', { name: 'Finish' }));

  // Done
  await waitFor(() => expect(screen.getByText('Done!')).toBeInTheDocument());
  expect(screen.getByText(/Next time:/)).toBeInTheDocument();
}

describe('Window Watch — plays end-to-end in mentor_apprentice', () => {
  for (const ageRung of ['5-6', '7-8', '9-10', '11-12'] as const) {
    it(`age rung ${ageRung}`, async () => {
      await playThrough(ageRung, 'mentor_apprentice');
    });
  }
});

describe('Window Watch — plays end-to-end in solo', () => {
  for (const ageRung of ['9-10', '11-12'] as const) {
    it(`age rung ${ageRung}`, async () => {
      await playThrough(ageRung, 'solo');
    });
  }
});
