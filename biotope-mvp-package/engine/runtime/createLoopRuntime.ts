import { createActor, type Actor, type Snapshot } from 'xstate';
import type { KvStore } from '@engine/storage';
import { loopMachine, type LoopInput } from './loopMachine';

export type LoopRuntimeOptions = {
  kv: KvStore;
  /** Storage key for the persisted snapshot. Defaults to `loop:<scenarioId>`. */
  storageKey?: string;
} & LoopInput;

export type LoopRuntime = {
  actor: Actor<typeof loopMachine>;
  send: Actor<typeof loopMachine>['send'];
  getSnapshot: Actor<typeof loopMachine>['getSnapshot'];
  /** Awaits any in-flight save. Useful in tests before tearing down. */
  flush: () => Promise<void>;
  /** Stop the actor and unsubscribe; does not delete the persisted snapshot. */
  destroy: () => void;
  /** Delete the persisted snapshot for this scenario. */
  clearPersisted: () => Promise<void>;
};

/**
 * Build a loop actor wired to a persistent snapshot in `KvStore`. On boot, if
 * a snapshot exists for the scenario, the actor resumes from that exact
 * state — including which phase, paused/active substate, and context (photo
 * path, reflection answers, timestamps). On every transition the snapshot is
 * persisted asynchronously; saves are chained so order is preserved.
 *
 * Persistence uses XState v5's getPersistedSnapshot / restore via the
 * `snapshot` input option to createActor — not a hand-rolled serializer.
 */
export async function createLoopRuntime(options: LoopRuntimeOptions): Promise<LoopRuntime> {
  const { kv, scenarioId, ageRung, mode, now } = options;
  const storageKey = options.storageKey ?? `loop:${scenarioId}`;

  const persisted = await kv.get<Snapshot<unknown>>(storageKey);

  const input: LoopInput = now
    ? { scenarioId, ageRung, mode, now }
    : { scenarioId, ageRung, mode };

  const actor: Actor<typeof loopMachine> = persisted
    ? createActor(loopMachine, { input, snapshot: persisted })
    : createActor(loopMachine, { input });

  let pendingSave: Promise<void> = Promise.resolve();
  const sub = actor.subscribe(() => {
    const snap = actor.getPersistedSnapshot();
    pendingSave = pendingSave.then(() => kv.set(storageKey, snap)).catch(() => {
      /* swallow — caller may inspect via flush() if desired */
    });
  });

  actor.start();
  // Persist initial snapshot too, so a fresh actor that's never advanced is
  // still recoverable.
  pendingSave = pendingSave.then(() => kv.set(storageKey, actor.getPersistedSnapshot()));

  return {
    actor,
    send: actor.send.bind(actor),
    getSnapshot: actor.getSnapshot.bind(actor),
    flush: () => pendingSave,
    destroy: () => {
      sub.unsubscribe();
      actor.stop();
    },
    clearPersisted: async () => {
      await pendingSave;
      await kv.delete(storageKey);
    },
  };
}
