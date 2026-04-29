import type { InkLine } from '@engine/narrative';
import type { ResolvedLoop } from '@engine/scenario';
import { PhaseShell } from './PhaseShell';

export type SimEpisodeViewProps = {
  lines: ReadonlyArray<InkLine>;
  resolved: ResolvedLoop;
  onAdvance: () => void;
};

/**
 * Walking-skeleton sim view. The real 3D scene + bird-card UX is per-scenario
 * work (bd-scen.1+). This shell renders the resolved interaction targets so
 * the rung overrides are observable end-to-end.
 */
export function SimEpisodeView({ lines, resolved, onAdvance }: SimEpisodeViewProps) {
  const sim = resolved.sim_episode;
  // Targets after rung override: prefer top-level override key, fall back to
  // the first interaction's targets_from_species.
  const targets = readTargets(sim);

  return (
    <PhaseShell
      phase="sim_episode"
      title="Sim"
      lines={lines}
      actions={
        <button
          type="button"
          onClick={onAdvance}
          className="scenario-action scenario-action--advance"
        >
          Done with sim
        </button>
      }
    >
      <ul className="scenario-sim-targets" aria-label="Sim targets">
        {targets.map((t) => (
          <li key={t} className="scenario-sim-target">
            {t}
          </li>
        ))}
      </ul>
    </PhaseShell>
  );
}

function readTargets(sim: ResolvedLoop['sim_episode']): string[] {
  const override = (sim as Record<string, unknown>)['targets_from_species'];
  if (Array.isArray(override)) return override as string[];
  const first = sim.interactions[0];
  return first ? [...first.targets_from_species] : [];
}
