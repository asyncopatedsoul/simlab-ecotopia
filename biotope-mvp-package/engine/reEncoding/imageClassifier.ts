import type { ClassifierOptions, ClassifierResult, ImageClassifier } from './types';

/**
 * Stub classifier — does not look at the image bytes. Returns a high-
 * confidence match for whatever the accept-rule asked about. This is the
 * design-doc-prescribed MVP behavior: "the local recognition model can be
 * very light or even absent — accept self-reported IDs and a low-confidence
 * photo classifier as parallel paths."
 *
 * A real model (PlantNet, iNaturalist API, custom subset model) plugs in
 * behind the ImageClassifier interface.
 */
export type StubClassifierOptions = {
  /** Confidence to return; default 1.0. Lower values let tests probe rejection paths. */
  confidence?: number;
  /**
   * If set, the stub returns this subject regardless of subjectHint. Useful
   * for tests that simulate a model returning the WRONG subject.
   */
  forceSubject?: string;
};

export function createStubImageClassifier(opts: StubClassifierOptions = {}): ImageClassifier {
  const confidence = opts.confidence ?? 1.0;
  return {
    async classify(_blob: Blob, options: ClassifierOptions): Promise<ClassifierResult> {
      return {
        subject: opts.forceSubject ?? options.subjectHint ?? 'unknown',
        confidence,
      };
    },
  };
}
