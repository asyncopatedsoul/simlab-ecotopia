import { assign, setup } from 'xstate';
import type { AgeRung, Mode } from '@engine/manifest';

/**
 * Five-phase scenario loop, per docs/biotope-design.md §1 and the manifest's
 * `loop:` block (docs/biotope-mvp-planning.md §2). This machine is the
 * structural skeleton. Phase contents (Ink narrative, R3F sim, photo capture)
 * are wired in by downstream issues:
 *   - bd-rntm.5 (narrative)
 *   - bd-engn.* (rendering)
 *   - bd-flda.* (camera + capture)
 *
 * Each phase has substates `active` and `paused`. PAUSE / RESUME stay within
 * the same phase. ADVANCE moves to the next phase. ABORT terminates from
 * anywhere. The machine is JSON-serializable end-to-end so XState's built-in
 * persistence (getPersistedSnapshot / restore via actor input.snapshot)
 * round-trips through Dexie.
 */

export type LoopInput = {
  scenarioId: string;
  ageRung: AgeRung;
  mode: Mode;
  /** Optional clock injection for deterministic tests. Defaults to Date.now. */
  now?: () => number;
};

export type LoopContext = {
  scenarioId: string;
  ageRung: AgeRung;
  mode: Mode;
  startedAt: number;
  enteredPhaseAt: number;
  /** Path under storage.blobs where the field photo (if any) was written. */
  photoBlobPath: string | null;
  /** Reflection prompt answers, keyed by prompt.kind. */
  reflectionAnswers: Record<string, unknown>;
};

export type LoopEvent =
  | { type: 'ADVANCE' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'ABORT' }
  | { type: 'PHOTO_CAPTURED'; path: string }
  | { type: 'RECORD_REFLECTION'; promptKind: string; answer: unknown };

export type Phase = 'brief' | 'sim_episode' | 'field_activity' | 're_encoding' | 'reflection';

export const loopMachine = setup({
  types: {
    context: {} as LoopContext,
    events: {} as LoopEvent,
    input: {} as LoopInput,
  },
  actions: {
    enterPhase: assign(({ context }) => ({
      enteredPhaseAt: nowFromContext(context),
    })),
    setPhotoPath: assign({
      photoBlobPath: ({ event }) =>
        event.type === 'PHOTO_CAPTURED' ? event.path : null,
    }),
    recordReflection: assign({
      reflectionAnswers: ({ context, event }) => {
        if (event.type !== 'RECORD_REFLECTION') return context.reflectionAnswers;
        return { ...context.reflectionAnswers, [event.promptKind]: event.answer };
      },
    }),
  },
}).createMachine({
  id: 'loop',
  context: ({ input }) => {
    const now = input.now ?? Date.now;
    const t = now();
    return {
      scenarioId: input.scenarioId,
      ageRung: input.ageRung,
      mode: input.mode,
      startedAt: t,
      enteredPhaseAt: t,
      photoBlobPath: null,
      reflectionAnswers: {},
    };
  },
  initial: 'running',
  on: {
    ABORT: { target: '.aborted' },
  },
  states: {
    running: {
      initial: 'brief',
      states: {
        brief: {
          entry: 'enterPhase',
          initial: 'active',
          states: {
            active: {
              on: {
                PAUSE: 'paused',
                ADVANCE: '#loop.running.sim_episode',
              },
            },
            paused: { on: { RESUME: 'active' } },
          },
        },
        sim_episode: {
          entry: 'enterPhase',
          initial: 'active',
          states: {
            active: {
              on: {
                PAUSE: 'paused',
                ADVANCE: '#loop.running.field_activity',
              },
            },
            paused: { on: { RESUME: 'active' } },
          },
        },
        field_activity: {
          entry: 'enterPhase',
          initial: 'active',
          states: {
            active: {
              on: {
                PAUSE: 'paused',
                ADVANCE: '#loop.running.re_encoding',
                PHOTO_CAPTURED: { actions: 'setPhotoPath' },
              },
            },
            paused: { on: { RESUME: 'active' } },
          },
        },
        re_encoding: {
          entry: 'enterPhase',
          initial: 'active',
          states: {
            active: {
              on: {
                PAUSE: 'paused',
                ADVANCE: '#loop.running.reflection',
              },
            },
            paused: { on: { RESUME: 'active' } },
          },
        },
        reflection: {
          entry: 'enterPhase',
          initial: 'active',
          states: {
            active: {
              on: {
                PAUSE: 'paused',
                ADVANCE: '#loop.complete',
                RECORD_REFLECTION: { actions: 'recordReflection' },
              },
            },
            paused: { on: { RESUME: 'active' } },
          },
        },
      },
    },
    complete: { type: 'final' },
    aborted: { type: 'final' },
  },
});

function nowFromContext(ctx: LoopContext): number {
  // The context doesn't carry the clock injection (it would re-serialize
  // every persist), so we just call Date.now here. enteredPhaseAt is
  // wall-clock anyway — only the initial seeding (in machine.context) reads
  // input.now.
  void ctx;
  return Date.now();
}

/**
 * Read the current top-level phase from a snapshot value. Returns `null` for
 * the `complete` and `aborted` final states.
 */
export function currentPhase(value: unknown): Phase | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as { running?: Record<string, unknown> };
  if (!v.running) return null;
  const keys = Object.keys(v.running);
  return (keys[0] as Phase) ?? null;
}

/** True if the loop is currently in a paused substate of any phase. */
export function isPaused(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { running?: Record<string, string> };
  if (!v.running) return false;
  return Object.values(v.running)[0] === 'paused';
}
