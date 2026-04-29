import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '@engine/manifest';
import { createReEncoder } from './reEncoder';
import { createStubImageClassifier } from './imageClassifier';
import type { ImageClassifier } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(
  __dirname,
  '../manifest/fixtures/backyard-bird-hour.yaml',
);
const manifest = parseManifest(readFileSync(FIXTURE, 'utf8'));
const reEncoding = manifest.loop.re_encoding;

function fakeBirdPhoto(): Blob {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return new Blob([bytes], { type: 'image/jpeg' });
}

describe('reEncoder — acceptance: photo of a bird', () => {
  it('runs sim_response.action and the encode.success narrative for any bird photo (stub classifier)', async () => {
    const reEncoder = createReEncoder();
    const out = await reEncoder.process(
      { kind: 'photo', blob: fakeBirdPhoto() },
      reEncoding,
    );
    expect(out.outcome).toBe('accepted');
    if (out.outcome !== 'accepted') return;
    expect(out.action).toBe('place_player_observation_in_scene');
    expect(out.narrativeNode).toBe('encode.success');
    expect(out.matchedAcceptIndex).toBe(0); // photo accept is first
    expect(out.payload).toMatchObject({
      kind: 'photo',
      subject: 'bird',
      confidence: 1,
    });
  });
});

describe('reEncoder — self-reported ID path', () => {
  it('accepts a self-reported species ID when from_species_pack is true', async () => {
    const reEncoder = createReEncoder();
    const out = await reEncoder.process(
      { kind: 'self_reported_id', speciesId: 'robin' },
      reEncoding,
    );
    expect(out.outcome).toBe('accepted');
    if (out.outcome !== 'accepted') return;
    expect(out.matchedAcceptIndex).toBe(1);
    expect(out.action).toBe('place_player_observation_in_scene');
    expect(out.payload).toEqual({ kind: 'self_reported_id', speciesId: 'robin' });
  });

  it('rejects a self-reported ID when no accept rule matches kind', async () => {
    // Synthesize a re_encoding block with only a photo accept.
    const photoOnly = {
      ...reEncoding,
      accept: reEncoding.accept.filter((a) => a.kind === 'photo'),
    } as typeof reEncoding;
    const reEncoder = createReEncoder();
    const out = await reEncoder.process(
      { kind: 'self_reported_id', speciesId: 'robin' },
      photoOnly,
    );
    expect(out.outcome).toBe('no_observation');
    if (out.outcome !== 'no_observation') return;
    expect(out.narrativeNode).toBe('encode.encouragement');
  });
});

describe('reEncoder — confidence + subject gating', () => {
  it('falls through to no_observation when classifier confidence < confidence_min', async () => {
    const lowConf: ImageClassifier = createStubImageClassifier({ confidence: 0.3 });
    const reEncoder = createReEncoder({ classifier: lowConf });
    const out = await reEncoder.process(
      { kind: 'photo', blob: fakeBirdPhoto() },
      reEncoding,
    );
    expect(out.outcome).toBe('no_observation');
  });

  it('falls through to no_observation when classifier subject does not match the accept rule', async () => {
    const wrongSubject: ImageClassifier = createStubImageClassifier({ forceSubject: 'tree' });
    const reEncoder = createReEncoder({ classifier: wrongSubject });
    const out = await reEncoder.process(
      { kind: 'photo', blob: fakeBirdPhoto() },
      reEncoding,
    );
    expect(out.outcome).toBe('no_observation');
  });

  it('passes when classifier confidence is exactly at the threshold', async () => {
    const exact: ImageClassifier = createStubImageClassifier({ confidence: 0.4 });
    const reEncoder = createReEncoder({ classifier: exact });
    const out = await reEncoder.process(
      { kind: 'photo', blob: fakeBirdPhoto() },
      reEncoding,
    );
    expect(out.outcome).toBe('accepted');
  });
});

describe('reEncoder — no-observation path', () => {
  it('processNoObservation returns the on_no_observation narrative', () => {
    const reEncoder = createReEncoder();
    const out = reEncoder.processNoObservation(reEncoding);
    expect(out.outcome).toBe('no_observation');
    expect(out.narrativeNode).toBe('encode.encouragement');
  });
});

describe('reEncoder — accept iteration', () => {
  it('walks accept[] in order and returns the first match', async () => {
    // Construct a synthetic block where two photo accepts have different subjects.
    const accept = [
      { kind: 'photo' as const, subject: 'tree', confidence_min: 0.5 },
      { kind: 'photo' as const, subject: 'bird', confidence_min: 0.4 },
    ];
    const block = {
      ...reEncoding,
      accept,
    } as typeof reEncoding;
    const reEncoder = createReEncoder(); // stub classifier mirrors hint
    const out = await reEncoder.process(
      { kind: 'photo', blob: fakeBirdPhoto() },
      block,
    );
    // Stub classifier mirrors the hint, so the first accept (tree) WILL match
    // because the reEncoder asks the classifier "is this a tree?" and the
    // stub says yes. This is the documented MVP behavior — first rule wins.
    expect(out.outcome).toBe('accepted');
    if (out.outcome !== 'accepted') return;
    expect(out.matchedAcceptIndex).toBe(0);
  });

  it('skips non-matching kinds and finds a later match', async () => {
    // Photo input, but the first accept entry is a self_reported_id.
    const accept = [
      { kind: 'self_reported_id' as const, from_species_pack: true },
      { kind: 'photo' as const, subject: 'bird', confidence_min: 0.4 },
    ];
    const block = { ...reEncoding, accept } as typeof reEncoding;
    const reEncoder = createReEncoder();
    const out = await reEncoder.process(
      { kind: 'photo', blob: fakeBirdPhoto() },
      block,
    );
    expect(out.outcome).toBe('accepted');
    if (out.outcome !== 'accepted') return;
    expect(out.matchedAcceptIndex).toBe(1);
  });
});

describe('createStubImageClassifier', () => {
  it('mirrors the subjectHint at confidence 1.0 by default', async () => {
    const c = createStubImageClassifier();
    const r = await c.classify(fakeBirdPhoto(), { subjectHint: 'bird' });
    expect(r).toEqual({ subject: 'bird', confidence: 1 });
  });

  it('honors the confidence override (for testing rejection paths)', async () => {
    const c = createStubImageClassifier({ confidence: 0.3 });
    const r = await c.classify(fakeBirdPhoto(), { subjectHint: 'bird' });
    expect(r).toEqual({ subject: 'bird', confidence: 0.3 });
  });

  it('honors the forceSubject override', async () => {
    const c = createStubImageClassifier({ forceSubject: 'tree' });
    const r = await c.classify(fakeBirdPhoto(), { subjectHint: 'bird' });
    expect(r).toEqual({ subject: 'tree', confidence: 1 });
  });
});
