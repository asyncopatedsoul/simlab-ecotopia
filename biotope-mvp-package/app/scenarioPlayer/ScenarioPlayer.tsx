import type { AgeRung, Mode } from '@engine/manifest';
import type { Phase } from '@engine/runtime';
import type { ScenarioSource } from '@engine/scenario';
import type { KvStore } from '@engine/storage';
import { MentorOverlay } from './MentorOverlay';
import { BriefView } from './phases/BriefView';
import { FieldActivityView } from './phases/FieldActivityView';
import { ReEncodingView } from './phases/ReEncodingView';
import { ReflectionView } from './phases/ReflectionView';
import { SimEpisodeView } from './phases/SimEpisodeView';
import { useScenarioPlayer } from './useScenarioPlayer';

export type ScenarioPlayerProps = {
  scenarioId: string;
  ageRung: AgeRung;
  mode: Mode;
  source: ScenarioSource;
  kv: KvStore;
};

export function ScenarioPlayer(props: ScenarioPlayerProps) {
  const state = useScenarioPlayer(props);

  if (state.error) {
    return (
      <main className="scenario-player scenario-player--error">
        <h1>Couldn't load this scenario</h1>
        <p>{state.error.message}</p>
      </main>
    );
  }
  if (state.loading || !state.bundle || !state.resolved) {
    return (
      <main className="scenario-player scenario-player--loading">
        <p>Loading…</p>
      </main>
    );
  }
  if (state.done) {
    const next = state.resolved.reflection.unlocks.next_scenario;
    return (
      <main className="scenario-player scenario-player--complete">
        <h1>Done!</h1>
        <p>Next time: {next}</p>
      </main>
    );
  }

  return (
    <main
      className="scenario-player"
      data-mode={props.mode}
      data-rung={props.ageRung}
      data-phase={state.phase ?? 'idle'}
    >
      <header className="scenario-player__chrome">
        <h1 className="scenario-player__title">{state.bundle.manifest.title}</h1>
        <span className="scenario-player__rung">{props.ageRung}</span>
      </header>
      {renderPhase(state.phase, state)}
      {props.mode === 'mentor_apprentice' && state.bundle ? (
        <MentorOverlay bundle={state.bundle} phase={state.phase} />
      ) : null}
    </main>
  );
}

function renderPhase(phase: Phase | null, state: ReturnType<typeof useScenarioPlayer>) {
  if (!state.resolved || !phase) return null;
  const advance = () => state.send({ type: 'ADVANCE' });
  switch (phase) {
    case 'brief':
      return (
        <BriefView
          lines={state.lines}
          choices={state.choices}
          resolved={state.resolved}
          onChoose={state.choose}
          onAdvance={advance}
        />
      );
    case 'sim_episode':
      return (
        <SimEpisodeView
          lines={state.lines}
          resolved={state.resolved}
          onAdvance={advance}
        />
      );
    case 'field_activity':
      return (
        <FieldActivityView
          lines={state.lines}
          resolved={state.resolved}
          onAdvance={advance}
        />
      );
    case 're_encoding':
      return (
        <ReEncodingView
          lines={state.lines}
          resolved={state.resolved}
          onAdvance={advance}
        />
      );
    case 'reflection':
      return (
        <ReflectionView
          lines={state.lines}
          resolved={state.resolved}
          onAdvance={advance}
          onRecord={(promptKind, answer) =>
            state.send({ type: 'RECORD_REFLECTION', promptKind, answer })
          }
        />
      );
  }
}
