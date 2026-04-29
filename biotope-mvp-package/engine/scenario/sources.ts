import { ScenarioLoadError } from './types';

/**
 * Read seam for the scenario loader. Same shape as the region-pack
 * PackSource (different namespace because scenarios and packs are
 * conceptually distinct artifacts shipped through different pipelines).
 */
export interface ScenarioSource {
  /** Read a file relative to the scenario folder root. Throws if missing. */
  read(path: string): Promise<Uint8Array>;
  /** True if the file exists. Used to skip optional files (e.g. localized ink). */
  exists(path: string): Promise<boolean>;
}

export function createMemoryScenarioSource(
  files: Map<string, Uint8Array>,
): ScenarioSource {
  return {
    async read(path) {
      const bytes = files.get(path);
      if (!bytes) {
        throw new ScenarioLoadError(
          `scenario source missing file: ${path}`,
          'MANIFEST_MISSING',
        );
      }
      return bytes;
    },
    async exists(path) {
      return files.has(path);
    },
  };
}

export async function createFsScenarioSource(dir: string): Promise<ScenarioSource> {
  const { readFile, stat } = await import('node:fs/promises');
  const { join, normalize, sep } = await import('node:path');

  const base = normalize(dir);
  const resolveSafe = (relPath: string): string => {
    if (relPath.includes('..') || relPath.startsWith('/')) {
      throw new ScenarioLoadError(
        `scenario source rejected unsafe path: ${relPath}`,
        'MANIFEST_MISSING',
      );
    }
    return join(base, relPath.split('/').join(sep));
  };

  return {
    async read(relPath) {
      const full = resolveSafe(relPath);
      try {
        const buf = await readFile(full);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } catch (e) {
        throw new ScenarioLoadError(
          `scenario source missing file: ${relPath}`,
          'MANIFEST_MISSING',
          e,
        );
      }
    },
    async exists(relPath) {
      try {
        await stat(resolveSafe(relPath));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createFetchScenarioSource(baseUrl: string): ScenarioSource {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return {
    async read(path) {
      const res = await fetch(base + path);
      if (!res.ok) {
        throw new ScenarioLoadError(
          `scenario source fetch failed (${res.status}): ${path}`,
          'MANIFEST_MISSING',
        );
      }
      return new Uint8Array(await res.arrayBuffer());
    },
    async exists(path) {
      const res = await fetch(base + path, { method: 'HEAD' });
      return res.ok;
    },
  };
}
