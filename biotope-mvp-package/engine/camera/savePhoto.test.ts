import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BlobStore } from '@engine/storage';
import { photoStoragePath, savePhoto } from './savePhoto';

function inMemoryBlobStore(): BlobStore {
  const entries = new Map<string, Blob>();
  return {
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

describe('photoStoragePath', () => {
  it('partitions photos by scenarioId and timestamps them', () => {
    expect(photoStoragePath('window-watch', 1714867200000)).toBe(
      'photos/window-watch/1714867200000.jpg',
    );
  });

  it('accepts a custom extension', () => {
    expect(photoStoragePath('window-watch', 100, 'png')).toBe('photos/window-watch/100.png');
  });
});

describe('savePhoto', () => {
  it('writes the blob to the partitioned path and returns it', async () => {
    const blobs = inMemoryBlobStore();
    const data = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const path = await savePhoto(blobs, 'window-watch', data, 1234);
    expect(path).toBe('photos/window-watch/1234.jpg');
    const back = await blobs.get(path);
    expect(back).toBe(data);
  });

  it('round-trips read in <100ms (acceptance bar)', async () => {
    const blobs = inMemoryBlobStore();
    // 200 KB synthetic JPEG (well above the typical post-resize size).
    const big = new Blob([new Uint8Array(200 * 1024)], { type: 'image/jpeg' });
    const path = await savePhoto(blobs, 'window-watch', big, Date.now());
    const t0 = performance.now();
    const out = await blobs.get(path);
    const dt = performance.now() - t0;
    expect(out).toBeDefined();
    expect(out!.size).toBe(big.size);
    expect(dt).toBeLessThan(100);
  });
});
