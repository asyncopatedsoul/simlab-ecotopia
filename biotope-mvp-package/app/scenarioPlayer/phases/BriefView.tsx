import type { InkChoice, InkLine } from '@engine/narrative';
import type { ResolvedLoop } from '@engine/scenario';
import { PhaseShell } from './PhaseShell';

export type BriefViewProps = {
  lines: ReadonlyArray<InkLine>;
  choices: ReadonlyArray<InkChoice>;
  resolved: ResolvedLoop;
  onChoose: (index: number) => void;
  onAdvance: () => void;
};

export function BriefView({ lines, choices, resolved, onChoose, onAdvance }: BriefViewProps) {
  void resolved;
  return (
    <PhaseShell
      phase="brief"
      title="Brief"
      lines={lines}
      actions={
        choices.length > 0 ? (
          <ChoiceList choices={choices} onChoose={onChoose} />
        ) : (
          <button type="button" onClick={onAdvance} className="scenario-action scenario-action--advance">
            Begin
          </button>
        )
      }
    />
  );
}

function ChoiceList({
  choices,
  onChoose,
}: {
  choices: ReadonlyArray<InkChoice>;
  onChoose: (index: number) => void;
}) {
  return (
    <ul className="scenario-choices">
      {choices.map((c) => (
        <li key={c.index}>
          <button
            type="button"
            onClick={() => onChoose(c.index)}
            className="scenario-action scenario-action--choice"
          >
            {c.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
