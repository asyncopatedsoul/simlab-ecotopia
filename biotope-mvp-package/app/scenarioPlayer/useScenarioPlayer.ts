import { useEffect, useRef, useState } from 'react';
import {
  createInkRuntime,
  type InkChoice,
  type InkLine,
  type InkRuntime,
} from '@engine/narrative';
import {
  loadScenario,
  resolveRungOverrides,
  type ResolvedLoop,
  type ScenarioBundle,
  type ScenarioSource,
} from '@engine/scenario';
import {
  createLoopRuntime,
  currentPhase,
  isPaused,
  type LoopEvent,
  type LoopRuntime,
  type Phase,
} from '@engine/runtime';
import type { AgeRung, Mode } from '@engine/manifest';
import type { KvStore } from '@engine/storage';

export type UseScenarioPlayerInput = {
  scenarioId: string;
  ageRung: AgeRung;
  mode: Mode;
  source: ScenarioSource;
  kv: KvStore;
};

export type ScenarioPlayerState = {
  loading: boolean;
  error: Error | null;
  bundle: ScenarioBundle | null;
  resolved: ResolvedLoop | null;
  phase: Phase | null;
  paused: boolean;
  done: boolean;
  /** Lines the Ink runtime emitted since entering the current phase node. */
  lines: ReadonlyArray<InkLine>;
  choices: ReadonlyArray<InkChoice>;
  send: (event: LoopEvent) => void;
  /** Pick an Ink choice; advances story flow without sending a loop event. */
  choose: (index: number) => void;
};

/**
 * One hook drives a scenario from id to completion. It:
 *   - loads the bundle (manifest + compiled Ink)
 *   - resolves skill_rung_overrides for the chosen ageRung
 *   - boots a persistent loop runtime keyed by scenarioId
 *   - boots an InkRuntime and routes it to the current phase's narrative_node
 *   - re-routes the InkRuntime when the phase advances
 *
 * The hook does NOT render anything; it surfaces all the state phase views
 * need. Phase views are stateless presentations of (phase, lines, choices,
 * send).
 */
export function useScenarioPlayer(input: UseScenarioPlayerInput): ScenarioPlayerState {
  const [bundle, setBundle] = useState<ScenarioBundle | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [lines, setLines] = useState<ReadonlyArray<InkLine>>([]);
  const [choices, setChoices] = useState<ReadonlyArray<InkChoice>>([]);
  const runtimeRef = useRef<LoopRuntime | null>(null);
  const inkRef = useRef<InkRuntime | null>(null);
  const visitedNodeRef = useRef<string | null>(null);

  // Load the bundle once per (scenarioId, source) pair.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBundle(null);
    loadScenario(input.scenarioId, input.source)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [input.scenarioId, input.source]);

  // Boot loop runtime + ink runtime once the bundle is ready. Tear down on
  // unmount or when the scenario / mode / rung changes.
  useEffect(() => {
    if (!bundle) return undefined;
    let cancelled = false;
    let unsubLoop: (() => void) | undefined;
    let runtimeLocal: LoopRuntime | null = null;

    (async () => {
      const runtime = await createLoopRuntime({
        kv: input.kv,
        scenarioId: input.scenarioId,
        ageRung: input.ageRung,
        mode: input.mode,
      });
      if (cancelled) {
        runtime.destroy();
        return;
      }
      runtimeRef.current = runtime;
      runtimeLocal = runtime;

      const ink = createInkRuntime({ storyJson: bundle.storyJson });
      inkRef.current = ink;

      const sub = runtime.actor.subscribe((snap) => {
        const ph = currentPhase(snap.value);
        const isDone = snap.status === 'done';
        setPhase(ph);
        setPaused(isPaused(snap.value));
        setDone(isDone);
      });
      unsubLoop = () => sub.unsubscribe();

      // Initial sync — XState may have already produced a snapshot before
      // subscribe() returned.
      const snap = runtime.getSnapshot();
      setPhase(currentPhase(snap.value));
      setPaused(isPaused(snap.value));
      setDone(snap.status === 'done');
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
    });

    return () => {
      cancelled = true;
      unsubLoop?.();
      runtimeLocal?.destroy();
      runtimeRef.current = null;
      inkRef.current = null;
      visitedNodeRef.current = null;
    };
  }, [bundle, input.kv, input.scenarioId, input.ageRung, input.mode]);

  // When the phase changes, route the Ink runtime to that phase's narrative
  // node and pull all available lines + any choice point.
  useEffect(() => {
    const ink = inkRef.current;
    if (!bundle || !ink || !phase) return;
    const node = nodeForPhase(bundle, phase, input.ageRung);
    if (!node || node === visitedNodeRef.current) return;
    visitedNodeRef.current = node;
    try {
      ink.goTo(node);
      const newLines = ink.continueMaximally();
      setLines(newLines);
      setChoices(ink.choices());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [bundle, phase, input.ageRung]);

  const send = (event: LoopEvent) => {
    runtimeRef.current?.send(event);
  };
  const choose = (index: number) => {
    const ink = inkRef.current;
    if (!ink) return;
    try {
      ink.choose(index);
      const newLines = ink.continueMaximally();
      setLines((prev) => [...prev, ...newLines]);
      setChoices(ink.choices());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const resolved = bundle ? resolveRungOverrides(bundle.manifest, input.ageRung) : null;

  return {
    loading: bundle === null && error === null,
    error,
    bundle,
    resolved,
    phase,
    paused,
    done,
    lines,
    choices,
    send,
    choose,
  };
}

function nodeForPhase(bundle: ScenarioBundle, phase: Phase, ageRung: AgeRung): string | null {
  const resolved = resolveRungOverrides(bundle.manifest, ageRung);
  switch (phase) {
    case 'brief':
      return resolved.brief.narrative_node;
    case 'sim_episode':
      // Sim has no top-level narrative_node (it's interaction-driven);
      // fall back to brief's so the player still has something to render.
      return resolved.brief.narrative_node;
    case 'field_activity':
      return resolved.field_activity.instruction_node;
    case 're_encoding':
      // Default to the no-observation node; views that have a real outcome
      // route through reEncoder and update from there.
      return resolved.re_encoding.sim_response.on_no_observation;
    case 'reflection':
      return resolved.reflection.narrative_node;
  }
}
