import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createKvStore } from '@engine/storage';
import type { KvStore } from '@engine/storage';
import { createLoopRuntime } from './createLoopRuntime';
import { currentPhase, isPaused } from './loopMachine';

let kv: KvStore | null = null;

afterEach(async () => {
  if (kv) await kv.clear();
  kv = null;
});

function makeKv(): KvStore {
  const store = createKvStore(`loop-test-${Math.random().toString(36).slice(2)}`);
  kv = store;
  return store;
}

describe('createLoopRuntime — acceptance: pause + force-kill + resume', () => {
  it('resumes from the exact same paused state after a fresh actor instance', async () => {
    const kv = makeKv();
    const opts = {
      kv,
      scenarioId: 'window-watch',
      ageRung: '7-8' as const,
      mode: 'mentor_apprentice' as const,
    };

    // Session 1: advance into sim_episode, capture some context, pause.
    const r1 = await createLoopRuntime(opts);
    r1.send({ type: 'ADVANCE' }); // brief -> sim_episode
    r1.send({ type: 'PAUSE' });
    await r1.flush();
    expect(currentPhase(r1.getSnapshot().value)).toBe('sim_episode');
    expect(isPaused(r1.getSnapshot().value)).toBe(true);
    r1.destroy();

    // Session 2: simulate a fresh app boot — same kv, same key.
    const r2 = await createLoopRuntime(opts);
    expect(r2.getSnapshot().value).toEqual({ running: { sim_episode: 'paused' } });
    expect(currentPhase(r2.getSnapshot().value)).toBe('sim_episode');
    expect(isPaused(r2.getSnapshot().value)).toBe(true);
    r2.destroy();
  });

  it('preserves context across a kill + restore cycle', async () => {
    const kv = makeKv();
    const opts = {
      kv,
      scenarioId: 'window-watch',
      ageRung: '9-10' as const,
      mode: 'solo' as const,
    };

    const r1 = await createLoopRuntime(opts);
    r1.send({ type: 'ADVANCE' }); // sim_episode
    r1.send({ type: 'ADVANCE' }); // field_activity
    r1.send({ type: 'PHOTO_CAPTURED', path: 'photos/2026-04-28/robin.bin' });
    r1.send({ type: 'ADVANCE' }); // re_encoding
    r1.send({ type: 'ADVANCE' }); // reflection
    r1.send({ type: 'RECORD_REFLECTION', promptKind: 'favorite_of_encountered', answer: 'robin' });
    r1.send({ type: 'PAUSE' });
    await r1.flush();
    r1.destroy();

    const r2 = await createLoopRuntime(opts);
    const ctx = r2.getSnapshot().context;
    expect(currentPhase(r2.getSnapshot().value)).toBe('reflection');
    expect(isPaused(r2.getSnapshot().value)).toBe(true);
    expect(ctx.photoBlobPath).toBe('photos/2026-04-28/robin.bin');
    expect(ctx.reflectionAnswers).toEqual({ favorite_of_encountered: 'robin' });
    r2.destroy();
  });

  it('starts fresh when no persisted snapshot exists for the scenario', async () => {
    const kv = makeKv();
    const r = await createLoopRuntime({
      kv,
      scenarioId: 'fresh-scenario',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
    });
    expect(r.getSnapshot().value).toEqual({ running: { brief: 'active' } });
    r.destroy();
  });

  it('different scenarios have independent persisted state', async () => {
    const kv = makeKv();
    const r1 = await createLoopRuntime({
      kv,
      scenarioId: 'scenario-a',
      ageRung: '7-8',
      mode: 'solo',
    });
    r1.send({ type: 'ADVANCE' });
    r1.send({ type: 'ADVANCE' });
    await r1.flush();
    r1.destroy();

    const rb = await createLoopRuntime({
      kv,
      scenarioId: 'scenario-b',
      ageRung: '7-8',
      mode: 'solo',
    });
    expect(currentPhase(rb.getSnapshot().value)).toBe('brief');
    rb.destroy();
  });

  it('clearPersisted wipes the snapshot so the next runtime starts fresh', async () => {
    const kv = makeKv();
    const opts = {
      kv,
      scenarioId: 'window-watch',
      ageRung: '7-8' as const,
      mode: 'solo' as const,
    };
    const r1 = await createLoopRuntime(opts);
    r1.send({ type: 'ADVANCE' });
    await r1.flush();
    await r1.clearPersisted();
    r1.destroy();

    const r2 = await createLoopRuntime(opts);
    expect(currentPhase(r2.getSnapshot().value)).toBe('brief');
    r2.destroy();
  });

  it('persists final states (complete) and round-trips', async () => {
    const kv = makeKv();
    const opts = {
      kv,
      scenarioId: 'finished',
      ageRung: '11-12' as const,
      mode: 'solo' as const,
    };
    const r1 = await createLoopRuntime(opts);
    for (let i = 0; i < 5; i++) r1.send({ type: 'ADVANCE' });
    expect(r1.getSnapshot().value).toBe('complete');
    expect(r1.getSnapshot().status).toBe('done');
    await r1.flush();
    r1.destroy();

    const r2 = await createLoopRuntime(opts);
    expect(r2.getSnapshot().value).toBe('complete');
    expect(r2.getSnapshot().status).toBe('done');
    r2.destroy();
  });
});
