import type { Manifest } from '@engine/manifest';
import { createStubImageClassifier } from './imageClassifier';
import type {
  ImageClassifier,
  ReEncodingInput,
  ReEncodingNoObservation,
  ReEncodingOutcome,
} from './types';

type AcceptRule = Manifest['loop']['re_encoding']['accept'][number];
type ReEncodingBlock = Manifest['loop']['re_encoding'];

export type ReEncoderOptions = {
  /** Defaults to a stub that always returns 1.0 confidence for the asked subject. */
  classifier?: ImageClassifier;
};

export interface ReEncoder {
  /**
   * Process a single input against the manifest's re_encoding block. Walks
   * `accept[]` in order; first match wins. If nothing matches, returns
   * no_observation — the encouraging narrative still plays.
   */
  process(input: ReEncodingInput, reEncoding: ReEncodingBlock): Promise<ReEncodingOutcome>;
  /** Process the no-input path (player came back empty-handed). */
  processNoObservation(reEncoding: ReEncodingBlock): ReEncodingNoObservation;
}

export function createReEncoder(opts: ReEncoderOptions = {}): ReEncoder {
  const classifier = opts.classifier ?? createStubImageClassifier();

  async function tryMatch(
    input: ReEncodingInput,
    accept: AcceptRule,
    index: number,
    sim: ReEncodingBlock['sim_response'],
  ): Promise<ReEncodingOutcome | null> {
    if (input.kind === 'photo' && accept.kind === 'photo') {
      const result = await classifier.classify(input.blob, { subjectHint: accept.subject });
      if (result.confidence < accept.confidence_min) return null;
      if (result.subject !== accept.subject) return null;
      return {
        outcome: 'accepted',
        matchedAcceptIndex: index,
        action: sim.action,
        narrativeNode: sim.narrative_node,
        payload: {
          kind: 'photo',
          blob: input.blob,
          subject: result.subject,
          confidence: result.confidence,
        },
      };
    }
    if (input.kind === 'self_reported_id' && accept.kind === 'self_reported_id') {
      // The manifest's `from_species_pack: true` flag is a contract that the
      // ID came from the species pack. The runtime is responsible for only
      // submitting IDs from there; the reEncoder trusts the assertion.
      if (!accept.from_species_pack) return null;
      return {
        outcome: 'accepted',
        matchedAcceptIndex: index,
        action: sim.action,
        narrativeNode: sim.narrative_node,
        payload: {
          kind: 'self_reported_id',
          speciesId: input.speciesId,
        },
      };
    }
    return null;
  }

  return {
    async process(input, reEncoding) {
      for (let i = 0; i < reEncoding.accept.length; i++) {
        const match = await tryMatch(input, reEncoding.accept[i]!, i, reEncoding.sim_response);
        if (match) return match;
      }
      return {
        outcome: 'no_observation',
        narrativeNode: reEncoding.sim_response.on_no_observation,
      };
    },
    processNoObservation(reEncoding) {
      return {
        outcome: 'no_observation',
        narrativeNode: reEncoding.sim_response.on_no_observation,
      };
    },
  };
}
