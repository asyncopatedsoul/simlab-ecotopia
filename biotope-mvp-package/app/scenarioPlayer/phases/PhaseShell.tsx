import type { ReactNode } from 'react';
import type { InkLine } from '@engine/narrative';
import type { Phase } from '@engine/runtime';

export type PhaseShellProps = {
  phase: Phase;
  title: string;
  lines: ReadonlyArray<InkLine>;
  /** Children rendered after the lines, before the action row. Phase UI lives here. */
  children?: ReactNode;
  actions?: ReactNode;
};

/**
 * Common chrome for every phase view: phase label, narrator lines, slot for
 * phase-specific UI, action row.
 *
 * Per-scenario tasks (bd-scen.1..5) replace `children` with the real UX for
 * their phase. The shell itself stays minimal — the bd-24w acceptance only
 * requires the phases progress and Ink lines render at each.
 */
export function PhaseShell({ phase, title, lines, children, actions }: PhaseShellProps) {
  return (
    <section
      className="scenario-phase"
      data-phase={phase}
      aria-labelledby={`phase-title-${phase}`}
    >
      <header className="scenario-phase__header">
        <h2 id={`phase-title-${phase}`} className="scenario-phase__title">
          {title}
        </h2>
      </header>
      <div className="scenario-phase__lines" role="log" aria-live="polite">
        {lines.map((line, i) => (
          <p key={i} className="scenario-phase__line">
            {line.text.trim()}
          </p>
        ))}
      </div>
      {children ? <div className="scenario-phase__body">{children}</div> : null}
      {actions ? <div className="scenario-phase__actions">{actions}</div> : null}
    </section>
  );
}
