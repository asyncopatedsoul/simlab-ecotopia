import type { AgeRung, Mode } from '@engine/manifest';
import type { CapturedPhoto } from '@engine/camera';

/**
 * Photo gating for the mentor+apprentice cohort (bd-flda.3).
 *
 * After the child captures a photo (bd-flda.1), the gate holds it in a
 * "pending" state until the parent confirms or discards. Pending photos
 * stay in OPFS but are tracked in kv so they're recoverable across app
 * restarts.
 *
 * Gating policy (per issue description):
 *   - solo mode → never gated; the older child publishes their own.
 *   - mentor_apprentice + ageRung 5-6 / 7-8 → gate forced ON, regardless
 *     of manifest setting.
 *   - mentor_apprentice + ageRung 9-10 / 11-12 → gate respects the
 *     manifest's `mentor_apprentice.parent_seat.photo_gate` flag.
 */

export type GateContext = {
  scenarioId: string;
  ageRung: AgeRung;
  mode: Mode;
  /** Manifest's mentor_apprentice.parent_seat.photo_gate — null in solo. */
  manifestPhotoGate: boolean | null;
};

export type PendingPhotoEntry = {
  path: string;
  scenarioId: string;
  ageRung: AgeRung;
  capturedAt: number;
  width: number;
  height: number;
};

export type SubmitOutcome = { state: 'pending' | 'confirmed' };

export interface PhotoGate {
  /** Returns true if a photo captured under this context must wait for parent confirmation. */
  shouldGate(ctx: GateContext): boolean;
  /**
   * Hand a freshly captured photo to the gate. If gating is required for
   * `ctx`, the photo enters the pending queue and listeners are notified.
   * If not, the gate returns 'confirmed' immediately and listeners get
   * an onConfirmed event so the runtime can flow the photo to re-encoding.
   */
  submit(photo: CapturedPhoto, ctx: GateContext): Promise<SubmitOutcome>;
  /** Parent action: confirm a pending photo. The blob stays in OPFS. */
  confirm(path: string): Promise<void>;
  /** Parent action: discard a pending photo. The blob is purged from OPFS. */
  discard(path: string): Promise<void>;
  /** All currently-pending entries (for parent UI hydration on resume). */
  listPending(): Promise<PendingPhotoEntry[]>;
  /** Fired when a photo enters the pending queue. */
  onPending(listener: (entry: PendingPhotoEntry) => void): () => void;
  /** Fired when a pending photo is confirmed (or auto-confirmed for solo). */
  onConfirmed(listener: (entry: PendingPhotoEntry) => void): () => void;
  /** Fired when a pending photo is discarded. */
  onDiscarded(listener: (path: string) => void): () => void;
}
