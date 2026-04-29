import type { BlobStore } from '@engine/storage';

/**
 * Storage path for a captured photo. Scenarios partition under their own
 * folder so deletion-on-uninstall (or per-scenario clear) is one delete-
 * recursive call.
 */
export function photoStoragePath(
  scenarioId: string,
  capturedAt: number,
  ext = 'jpg',
): string {
  return `photos/${scenarioId}/${capturedAt}.${ext}`;
}

export async function savePhoto(
  blobs: BlobStore,
  scenarioId: string,
  blob: Blob,
  capturedAt: number,
): Promise<string> {
  const path = photoStoragePath(scenarioId, capturedAt);
  await blobs.put(path, blob);
  return path;
}
