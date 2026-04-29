import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKvStore } from '@engine/storage';
import type { BlobStore, KvStore } from '@engine/storage';
import { createDataDeletion } from './dataDeletion';
import { DEFAULT_COOLING_OFF_DAYS } from './types';

function inMemoryBlobs(): BlobStore & { _entries: Map<string, Blob> } {
  const entries = new Map<string, Blob>();
  return {
    _entries: entries,
    async put(path, data) {
      entries.set(path, data instanceof Blob ? data : new Blob([data as ArrayBuffer]));
    },
    async get(path) {
      return entries.get(path);
    },
    async delete(path) {
      entries.delete(path);
    },
    async list() {
      return [...entries.keys()];
    },
    async bytesUsed() {
      let n = 0;
      for (const b of entries.values()) n += b.size;
      return n;
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

let kv: KvStore;
beforeEach(() => {
  kv = createKvStore(`dd-test-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await kv.clear();
  vi.restoreAllMocks();
});

describe('dataDeletion — schedule + cancel', () => {
  it('starts in inactive state', async () => {
    const dd = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    expect(await dd.status()).toEqual({ state: 'inactive' });
  });

  it('schedule sets pending state with executeAfter = now + 7 days (default)', async () => {
    const blobs = inMemoryBlobs();
    const nowMs = 1_000_000;
    const dd = createDataDeletion({ kv, blobs, now: () => nowMs });
    const status = await dd.schedule();
    expect(status.state).toBe('pending');
    if (status.state !== 'pending') return;
    expect(status.scheduledAt).toBe(1_000_000);
    expect(status.executeAfter).toBe(1_000_000 + DEFAULT_COOLING_OFF_DAYS * DAY_MS);
  });

  it('schedule honors custom coolingOffMs (test seam)', async () => {
    const nowMs = 100;
    const dd = createDataDeletion({ kv, blobs: inMemoryBlobs(), now: () => nowMs });
    const status = await dd.schedule({ coolingOffMs: 60_000 });
    if (status.state !== 'pending') throw new Error('expected pending');
    expect(status.executeAfter).toBe(100 + 60_000);
  });

  it('cancel returns to inactive', async () => {
    const dd = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    await dd.schedule();
    expect((await dd.status()).state).toBe('pending');
    await dd.cancel();
    expect(await dd.status()).toEqual({ state: 'inactive' });
  });

  it('cancel is idempotent', async () => {
    const dd = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    await expect(dd.cancel()).resolves.toBeUndefined();
    await expect(dd.cancel()).resolves.toBeUndefined();
  });

  it('persists schedule across instances (resume after app restart)', async () => {
    const blobs = inMemoryBlobs();
    const nowMs = 5000;
    const dd1 = createDataDeletion({ kv, blobs, now: () => nowMs });
    await dd1.schedule({ coolingOffMs: 1000 });

    // Fresh instance, same kv.
    const dd2 = createDataDeletion({ kv, blobs, now: () => nowMs });
    const status = await dd2.status();
    expect(status.state).toBe('pending');
    if (status.state !== 'pending') return;
    expect(status.executeAfter).toBe(5000 + 1000);
  });
});

describe('dataDeletion — sweepIfDue (acceptance: irreversible after 7 days)', () => {
  it('returns null if nothing scheduled', async () => {
    const dd = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    expect(await dd.sweepIfDue()).toBeNull();
  });

  it('returns null if scheduled but cooling-off has not elapsed', async () => {
    let nowMs = 0;
    const blobs = inMemoryBlobs();
    blobs._entries.set('photos/a.jpg', new Blob(['x']));
    const dd = createDataDeletion({ kv, blobs, now: () => nowMs });
    await dd.schedule({ coolingOffMs: 60_000 });
    nowMs = 30_000;
    expect(await dd.sweepIfDue()).toBeNull();
    // Photo still there.
    expect(blobs._entries.has('photos/a.jpg')).toBe(true);
  });

  it('wipes blobs + kv when cooling-off has elapsed', async () => {
    let nowMs = 0;
    const blobs = inMemoryBlobs();
    blobs._entries.set('photos/a.jpg', new Blob(['x']));
    blobs._entries.set('photos/b.jpg', new Blob(['y']));
    blobs._entries.set('audio/clip.opus', new Blob(['z']));
    await kv.set('progress', { scenario: 'window-watch' });
    const dd = createDataDeletion({ kv, blobs, now: () => nowMs });
    await dd.schedule({ coolingOffMs: 60_000 });
    nowMs = 60_001;
    const result = await dd.sweepIfDue();
    expect(result).not.toBeNull();
    expect(result!.blobsDeleted).toBe(3);
    expect(result!.kvCleared).toBe(true);
    expect(blobs._entries.size).toBe(0);
    expect(await kv.get('progress')).toBeUndefined();
    // Schedule itself wiped — next launch finds nothing pending.
    expect(await dd.status()).toEqual({ state: 'inactive' });
  });

  it('idempotent: a second sweep after success returns null', async () => {
    const nowMs = 0;
    const blobs = inMemoryBlobs();
    blobs._entries.set('photos/a.jpg', new Blob(['x']));
    const dd = createDataDeletion({ kv, blobs, now: () => nowMs });
    await dd.schedule({ coolingOffMs: 0 });
    expect(await dd.sweepIfDue()).not.toBeNull();
    expect(await dd.sweepIfDue()).toBeNull();
  });

  it('cancel before deadline blocks the sweep', async () => {
    let nowMs = 0;
    const blobs = inMemoryBlobs();
    blobs._entries.set('photos/a.jpg', new Blob(['x']));
    const dd = createDataDeletion({ kv, blobs, now: () => nowMs });
    await dd.schedule({ coolingOffMs: 60_000 });
    nowMs = 30_000;
    await dd.cancel();
    nowMs = 60_001;
    expect(await dd.sweepIfDue()).toBeNull();
    expect(blobs._entries.size).toBe(1);
  });

  it('passes through species DB clear when species is provided', async () => {
    const nowMs = 0;
    const exec = vi.fn(async () => {});
    const dd = createDataDeletion({
      kv,
      blobs: inMemoryBlobs(),
      species: { exec },
      now: () => nowMs,
    });
    await dd.schedule({ coolingOffMs: 0 });
    const result = await dd.sweepIfDue();
    expect(result?.speciesDbCleared).toBe(true);
    expect(exec).toHaveBeenCalled();
  });
});
