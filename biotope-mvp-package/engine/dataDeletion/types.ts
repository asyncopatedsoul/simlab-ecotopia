/**
 * Data deletion flow (bd-priv.3).
 *
 * "One tap from settings, irreversible after a 7-day cooling-off." The
 * cooling-off window protects against accidental tap-throughs by kids; the
 * parent can cancel any time before the deadline. After the deadline, the
 * next app launch sweeps everything: OPFS blobs, kv (Dexie), sqlocal
 * species DB.
 *
 * State lives in the kv (which is itself wiped during the sweep, but the
 * sweep happens AFTER reading the schedule, so the chicken/egg is fine).
 */

export const DEFAULT_COOLING_OFF_DAYS = 7;

export type DeletionStatus =
  | { state: 'inactive' }
  | { state: 'pending'; scheduledAt: number; executeAfter: number };

export type DeletionResult = {
  blobsDeleted: number;
  kvCleared: boolean;
  speciesDbCleared: boolean;
};

export type ScheduleOptions = {
  /** Override the cooling-off duration (ms). Test seam. */
  coolingOffMs?: number;
};

export interface DataDeletion {
  /** Current schedule, or `inactive` if no deletion is pending. */
  status(): Promise<DeletionStatus>;
  /** Schedule deletion. Sets pending state with executeAfter = now + coolingOff. */
  schedule(options?: ScheduleOptions): Promise<DeletionStatus>;
  /** Cancel a pending deletion. Idempotent — no-op if inactive. */
  cancel(): Promise<void>;
  /**
   * Sweep: if a deletion is pending and `now >= executeAfter`, wipe storage.
   * Call on every app launch. Returns null if nothing was swept.
   */
  sweepIfDue(): Promise<DeletionResult | null>;
}
