/**
 * Asset loading pipeline (bd-engn.3).
 *
 * A scenario ships with a *bundle manifest* — a JSON file listing every asset
 * file with its byte size and a sha256 hash. The runtime loader fetches each
 * file with the policy:
 *
 *   1. Read from OPFS (engine/storage's BlobStore). If present and hash
 *      matches the manifest, keep it.
 *   2. On OPFS miss (or hash mismatch), fetch from the network and write to
 *      OPFS as it streams in.
 *   3. Verify the freshly fetched bytes against the manifest hash. Reject
 *      the load if it fails.
 *
 * Output is an `AssetBundle` exposing per-path Blobs, ArrayBuffers, and
 * stable blob: URLs (which R3F's useGLTF / our useScenarioGLTF can fetch).
 *
 * Build-time compression (Draco/KTX2 for glTF, Opus for audio, AVIF/WebP
 * for images) lives in `tools/` and is invoked during scenario build.
 * `tools/build-bundle-manifest.ts` produces the manifest from a scenario
 * folder.
 */

export type BundleFile = {
  /** Forward-slash-relative path inside the scenario folder. */
  path: string;
  sizeBytes: number;
  /** Lowercase hex sha256. */
  sha256: string;
  /**
   * MIME type for blob URL generation. Optional — useful for audio (where
   * the GLTFLoader doesn't matter) or for video. If omitted, the loader
   * picks a sensible default from the path extension.
   */
  contentType?: string;
};

export type BundleManifest = {
  scenarioId: string;
  /** SemVer; bumped when any file changes. */
  version: string;
  totalSizeBytes: number;
  files: ReadonlyArray<BundleFile>;
};

export type LoadProgress = {
  loadedFiles: number;
  totalFiles: number;
  loadedBytes: number;
  totalBytes: number;
};

export type FileLoadEvent = {
  file: BundleFile;
  /** Where the bytes came from for this file. */
  source: 'opfs' | 'network';
  /** Wall-clock duration, ms. */
  durationMs: number;
};

export type LoadOptions = {
  /**
   * Where to fetch missing files. Resolved as `${baseUrl}/${file.path}`.
   * Defaults to '/scenarios/<scenarioId>/'.
   */
  baseUrl?: string;
  signal?: AbortSignal;
  /** Override the global fetch. Test seam. */
  fetch?: typeof fetch;
};

export interface AssetBundle {
  scenarioId: string;
  version: string;
  /** Get a stable blob URL for `path`. Valid until `unload()`. */
  urlFor(path: string): string;
  blobFor(path: string): Blob | undefined;
  arrayBufferFor(path: string): Promise<ArrayBuffer | undefined>;
  /** All file paths in the bundle, in manifest order. */
  paths(): ReadonlyArray<string>;
  /** Cache hit ratio (files served from OPFS / total files), 0..1. */
  readonly cacheHitRatio: number;
  /** Free blob URLs and drop in-memory blob refs. Idempotent. */
  unload(): void;
}

export interface AssetLoadHandle {
  /** Resolves with the loaded bundle, or rejects if any file fails. */
  readonly done: Promise<AssetBundle>;
  /** Subscribe to aggregate progress events. Returns an unsubscribe. */
  onProgress(listener: (p: LoadProgress) => void): () => void;
  /** Per-file completion events. */
  onFileLoad(listener: (e: FileLoadEvent) => void): () => void;
  /** Abort the load. Already-cached files stay in OPFS. */
  abort(): void;
}
