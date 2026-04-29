import { z } from 'zod';
import type { BundleManifest } from './types';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export const bundleFileSchema = z
  .object({
    path: z.string().min(1).regex(/^[^/].*$|^[^/]/, 'path must not start with /'),
    sizeBytes: z.number().int().positive(),
    sha256: z.string().regex(SHA256_HEX, 'sha256 must be 64 lowercase hex chars'),
    contentType: z.string().optional(),
  })
  .strict();

export const bundleManifestSchema = z
  .object({
    scenarioId: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'scenarioId must be a lowercase slug'),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+].+)?$/, 'version must be SemVer'),
    totalSizeBytes: z.number().int().positive(),
    files: z.array(bundleFileSchema).min(1),
  })
  .strict()
  .superRefine((m, ctx) => {
    const summed = m.files.reduce((acc, f) => acc + f.sizeBytes, 0);
    if (summed !== m.totalSizeBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalSizeBytes'],
        message: `totalSizeBytes (${m.totalSizeBytes}) does not equal sum of file sizes (${summed})`,
      });
    }
    const seen = new Set<string>();
    for (const [i, f] of m.files.entries()) {
      if (seen.has(f.path)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['files', i, 'path'],
          message: `duplicate path "${f.path}"`,
        });
      }
      seen.add(f.path);
    }
  });

export function parseBundleManifest(raw: unknown): BundleManifest {
  return bundleManifestSchema.parse(raw) as BundleManifest;
}

export function safeParseBundleManifest(raw: unknown):
  | { ok: true; manifest: BundleManifest }
  | { ok: false; issues: ReadonlyArray<{ path: string; message: string }> } {
  const r = bundleManifestSchema.safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => ({
        path: i.path.join('.') || '<root>',
        message: i.message,
      })),
    };
  }
  return { ok: true, manifest: r.data as BundleManifest };
}
