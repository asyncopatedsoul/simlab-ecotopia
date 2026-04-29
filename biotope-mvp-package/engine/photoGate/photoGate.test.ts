import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlobStore } from '@engine/storage/blobs';
import { createKvStore } from '@engine/storage/kv';
import type { BlobStore, KvStore } from '@engine/storage';
import type { CapturedPhoto } from '@engine/camera';
import { createPhotoGate } from './photoGate';
import type { GateContext, PendingPhotoEntry } from './types';

// ── In-memory BlobStore (jsdom has no OPFS) ────────────────────────────────

function inMemoryBlobs(): BlobStore & { _entries: Map<string, Blob> } {
  const entries = new Map<string, Blob>();
  return {
    _entries: entries,
    async put(path, data) {
      const blob =
        data instanceof Blob
          ? data
          : data instanceof ArrayBuffer
            ? new Blob([data])
            : new Blob([new Uint8Array(data.buffer, data.byteOffset, data.byteLength)]);
      entries.set(path, blob);
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

void createBlobStore; // imported for shape match; we use the in-memory fake here

function makePhoto(path: string, capturedAt = 1714867200000): CapturedPhoto {
  return {
    path,
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    width: 1600,
    height: 900,
    capturedAt,
  };
}

function makeKv(): KvStore {
  return createKvStore(`photo-gate-test-${Math.random().toString(36).slice(2)}`);
}

// ── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shouldGate — gating policy', () => {
  const baseCtx = (over: Partial<GateContext> = {}): GateContext => ({
    scenarioId: 'window-watch',
    ageRung: '7-8',
    mode: 'mentor_apprentice',
    manifestPhotoGate: true,
    ...over,
  });

  it('never gates in solo mode regardless of age or manifest', () => {
    const gate = createPhotoGate({ kv: makeKv(), blobs: inMemoryBlobs() });
    expect(gate.shouldGate(baseCtx({ mode: 'solo', ageRung: '5-6' }))).toBe(false);
    expect(
      gate.shouldGate(baseCtx({ mode: 'solo', ageRung: '11-12', manifestPhotoGate: true })),
    ).toBe(false);
  });

  it('forces gating ON for ages 5-6 and 7-8 in mentor_apprentice mode (overrides manifest)', () => {
    const gate = createPhotoGate({ kv: makeKv(), blobs: inMemoryBlobs() });
    for (const rung of ['5-6', '7-8'] as const) {
      expect(gate.shouldGate(baseCtx({ ageRung: rung, manifestPhotoGate: false }))).toBe(true);
      expect(gate.shouldGate(baseCtx({ ageRung: rung, manifestPhotoGate: true }))).toBe(true);
      expect(gate.shouldGate(baseCtx({ ageRung: rung, manifestPhotoGate: null }))).toBe(true);
    }
  });

  it('respects the manifest setting for ages 9-10 and 11-12', () => {
    const gate = createPhotoGate({ kv: makeKv(), blobs: inMemoryBlobs() });
    for (const rung of ['9-10', '11-12'] as const) {
      expect(gate.shouldGate(baseCtx({ ageRung: rung, manifestPhotoGate: true }))).toBe(true);
      expect(gate.shouldGate(baseCtx({ ageRung: rung, manifestPhotoGate: false }))).toBe(false);
      expect(gate.shouldGate(baseCtx({ ageRung: rung, manifestPhotoGate: null }))).toBe(false);
    }
  });
});

describe('submit — pending vs immediate', () => {
  it('submits a pending photo when gating is required and notifies listeners', async () => {
    const blobs = inMemoryBlobs();
    const gate = createPhotoGate({ kv: makeKv(), blobs });
    const seen: PendingPhotoEntry[] = [];
    gate.onPending((e) => seen.push(e));

    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: false,
    };
    const photo = makePhoto('photos/window-watch/100.jpg', 100);
    await blobs.put(photo.path, photo.blob);
    const out = await gate.submit(photo, ctx);
    expect(out.state).toBe('pending');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ path: photo.path, scenarioId: 'window-watch', ageRung: '5-6' });
  });

  it('returns confirmed (and fires onConfirmed) when gating is not required', async () => {
    const gate = createPhotoGate({ kv: makeKv(), blobs: inMemoryBlobs() });
    const pending: PendingPhotoEntry[] = [];
    const confirmed: PendingPhotoEntry[] = [];
    gate.onPending((e) => pending.push(e));
    gate.onConfirmed((e) => confirmed.push(e));

    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '11-12',
      mode: 'solo',
      manifestPhotoGate: null,
    };
    const out = await gate.submit(makePhoto('photos/window-watch/100.jpg'), ctx);
    expect(out.state).toBe('confirmed');
    expect(pending).toEqual([]);
    expect(confirmed).toHaveLength(1);
  });
});

