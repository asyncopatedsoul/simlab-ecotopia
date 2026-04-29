import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlobStore } from '@engine/storage';
import { createAssetLoader } from './assetLoader';
import { sha256Hex } from './hash';
import type { BundleFile, BundleManifest } from './types';

// ── In-memory BlobStore ───────────────────────────────────────────────────────

function inMemoryBlobStore(): BlobStore & { _entries: Map<string, Blob> } {
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
    async list(prefix) {
      const out: string[] = [];
      for (const k of entries.keys()) if (!prefix || k.startsWith(prefix)) out.push(k);
      return out;
    },
    async bytesUsed() {
      let total = 0;
      for (const b of entries.values()) total += b.size;
      return total;
    },
  };
}

// ── Synthetic bundle helpers ──────────────────────────────────────────────────

async function buildSyntheticBundle(): Promise<{
  manifest: BundleManifest;
  fetchImpl: typeof fetch;
  fetchSpy: ReturnType<typeof vi.fn>;
  filesByPath: Map<string, Uint8Array<ArrayBuffer>>;
}> {
  const filesByPath = new Map<string, Uint8Array<ArrayBuffer>>();
  const fileSpecs: Array<{ path: string; bytes: Uint8Array<ArrayBuffer> }> = [
    { path: 'scenes/main.glb', bytes: makeBytes(2048, 'a') },
    { path: 'audio/vo/brief.opus', bytes: makeBytes(1024, 'b') },
    { path: 'images/thumb.webp', bytes: makeBytes(512, 'c') },
  ];

  const files: BundleFile[] = [];
  let totalSizeBytes = 0;
  for (const f of fileSpecs) {
    filesByPath.set(f.path, f.bytes);
    const sha256 = await sha256Hex(f.bytes);
    files.push({ path: f.path, sizeBytes: f.bytes.byteLength, sha256 });
    totalSizeBytes += f.bytes.byteLength;
  }
  const manifest: BundleManifest = {
    scenarioId: 'test-scenario',
    version: '1.0.0',
    totalSizeBytes,
    files,
  };

  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^.*\/scenarios\/[^/]+\//, '').replace(/^\//, '');
    const bytes = filesByPath.get(path);
    if (!bytes) return fakeResponse(new Uint8Array(0), 404);
    return fakeResponse(bytes, 200);
  });

  return { manifest, fetchImpl: fetchSpy as unknown as typeof fetch, fetchSpy, filesByPath };
}

function makeBytes(n: number, fill: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  const b = fill.charCodeAt(0);
  for (let i = 0; i < n; i++) out[i] = (b + (i % 64)) & 0xff;
  return out;
}

/**
 * Test seam: jsdom's Response/Blob round-trip can lose bytes (Response(Blob)
 * sometimes returns the stringified body for non-ArrayBuffer body types).
 * Build a duck-typed Response that exposes only what assetLoader.loadOne uses.
 */
