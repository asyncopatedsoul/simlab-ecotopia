/**
 * Request that the browser mark this origin as persisted (resists eviction
 * under storage pressure). Call from a scenario-load context, NOT at app boot.
 */
export async function requestPersist(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
