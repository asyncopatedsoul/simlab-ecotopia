import type { InkLine } from '@engine/narrative';
import type { ResolvedLoop } from '@engine/scenario';
import { PhaseShell } from './PhaseShell';

export type FieldActivityViewProps = {
  lines: ReadonlyArray<InkLine>;
  resolved: ResolvedLoop;
  onAdvance: () => void;
};

/**
 * Field activity shell. Real photo capture + indoor fallback + safety
 * timers are per-scenario or per-cohort tasks. This view exposes the
 * "I'm done watching" advance plus the manifest-declared time limit so
 * the rung override is observable.
 */
export function FieldActivityView({ lines, resolved, onAdvance }: FieldActivityViewProps) {
  const field = resolved.field_activity;
  const minutes = field.duration_minutes_target;

  return (
    <PhaseShell
      phase="field_activity"
      title="Field"
      lines={lines}
      actions={
        <button
          type="button"
          onClick={onAdvance}
          className="scenario-action scenario-action--advance"
        >
          I'm done watching
        </button>
      }
    >
      <p className="scenario-field-target">
        Take about {minutes} minute{minutes === 1 ? '' : 's'}.
      </p>
    </PhaseShell>
  );
}
