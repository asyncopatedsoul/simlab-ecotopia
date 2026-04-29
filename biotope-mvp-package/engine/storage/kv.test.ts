import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKvStore } from './kv';
import type { KvStore } from './types';

describe('KV store', () => {
  let store: KvStore;
  let dbName: string;

  beforeEach(() => {
    dbName = `kv-test-${Math.random().toString(36).slice(2)}`;
    store = createKvStore(dbName);
  });

  afterEach(async () => {
    await store.clear();
  });

  it('round-trips primitive and object values', async () => {
    await store.set('settings.audio', 0.7);
    await store.set('progress', { scenario: 'window-watch', step: 3 });
    expect(await store.get<number>('settings.audio')).toBe(0.7);
    expect(await store.get('progress')).toEqual({ scenario: 'window-watch', step: 3 });
  });

  it('returns undefined for missing keys', async () => {
    expect(await store.get('nope')).toBeUndefined();
  });

  it('lists keys with a prefix filter', async () => {
    await store.set('scenario.window-watch.unlocked', true);
    await store.set('scenario.bird-hour.unlocked', false);
    await store.set('settings.audio', 0.5);
    const scenarioKeys = await store.keys('scenario.');
    expect(scenarioKeys.sort()).toEqual([
      'scenario.bird-hour.unlocked',
      'scenario.window-watch.unlocked',
    ]);
  });

  it('overwrites existing values on set', async () => {
    await store.set('k', 1);
    await store.set('k', 2);
    expect(await store.get('k')).toBe(2);
  });

  it('deletes are idempotent', async () => {
    await store.delete('never-existed');
    await store.set('k', 1);
    await store.delete('k');
    expect(await store.get('k')).toBeUndefined();
  });
});
