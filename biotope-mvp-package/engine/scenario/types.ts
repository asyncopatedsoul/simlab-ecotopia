import type { AgeRung, Manifest, Mode, Phase } from '@engine/manifest';

/**
 * Loaded scenario bundle — manifest + compiled Ink + the stuff a player needs
 * to drive the loop. The 3D scene, photo gate, and re-encoder are *not*
 * loaded here; the player composes them on demand.
 */
export type ScenarioBundle = {
  /** As parsed from manifest.yaml (already canonicalized). */
  manifest: Manifest;
  /** Compiled Ink JSON string, ready for createInkRuntime. */
  storyJson: string;
  /** Ink compiler warnings that didn't block compilation. */
  inkWarnings: ReadonlyArray<string>;
  /** Folder path on the source side. Used by callers that resolve assets. */
  sourceRoot: string;
};

/**
 * Manifest values for one phase, after skill_rung_overrides have been
 * applied. The keys present depend on the phase. We keep this loosely typed
 * (intersection of base + override) because override patches can introduce
 * runtime-resolved flags (`add_call_recognition`, `require_predict_before_show`)
 * that aren't in the base shape — see schema.ts skillRungOverridesSchema.
 */
export type ResolvedPhase<P extends Phase> = ResolvedPhaseMap[P];

export type ResolvedPhaseMap = {
  brief: Manifest['loop']['brief'] & Record<string, unknown>;
  sim_episode: Manifest['loop']['sim_episode'] & Record<string, unknown>;
  field_activity: Manifest['loop']['field_activity'] & Record<string, unknown>;
  re_encoding: Manifest['loop']['re_encoding'];
  reflection: Manifest['loop']['reflection'];
};

export type ResolvedLoop = {
  [K in Phase]: ResolvedPhase<K>;
};

export type ScenarioRunInput = {
  scenarioId: string;
  ageRung: AgeRung;
  mode: Mode;
};

export class ScenarioLoadError extends Error {
  override readonly name = 'ScenarioLoadError';
  constructor(
    message: string,
    public readonly code:
      | 'MANIFEST_MISSING'
      | 'MANIFEST_INVALID'
      | 'INK_MISSING'
      | 'INK_COMPILE_FAILED'
      | 'NARRATIVE_PATH_INVALID',
    public override readonly cause?: unknown,
  ) {
    super(message);
  }
}
