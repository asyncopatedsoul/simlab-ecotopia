import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateScenario } from '@engine/validate';
import { parseManifest } from '@engine/manifest';
import { resolveRungOverrides } from './resolveRung';
import { createMemoryScenarioSource, loadScenario } from './index';

const SCENARIO_DIR = resolve(__dirname, '../../scenarios/window-watch');

describe('Window Watch — manifest validation', () => {
  it('passes validation with no errors', () => {
    const result = validateScenario(SCENARIO_DIR);
    const errors = result.issues.filter((i) => i.severity === 'error');
    if (!result.ok) {
      console.error('Validation issues:', result.issues);
    }
    expect(errors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });
});

describe('Window Watch — species and rung overrides', () => {
  const manifestYaml = readFileSync(`${SCENARIO_DIR}/manifest.yaml`, 'utf8');
  const manifest = parseManifest(manifestYaml);

  it('has id window-watch and correct title', () => {
    expect(manifest.id).toBe('window-watch');
    expect(manifest.title).toBe('Window Watch');
  });

  it('supports all four age rungs', () => {
    expect(manifest.audience.age_rungs).toContain('5-6');
    expect(manifest.audience.age_rungs).toContain('7-8');
    expect(manifest.audience.age_rungs).toContain('9-10');
    expect(manifest.audience.age_rungs).toContain('11-12');
  });

  it('older rungs see 3 bird targets', () => {
    for (const rung of ['7-8', '9-10', '11-12'] as const) {
      const resolved = resolveRungOverrides(manifest, rung);
      const targets = resolved.sim_episode.interactions[0]?.targets_from_species ?? [];
      expect(targets).toHaveLength(3);
    }
  });

  it('5-6 rung sees only 2 bird targets', () => {
    const resolved = resolveRungOverrides(manifest, '5-6');
    const override = (resolved.sim_episode as Record<string, unknown>)[
      'targets_from_species'
    ];
    expect(Array.isArray(override)).toBe(true);
    expect((override as unknown[]).length).toBe(2);
  });

  it('5-6 rung gets its own brief narrative_node', () => {
    const resolved = resolveRungOverrides(manifest, '5-6');
    expect(resolved.brief.narrative_node).toBe('brief.start_5_6');
  });

  it('default rung uses brief.start narrative_node', () => {
    const resolved = resolveRungOverrides(manifest, '7-8');
    expect(resolved.brief.narrative_node).toBe('brief.start');
  });

  it('field activity duration is 2 minutes', () => {
    const resolved = resolveRungOverrides(manifest, '7-8');
    expect(resolved.field_activity.duration_minutes_target).toBe(2);
  });

  it('asset budget is under 15MB', () => {
    expect(manifest.assets.total_size_max_mb).toBeLessThanOrEqual(15);
  });
});

describe('Window Watch — loadScenario round-trip', () => {
  it('loads from memory source and compiles the Ink narrative', async () => {
    const manifestBytes = readFileSync(`${SCENARIO_DIR}/manifest.yaml`);
    const inkBytes = readFileSync(`${SCENARIO_DIR}/narrative/en.ink`);
    const source = createMemoryScenarioSource(
      new Map<string, Uint8Array>([
        ['manifest.yaml', new Uint8Array(manifestBytes.buffer, manifestBytes.byteOffset, manifestBytes.byteLength)],
        ['narrative/en.ink', new Uint8Array(inkBytes.buffer, inkBytes.byteOffset, inkBytes.byteLength)],
      ]),
    );
    const bundle = await loadScenario('window-watch', source);
    expect(bundle.manifest.id).toBe('window-watch');
    expect(bundle.inkWarnings).toHaveLength(0);
    expect(bundle.storyJson).toBeTruthy();
  });
});
