import type { InkLine } from '@engine/narrative';
import type { ResolvedLoop } from '@engine/scenario';
import { PhaseShell } from './PhaseShell';

export type ReflectionViewProps = {
  lines: ReadonlyArray<InkLine>;
  resolved: ResolvedLoop;
  onAdvance: () => void;
  onRecord: (promptKind: string, answer: unknown) => void;
};

export function ReflectionView({
  lines,
  resolved,
  onAdvance,
  onRecord,
}: ReflectionViewProps) {
  const prompts = resolved.reflection.prompts;
  return (
    <PhaseShell
      phase="reflection"
      title="Reflection"
      lines={lines}
      actions={
        <button
          type="button"
          onClick={onAdvance}
          className="scenario-action scenario-action--advance"
        >
          Finish
        </button>
      }
    >
      <ul className="scenario-reflection-prompts">
        {prompts.map((p) => (
          <li key={p.kind} className="scenario-reflection-prompt">
            <button
              type="button"
              className="scenario-action scenario-action--reflection"
              onClick={() => onRecord(p.kind, true)}
            >
              {p.kind}
            </button>
          </li>
        ))}
      </ul>
    </PhaseShell>
  );
}
