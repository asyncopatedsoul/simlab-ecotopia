import { RegionPackError } from './types';

/**
 * The loader reads a pack through this seam so the same code serves multiple
 * delivery modes — local fs (Node), HTTP fetch (browser), in-memory (tests).
 */
export interface PackSource {
  /** Read a file relative to the pack root. Throws RegionPackError if missing. */
  read(path: string): Promise<Uint8Array>;
}

/**
 * In-memory source backed by a `Map<path, bytes>`. Used by the builder's
 * round-trip helper and by tests.
 */
export function createMemoryPackSource(files: Map<string, Uint8Array>): PackSource {
  return {
    async read(path) {
      const bytes = files.get(path);
      if (!bytes) {
        throw new RegionPackError(
          `pack source missing file: ${path}`,
          'ASSET_MISSING',
        );
      }
      return bytes;
    },
  };
}

/**
 * Node-only filesystem source. Loaded lazily so this module stays
 * browser-importable (the dynamic import keeps `node:fs` out of the
 * browser bundle).
 */
export async function createFsPackSource(dir: string): Promise<PackSource> {
  const { readFile } = await import('node:fs/promises');
  const { join, normalize, sep } = await import('node:path');

  const base = normalize(dir);
  return {
    async read(relPath) {
      // Forward-slash paths only, per the pack spec. Reject path traversal.
      if (relPath.includes('..') || relPath.startsWith('/')) {
        throw new RegionPackError(
          `pack source rejected unsafe path: ${relPath}`,
          'ASSET_MISSING',
        );
      }
      const native = relPath.split('/').join(sep);
      const full = join(base, native);
      try {
        const buf = await readFile(full);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } catch (e) {
        throw new RegionPackError(
          `pack source missing file: ${relPath}`,
          'ASSET_MISSING',
          e,
        );
      }
    },
  };
}

/**
 * Browser-side HTTP source. The pack's files are served at
 * `<baseUrl>/<path>` (typically `/region-packs/<pack_id>/`).
 */
export function createFetchPackSource(baseUrl: string): PackSource {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return {
    async read(path) {
      const res = await fetch(base + path);
      if (!res.ok) {
        throw new RegionPackError(
          `pack source fetch failed (${res.status}): ${path}`,
          'ASSET_MISSING',
        );
      }
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