function fakeResponse(bytes: Uint8Array, status: number): Response {
  const fresh = new Uint8Array(bytes.byteLength);
  fresh.set(bytes);
  return {
    ok: status >= 200 && status < 300,
    status,
    async arrayBuffer() {
      return fresh.buffer;
    },
  } as unknown as Response;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AssetLoader — cold load (network)', () => {
  let blobs: ReturnType<typeof inMemoryBlobStore>;

  beforeEach(() => {
    blobs = inMemoryBlobStore();
  });

  it('fetches every file, verifies hashes, writes to OPFS, exposes blobs', async () => {
    const { manifest, fetchImpl, fetchSpy } = await buildSyntheticBundle();
    const loader = createAssetLoader({ blobs });
    const handle = loader.load(manifest, { fetch: fetchImpl });
    const bundle = await handle.done;

    expect(fetchSpy).toHaveBeenCalledTimes(manifest.files.length);
    expect(bundle.cacheHitRatio).toBe(0);
    expect(bundle.paths()).toEqual(manifest.files.map((f) => f.path));
    for (const f of manifest.files) {
      const blob = bundle.blobFor(f.path);
      expect(blob?.size).toBe(f.sizeBytes);
    }
  });

  it('writes fetched files into OPFS under the scenario+version prefix', async () => {
    const { manifest, fetchImpl } = await buildSyntheticBundle();
    const loader = createAssetLoader({ blobs });
    await loader.load(manifest, { fetch: fetchImpl }).done;
    const cachedKeys = await blobs.list();
    for (const f of manifest.files) {
      expect(cachedKeys).toContain(`assets/${manifest.scenarioId}/${manifest.version}/${f.path}`);
    }
  });

  it('emits monotonically increasing aggregate progress', async () => {
    const { manifest, fetchImpl } = await buildSyntheticBundle();
    const loader = createAssetLoader({ blobs });
    const events: number[] = [];
    const handle = loader.load(manifest, { fetch: fetchImpl });
    handle.onProgress((p) => events.push(p.loadedBytes));
    await handle.done;
    expect(events.length).toBeGreaterThanOrEqual(manifest.files.length);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!).toBeGreaterThanOrEqual(events[i - 1]!);
    }
    expect(events[events.length - 1]).toBe(manifest.totalSizeBytes);
  });

  it('emits per-file events with source = network', async () => {
    const { manifest, fetchImpl } = await buildSyntheticBundle();
    const loader = createAssetLoader({ blobs });
    const sources: string[] = [];
    const handle = loader.load(manifest, { fetch: fetchImpl });
    handle.onFileLoad((e) => sources.push(e.source));
    await handle.done;
    expect(sources).toEqual(manifest.files.map(() => 'network'));
  });
});

describe('AssetLoader — warm load (OPFS hit)', () => {
  it('reads every file from OPFS, no network calls, cacheHitRatio = 1', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest, fetchImpl, fetchSpy } = await buildSyntheticBundle();

    // First load to populate cache.
    await loader.load(manifest, { fetch: fetchImpl }).done;
    fetchSpy.mockClear();

    // Second load — same manifest.
    const handle = loader.load(manifest, { fetch: fetchImpl });
    const sources: string[] = [];
    handle.onFileLoad((e) => sources.push(e.source));
    const bundle = await handle.done;

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(bundle.cacheHitRatio).toBe(1);
    expect(sources).toEqual(manifest.files.map(() => 'opfs'));
  });

  it('serves files for a different scenarioId/version separately', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest, fetchImpl } = await buildSyntheticBundle();
    await loader.load(manifest, { fetch: fetchImpl }).done;

    const v2 = { ...manifest, version: '1.0.1' };
    const fetchSpy = vi.fn(async () => fakeResponse(new Uint8Array(2048), 200));
    const handle = loader.load(v2, { fetch: fetchSpy as unknown as typeof fetch });
    // v2 has the same hashes, but different storage prefix → cache misses.
    // Hash check will fail because the content this fake fetch returns is
    // not the same bytes — which is actually what we want here: it
    // demonstrates v2 doesn't read the v1 cache.
    await expect(handle.done).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('AssetLoader — corruption handling', () => {
  it('refetches and re-verifies if the cached file has a stale hash', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest, fetchImpl, fetchSpy } = await buildSyntheticBundle();

    // Warm up cache (all files now correct).
    await loader.load(manifest, { fetch: fetchImpl }).done;
    fetchSpy.mockClear();

    // Now poison ONE file's cache with wrong bytes (right size).
    const target = manifest.files[0]!;
    const cacheKey = `assets/${manifest.scenarioId}/${manifest.version}/${target.path}`;
    blobs._entries.set(cacheKey, new Blob([new Uint8Array(target.sizeBytes)]));

    const handle = loader.load(manifest, { fetch: fetchImpl });
    const sources: string[] = [];
    handle.onFileLoad((e) => sources.push(e.source));
    await handle.done;

    expect(fetchSpy).toHaveBeenCalledTimes(1); // only the corrupt one was refetched
    expect(sources.filter((s) => s === 'network')).toHaveLength(1);
    expect(sources.filter((s) => s === 'opfs')).toHaveLength(2);
    const repaired = blobs._entries.get(cacheKey)!;
    expect(repaired.size).toBe(target.sizeBytes);
  });

  it('rejects when network bytes do not match the manifest hash', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest } = await buildSyntheticBundle();
    // Evil fetch returns the right SIZE per path, but wrong content — so the
    // size check passes and the hash check is what fires.
    const sizeByPath = new Map(manifest.files.map((f) => [f.path, f.sizeBytes]));
    const evilFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = url.replace(/^.*\/scenarios\/[^/]+\//, '').replace(/^\//, '');
      const size = sizeByPath.get(path) ?? 0;
      return fakeResponse(new Uint8Array(size), 200);
    });
    const handle = loader.load(manifest, { fetch: evilFetch as unknown as typeof fetch });
    await expect(handle.done).rejects.toThrow(/hash mismatch/);
  });

  it('rejects when network bytes do not match the manifest size', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest } = await buildSyntheticBundle();
    const evilFetch = vi.fn(async () => fakeResponse(new Uint8Array(7), 200));
    const handle = loader.load(manifest, { fetch: evilFetch as unknown as typeof fetch });
    await expect(handle.done).rejects.toThrow(/size mismatch/);
  });

  it('rejects on HTTP error', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest } = await buildSyntheticBundle();
    const errFetch = vi.fn(async () => new Response('nope', { status: 503 }));
    const handle = loader.load(manifest, { fetch: errFetch as unknown as typeof fetch });
    await expect(handle.done).rejects.toThrow(/HTTP 503/);
  });
});

