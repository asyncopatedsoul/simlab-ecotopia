import { describe, expect, it } from 'vitest';
import { bundleManifestSchema, parseBundleManifest, safeParseBundleManifest } from './manifestSchema';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

type Manifesty = {
  scenarioId: string;
  version: string;
  totalSizeBytes: number;
  files: Array<{ path: string; sizeBytes: number; sha256: string }>;
};

const VALID: Manifesty = {
  scenarioId: 'window-watch',
  version: '1.0.0',
  totalSizeBytes: 300,
  files: [
    { path: 'scenes/main.glb', sizeBytes: 100, sha256: HASH_A },
    { path: 'audio/intro.opus', sizeBytes: 200, sha256: HASH_B },
  ],
};

describe('bundleManifestSchema', () => {
  it('accepts a well-formed manifest', () => {
    expect(() => parseBundleManifest(structuredClone(VALID))).not.toThrow();
  });

  it('rejects scenarioId that is not a slug', () => {
    const bad = { ...structuredClone(VALID), scenarioId: 'Window Watch' };
    expect(safeParseBundleManifest(bad).ok).toBe(false);
  });

  it('rejects non-SemVer version', () => {
    const bad = { ...structuredClone(VALID), version: '1.0' };
    expect(safeParseBundleManifest(bad).ok).toBe(false);
  });

  it('rejects sha256 not 64 hex chars', () => {
    const bad = structuredClone(VALID) as unknown as Record<string, unknown>;
    (bad.files as Array<Record<string, unknown>>)[0]!.sha256 = 'not-a-hash';
    expect(safeParseBundleManifest(bad).ok).toBe(false);
  });

  it('rejects totalSizeBytes mismatch with sum of files', () => {
    const bad = { ...structuredClone(VALID), totalSizeBytes: 999 };
    const r = safeParseBundleManifest(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.path === 'totalSizeBytes')).toBe(true);
  });

  it('rejects duplicate paths', () => {
    const dup = [VALID.files[0]!, { ...VALID.files[0]! }];
    const r = bundleManifestSchema.safeParse({ ...VALID, files: dup });
    expect(r.success).toBe(false);
  });

  it('rejects empty files array', () => {
    expect(safeParseBundleManifest({ ...VALID, files: [], totalSizeBytes: 0 }).ok).toBe(false);
  });

  it('rejects unknown top-level fields (strict)', () => {
    const bad = { ...structuredClone(VALID), surprise: 1 };
    expect(safeParseBundleManifest(bad).ok).toBe(false);
  });
});
