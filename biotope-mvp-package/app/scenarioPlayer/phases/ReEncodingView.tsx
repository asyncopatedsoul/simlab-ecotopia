import type { InkLine } from '@engine/narrative';
import type { ResolvedLoop } from '@engine/scenario';
import { PhaseShell } from './PhaseShell';

export type ReEncodingViewProps = {
  lines: ReadonlyArray<InkLine>;
  resolved: ResolvedLoop;
  onAdvance: () => void;
};

/**
 * Re-encoding shell. The full self-report picker (and the photo + classifier
 * path) is per-scenario work; for now the view shows the encouraging /
 * success narrative and lets the player advance. The reEncoder module is
 * already wired (engine/reEncoding) and will be invoked from per-scenario
 * tasks that capture real input.
 */
export function ReEncodingView({ lines, resolved, onAdvance }: ReEncodingViewProps) {
  void resolved;
  return (
    <PhaseShell
      phase="re_encoding"
      title="Re-encoding"
      lines={lines}
      actions={
        <button
          type="button"
          onClick={onAdvance}
          className="scenario-action scenario-action--advance"
        >
          Continue
        </button>
      }
    />
  );
}