describe('confirm + discard — acceptance flow', () => {
  it('on confirm: photo flows (onConfirmed fires); blob stays in OPFS', async () => {
    const blobs = inMemoryBlobs();
    const gate = createPhotoGate({ kv: makeKv(), blobs });
    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: true,
    };
    const photo = makePhoto('photos/window-watch/100.jpg', 100);
    await blobs.put(photo.path, photo.blob);
    await gate.submit(photo, ctx);

    const confirmed: PendingPhotoEntry[] = [];
    gate.onConfirmed((e) => confirmed.push(e));
    await gate.confirm(photo.path);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]?.path).toBe(photo.path);

    // Blob still present in OPFS — re-encoding can pick it up.
    expect(blobs._entries.has(photo.path)).toBe(true);
    // Pending list is empty.
    expect(await gate.listPending()).toEqual([]);
  });

  it('on discard: photo is purged from OPFS and onDiscarded fires', async () => {
    const blobs = inMemoryBlobs();
    const gate = createPhotoGate({ kv: makeKv(), blobs });
    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: true,
    };
    const photo = makePhoto('photos/window-watch/100.jpg', 100);
    await blobs.put(photo.path, photo.blob);
    await gate.submit(photo, ctx);

    const discarded: string[] = [];
    gate.onDiscarded((p) => discarded.push(p));
    await gate.discard(photo.path);
    expect(discarded).toEqual([photo.path]);

    // Blob purged from OPFS.
    expect(blobs._entries.has(photo.path)).toBe(false);
    expect(await gate.listPending()).toEqual([]);
  });

  it('confirm and discard are idempotent', async () => {
    const gate = createPhotoGate({ kv: makeKv(), blobs: inMemoryBlobs() });
    await expect(gate.confirm('photos/never/exists.jpg')).resolves.toBeUndefined();
    await expect(gate.discard('photos/never/exists.jpg')).resolves.toBeUndefined();
  });
});

describe('listPending — survives across instances (resume)', () => {
  it('returns pending entries after a fresh gate instance reads the same kv', async () => {
    const blobs = inMemoryBlobs();
    const dbName = `photo-gate-test-${Math.random().toString(36).slice(2)}`;
    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: true,
    };

    // Session 1: capture two photos, leave them pending.
    const g1 = createPhotoGate({ kv: createKvStore(dbName), blobs });
    await g1.submit(makePhoto('photos/window-watch/100.jpg', 100), ctx);
    await g1.submit(makePhoto('photos/window-watch/200.jpg', 200), ctx);

    // Session 2: fresh kv handle to the SAME backing DB.
    const g2 = createPhotoGate({ kv: createKvStore(dbName), blobs });
    const pending = await g2.listPending();
    expect(pending.map((p) => p.path)).toEqual([
      'photos/window-watch/100.jpg',
      'photos/window-watch/200.jpg',
    ]);
  });
});

describe('multi-photo overlap', () => {
  it('multiple pending photos can be confirmed/discarded independently', async () => {
    const blobs = inMemoryBlobs();
    const gate = createPhotoGate({ kv: makeKv(), blobs });
    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: true,
    };

    const a = makePhoto('photos/window-watch/100.jpg', 100);
    const b = makePhoto('photos/window-watch/200.jpg', 200);
    await blobs.put(a.path, a.blob);
    await blobs.put(b.path, b.blob);
    await gate.submit(a, ctx);
    await gate.submit(b, ctx);

    await gate.confirm(a.path);
    await gate.discard(b.path);

    expect(blobs._entries.has(a.path)).toBe(true);
    expect(blobs._entries.has(b.path)).toBe(false);
    expect(await gate.listPending()).toEqual([]);
  });
});