describe('AssetBundle — URLs and unload', () => {
  beforeEach(() => {
    // jsdom 25 doesn't ship URL.createObjectURL/revokeObjectURL by default.
    if (typeof URL.createObjectURL !== 'function') {
      let counter = 0;
      const map = new Map<string, Blob>();
      Object.assign(URL, {
        createObjectURL: (b: Blob) => {
          const u = `blob:test/${++counter}`;
          map.set(u, b);
          return u;
        },
        revokeObjectURL: (u: string) => {
          map.delete(u);
        },
      });
    }
  });

  it('urlFor returns a stable blob URL across calls; unload revokes', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest, fetchImpl } = await buildSyntheticBundle();
    const bundle = await loader.load(manifest, { fetch: fetchImpl }).done;
    const url1 = bundle.urlFor(manifest.files[0]!.path);
    const url2 = bundle.urlFor(manifest.files[0]!.path);
    expect(url1).toBe(url2);
    bundle.unload();
    // After unload, urlFor for the now-cleared bundle throws.
    expect(() => bundle.urlFor(manifest.files[0]!.path)).toThrow();
  });

  it('arrayBufferFor returns the file bytes', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest, fetchImpl, filesByPath } = await buildSyntheticBundle();
    const bundle = await loader.load(manifest, { fetch: fetchImpl }).done;
    const buf = await bundle.arrayBufferFor(manifest.files[0]!.path);
    expect(buf).toBeDefined();
    expect(buf!.byteLength).toBe(filesByPath.get(manifest.files[0]!.path)!.byteLength);
  });
});

describe('AssetLoader — abort', () => {
  it('aborts in-flight fetches when handle.abort() is called', async () => {
    const blobs = inMemoryBlobStore();
    const loader = createAssetLoader({ blobs });
    const { manifest } = await buildSyntheticBundle();
    const slowFetch: typeof fetch = (input, init) =>
      new Promise((_, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
        void input;
      });
    const handle = loader.load(manifest, { fetch: slowFetch });
    queueMicrotask(() => handle.abort());
    await expect(handle.done).rejects.toThrow();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
