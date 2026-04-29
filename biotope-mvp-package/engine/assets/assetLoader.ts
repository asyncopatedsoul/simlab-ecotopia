import type { BlobStore } from '@engine/storage';
import { blobToArrayBuffer, sha256Hex } from './hash';
import type {
  AssetBundle,
  AssetLoadHandle,
  BundleFile,
  BundleManifest,
  FileLoadEvent,
  LoadOptions,
  LoadProgress,
} from './types';

export type AssetLoaderOptions = {
  /** OPFS-backed blob store; from createStorage().blobs. */
  blobs: BlobStore;
  /** Base path inside OPFS where bundles are cached. Default `assets/`. */
  storagePrefix?: string;
};

export interface AssetLoader {
  load(manifest: BundleManifest, options?: LoadOptions): AssetLoadHandle;
}

export function createAssetLoader(opts: AssetLoaderOptions): AssetLoader {
  const blobs = opts.blobs;
  const storagePrefix = opts.storagePrefix ?? 'assets';

  function storagePath(scenarioId: string, version: string, path: string): string {
    return `${storagePrefix}/${scenarioId}/${version}/${path}`;
  }

  function networkUrl(scenarioId: string, base: string | undefined, path: string): string {
    const baseUrl = base ?? `/scenarios/${scenarioId}/`;
    return baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
  }

  return {
    load(manifest, options = {}) {
      const fetchImpl = options.fetch ?? fetch.bind(globalThis);
      const ctrl = new AbortController();
      const externalSignal = options.signal;
      const externalAbortHandler = () => ctrl.abort(externalSignal?.reason);
      externalSignal?.addEventListener('abort', externalAbortHandler);

      const progressListeners = new Set<(p: LoadProgress) => void>();
      const fileListeners = new Set<(e: FileLoadEvent) => void>();
      const fileBlobs = new Map<string, Blob>();
      const blobUrls = new Map<string, string>();

      let loadedFiles = 0;
      let loadedBytes = 0;
      let cacheHits = 0;
      const totalFiles = manifest.files.length;
      const totalBytes = manifest.totalSizeBytes;

      function emitProgress() {
        const p: LoadProgress = { loadedFiles, totalFiles, loadedBytes, totalBytes };
        for (const l of progressListeners) {
          try {
            l(p);
          } catch {
            /* swallow */
          }
        }
      }

      function emitFile(e: FileLoadEvent) {
        for (const l of fileListeners) {
          try {
            l(e);
          } catch {
            /* swallow */
          }
        }
      }

      async function loadOne(file: BundleFile): Promise<void> {
        const t0 = performance.now();
        const sp = storagePath(manifest.scenarioId, manifest.version, file.path);

        // 1) Try OPFS cache.
        const cached = await blobs.get(sp);
        if (cached) {
          if (cached.size === file.sizeBytes) {
            const cachedHash = await sha256Hex(cached);
            if (cachedHash === file.sha256) {
              fileBlobs.set(file.path, cached);
              cacheHits += 1;
              loadedFiles += 1;
              loadedBytes += file.sizeBytes;
              emitProgress();
              emitFile({ file, source: 'opfs', durationMs: performance.now() - t0 });
              return;
            }
          }
          // Hash or size mismatch — corrupt cache; delete and fall through.
          await blobs.delete(sp);
        }

        // 2) Fetch from network.
        const url = networkUrl(manifest.scenarioId, options.baseUrl, file.path);
        const res = await fetchImpl(url, { signal: ctrl.signal });
        if (!res.ok) {
          throw new Error(`Asset fetch failed for ${file.path}: HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength !== file.sizeBytes) {
          throw new Error(
            `Asset size mismatch for ${file.path}: expected ${file.sizeBytes}, got ${buf.byteLength}`,
          );
        }
        const fetchedHash = await sha256Hex(buf);
        if (fetchedHash !== file.sha256) {
          throw new Error(
            `Asset hash mismatch for ${file.path}: expected ${file.sha256}, got ${fetchedHash}`,
          );
        }
        const blob = new Blob([buf], file.contentType ? { type: file.contentType } : undefined);
        await blobs.put(sp, blob);
        fileBlobs.set(file.path, blob);
        loadedFiles += 1;
        loadedBytes += file.sizeBytes;
        emitProgress();
        emitFile({ file, source: 'network', durationMs: performance.now() - t0 });
      }

      const done: Promise<AssetBundle> = (async () => {
        try {
          // Files run in parallel — OPFS reads scale, and most network fetches
          // can interleave too. Browsers cap concurrent fetches per origin
          // (typically 6); above that the runtime queues for us.
          await Promise.all(manifest.files.map((f) => loadOne(f)));
          return makeBundle();
        } finally {
          externalSignal?.removeEventListener('abort', externalAbortHandler);
        }
      })();

      function makeBundle(): AssetBundle {
        const bundle: AssetBundle = {
          scenarioId: manifest.scenarioId,
          version: manifest.version,
          paths: () => manifest.files.map((f) => f.path),
          urlFor(path) {
            const existing = blobUrls.get(path);
            if (existing) return existing;
            const blob = fileBlobs.get(path);
            if (!blob) throw new Error(`No bundle file at path: ${path}`);
            const url = URL.createObjectURL(blob);
            blobUrls.set(path, url);
            return url;
          },
          blobFor(path) {
            return fileBlobs.get(path);
          },
          async arrayBufferFor(path) {
            const b = fileBlobs.get(path);
            return b ? blobToArrayBuffer(b) : undefined;
          },
          get cacheHitRatio() {
            return totalFiles === 0 ? 0 : cacheHits / totalFiles;
          },
          unload() {
            for (const url of blobUrls.values()) URL.revokeObjectURL(url);
            blobUrls.clear();
            fileBlobs.clear();
          },
        };
        return bundle;
      }

      return {
        done,
        onProgress(listener) {
          progressListeners.add(listener);
          return () => progressListeners.delete(listener);
        },
        onFileLoad(listener) {
          fileListeners.add(listener);
          return () => fileListeners.delete(listener);
        },
        abort() {
          ctrl.abort(new DOMException('Aborted', 'AbortError'));
        },
      };
    },
  };
}
