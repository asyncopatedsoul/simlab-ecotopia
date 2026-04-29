/**
 * Re-encoding the field result back into the sim (bd-flda.5).
 *
 * After a confirmed photo (bd-flda.3 → onConfirmed) or a self-reported
 * species ID, the reEncoder consults the manifest's `loop.re_encoding` block
 * (bd-rntm.1 schema) and returns an *outcome* — accepted (with the
 * sim-response action name + Ink narrative node) or no_observation (the
 * encouraging narrative). It does not reach into the 3D scene or InkRuntime
 * directly; the orchestrator (bd-scen.1 / bd-rntm.6) wires the outcome to
 * those subsystems.
 *
 * Per the design doc, "the local recognition model can be very light or
 * even absent." The default ImageClassifier is a stub that always returns
 * a high-confidence match for the requested subject. A real model plugs
 * in behind the same interface.
 */

export type ReEncodingInput =
  | {
      kind: 'photo';
      blob: Blob;
      /** Optional hint from field_activity.completion.photo_subject_hint. */
      subjectHint?: string;
    }
  | {
      kind: 'self_reported_id';
      /** Species ID picked from the species pack. */
      speciesId: string;
    };

export type ClassifierResult = {
  /** Coarse subject label, e.g. "bird", "tree", "mammal_track". */
  subject: string;
  /** 0..1. Real models return a probability; the stub returns 1.0. */
  confidence: number;
};

export type ClassifierOptions = {
  /**
   * The subject the accept-rule is asking about. Real classifiers may use
   * this as a binary classification target; the stub mirrors it back.
   */
  subjectHint?: string;
};

export interface ImageClassifier {
  classify(blob: Blob, options: ClassifierOptions): Promise<ClassifierResult>;
}

export type ReEncodingAccepted = {
  outcome: 'accepted';
  /** Index into manifest.loop.re_encoding.accept[] that matched. */
  matchedAcceptIndex: number;
  /** Sim-response action name (manifest sim_response.action). */
  action: string;
  /** Ink narrative node to play (manifest sim_response.narrative_node). */
  narrativeNode: string;
  /** What got matched, for the runtime/scene to render. */
  payload:
    | { kind: 'photo'; blob: Blob; subject: string; confidence: number }
    | { kind: 'self_reported_id'; speciesId: string };
};

export type ReEncodingNoObservation = {
  outcome: 'no_observation';
  /** Manifest sim_response.on_no_observation. */
  narrativeNode: string;
};

export type ReEncodingOutcome = ReEncodingAccepted | ReEncodingNoObservation;
