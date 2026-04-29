/**
 * Camera + photo capture (bd-flda.1).
 *
 * PWA path: getUserMedia → <video> preview → canvas frame grab → JPEG blob
 * → OPFS write. Capacitor-native is bd-plat.3 and plugs in behind the same
 * CameraService interface.
 *
 * Privacy posture (per AGENTS.md rule 5 + planning §2 privacy block):
 *   - Photos default to local-only (OPFS), never uploaded automatically.
 *   - Camera permission is just-in-time, explainer-first via bd-plat.5.
 *   - EXIF is stripped on capture: canvas-encoded JPEGs carry no metadata,
 *     so this is enforced by construction. Tests verify byte-level absence.
 *   - Resize to 1600px long edge to keep storage tight; original-resolution
 *     bytes never reach OPFS.
 */

export type CaptureOptions = {
  /** Maximum dimension on the long edge (px). Default 1600. */
  maxLongEdgePx?: number;
  /** JPEG quality 0..1. Default 0.85. */
  jpegQuality?: number;
  /** 'environment' = rear, 'user' = front. Default 'environment'. */
  facingMode?: 'environment' | 'user';
};

export type CapturedPhoto = {
  /** OPFS path under blobs facade. */
  path: string;
  /** Saved JPEG bytes. */
  blob: Blob;
  width: number;
  height: number;
  /** Epoch ms. */
  capturedAt: number;
};

/**
 * A live capture session: stream is hot, ready for preview, until capture()
 * or close() is called. Only one session may be open at a time per
 * CameraService instance.
 */
export interface CameraSession {
  readonly stream: MediaStream;
  /** Capture the current frame, save to OPFS, return the saved photo. */
  capture(): Promise<CapturedPhoto>;
  /** Stop the stream and release the camera. Idempotent. */
  close(): void;
}

export type StartSessionRequest = {
  scenarioId: string;
  stepId: string;
  /** Kid-friendly explainer copy shown before the OS camera prompt. */
  copy: string;
  options?: CaptureOptions;
};

export interface CameraService {
  /**
   * Open a capture session. Returns null if the user dismisses the explainer
   * or the OS denies the permission.
   */
  startSession(req: StartSessionRequest): Promise<CameraSession | null>;
  /** Read a previously captured photo from OPFS. Returns undefined if missing. */
  read(path: string): Promise<Blob | undefined>;
  /** Delete a captured photo. Idempotent. */
  delete(path: string): Promise<void>;
}
