import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { currentPhase, isPaused, loopMachine } from './loopMachine';

function startActor() {
  const actor = createActor(loopMachine, {
    input: { scenarioId: 'window-watch', ageRung: '7-8', mode: 'mentor_apprentice' },
  });
  actor.start();
  return actor;
}

describe('loopMachine — happy path', () => {
  it('starts in running.brief.active', () => {
    const a = startActor();
    expect(a.getSnapshot().value).toEqual({ running: { brief: 'active' } });
    expect(currentPhase(a.getSnapshot().value)).toBe('brief');
    expect(isPaused(a.getSnapshot().value)).toBe(false);
  });

  it('walks all five phases via ADVANCE and reaches complete', () => {
    const a = startActor();
    a.send({ type: 'ADVANCE' });
    expect(currentPhase(a.getSnapshot().value)).toBe('sim_episode');
    a.send({ type: 'ADVANCE' });
    expect(currentPhase(a.getSnapshot().value)).toBe('field_activity');
    a.send({ type: 'ADVANCE' });
    expect(currentPhase(a.getSnapshot().value)).toBe('re_encoding');
    a.send({ type: 'ADVANCE' });
    expect(currentPhase(a.getSnapshot().value)).toBe('reflection');
    a.send({ type: 'ADVANCE' });
    expect(a.getSnapshot().value).toBe('complete');
    expect(a.getSnapshot().status).toBe('done');
  });

  it('records context fields on entry', () => {
    const a = startActor();
    const ctx = a.getSnapshot().context;
    expect(ctx.scenarioId).toBe('window-watch');
    expect(ctx.ageRung).toBe('7-8');
    expect(ctx.mode).toBe('mentor_apprentice');
    expect(ctx.photoBlobPath).toBeNull();
    expect(ctx.reflectionAnswers).toEqual({});
    expect(typeof ctx.startedAt).toBe('number');
  });
});

describe('loopMachine — pause/resume', () => {
  it('PAUSE moves the current phase to paused; RESUME restores', () => {
    const a = startActor();
    a.send({ type: 'ADVANCE' }); // -> sim_episode
    a.send({ type: 'PAUSE' });
    expect(a.getSnapshot().value).toEqual({ running: { sim_episode: 'paused' } });
    expect(isPaused(a.getSnapshot().value)).toBe(true);
    a.send({ type: 'RESUME' });
    expect(a.getSnapshot().value).toEqual({ running: { sim_episode: 'active' } });
  });

  it('ADVANCE is ignored while paused', () => {
    const a = startActor();
    a.send({ type: 'PAUSE' });
    a.send({ type: 'ADVANCE' });
    expect(a.getSnapshot().value).toEqual({ running: { brief: 'paused' } });
  });

  it('PAUSE is idempotent (no-op when already paused)', () => {
    const a = startActor();
    a.send({ type: 'PAUSE' });
    const before = a.getSnapshot().value;
    a.send({ type: 'PAUSE' });
    expect(a.getSnapshot().value).toEqual(before);
  });
});

describe('loopMachine — abort', () => {
  it('ABORT from any phase reaches the aborted final state', () => {
    for (let i = 0; i < 5; i++) {
      const a = startActor();
      for (let j = 0; j < i; j++) a.send({ type: 'ADVANCE' });
      a.send({ type: 'ABORT' });
      expect(a.getSnapshot().value).toBe('aborted');
      expect(a.getSnapshot().status).toBe('done');
    }
  });

  it('ABORT works even from a paused phase', () => {
    const a = startActor();
    a.send({ type: 'ADVANCE' });
    a.send({ type: 'PAUSE' });
    a.send({ type: 'ABORT' });
    expect(a.getSnapshot().value).toBe('aborted');
  });
});

describe('loopMachine — phase-specific events', () => {
  it('PHOTO_CAPTURED only updates context during field_activity', () => {
    const a = startActor();
    a.send({ type: 'PHOTO_CAPTURED', path: 'photos/test.bin' });
    // Before field_activity: ignored.
    expect(a.getSnapshot().context.photoBlobPath).toBeNull();

    a.send({ type: 'ADVANCE' }); // sim_episode
    a.send({ type: 'ADVANCE' }); // field_activity
    a.send({ type: 'PHOTO_CAPTURED', path: 'photos/real.bin' });
    expect(a.getSnapshot().context.photoBlobPath).toBe('photos/real.bin');
  });

  it('RECORD_REFLECTION only updates context during reflection', () => {
    const a = startActor();
    a.send({ type: 'RECORD_REFLECTION', promptKind: 'favorite_of_encountered', answer: 'robin' });
    expect(a.getSnapshot().context.reflectionAnswers).toEqual({});

    for (let i = 0; i < 4; i++) a.send({ type: 'ADVANCE' });
    expect(currentPhase(a.getSnapshot().value)).toBe('reflection');

    a.send({ type: 'RECORD_REFLECTION', promptKind: 'favorite_of_encountered', answer: 'robin' });
    a.send({ type: 'RECORD_REFLECTION', promptKind: 'where_seen', answer: 'on_fence' });
    expect(a.getSnapshot().context.reflectionAnswers).toEqual({
      favorite_of_encountered: 'robin',
      where_seen: 'on_fence',
    });
  });
});
