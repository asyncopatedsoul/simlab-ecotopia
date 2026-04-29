import type { AgeRung, Manifest, Phase } from '@engine/manifest';
import type { ResolvedLoop, ResolvedPhase, ResolvedPhaseMap } from './types';

/**
 * Apply skill_rung_overrides to a manifest's loop phases. The base values
 * describe the default-rung experience; the per-rung block patches it.
 *
 * Patch semantics: shallow merge. If an override sets `targets_from_species`,
 * it replaces the base value entirely (consistent with how authors write
 * overrides in docs/biotope-mvp-planning.md §2). Nested objects (e.g.
 * `safety` rung records) are NOT merged element-wise — that contract isn't
 * in the schema and authors don't expect it.
 *
 * Phases that don't carry skill_rung_overrides in the schema (re_encoding,
 * reflection) pass through unchanged.
 */
export function resolveRungOverrides(
  manifest: Manifest,
  ageRung: AgeRung,
): ResolvedLoop {
  return {
    brief: applyOverride('brief', manifest.loop.brief, ageRung),
    sim_episode: applyOverride('sim_episode', manifest.loop.sim_episode, ageRung),
    field_activity: applyOverride('field_activity', manifest.loop.field_activity, ageRung),
    re_encoding: manifest.loop.re_encoding,
    reflection: manifest.loop.reflection,
  };
}

function applyOverride<P extends 'brief' | 'sim_episode' | 'field_activity'>(
  _phase: P,
  base: ResolvedPhaseMap[P],
  ageRung: AgeRung,
): ResolvedPhaseMap[P] {
  const overrides = (base as { skill_rung_overrides?: Record<string, Record<string, unknown>> })
    .skill_rung_overrides;
  if (!overrides) return base;
  const patch = overrides[ageRung];
  if (!patch) return base;
  // Strip skill_rung_overrides from the merged result so views don't see it.
  const { skill_rung_overrides: _omit, ...rest } = base as Record<string, unknown>;
  void _omit;
  return { ...rest, ...patch } as ResolvedPhaseMap[P];
}

/**
 * Helper: read a single field from a resolved phase, with a fallback. Used by
 * phase views that want a base-value-or-override read without spreading the
 * whole phase config.
 */
export function readResolvedField<T>(
  resolved: ResolvedPhase<Phase>,
  field: string,
  fallback: T,
): T {
  const v = (resolved as Record<string, unknown>)[field];
  return v === undefined ? fallback : (v as T);
}
