import * as YAML from 'yaml';
import { ZodError } from 'zod';
import { CANONICAL_KEY_ORDER, manifestSchema, type Manifest } from './schema';

export class ManifestParseError extends Error {
  override readonly name = 'ManifestParseError';
  constructor(
    message: string,
    public readonly issues: ReadonlyArray<{ path: string; message: string }>,
    public override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export type ManifestFormat = 'yaml' | 'json';

export type ParseOptions = {
  /** If omitted, the loader auto-detects (JSON if first non-space char is `{`). */
  format?: ManifestFormat;
};

export type StringifyOptions = {
  format?: ManifestFormat;
};

function detectFormat(text: string): ManifestFormat {
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') ? 'json' : 'yaml';
}

function flattenZodIssues(err: ZodError): { path: string; message: string }[] {
  return err.issues.map((issue) => ({
    path: issue.path.join('.') || '<root>',
    message: issue.message,
  }));
}

/** Parse and validate a manifest. Throws `ManifestParseError` on failure. */
export function parseManifest(text: string, options: ParseOptions = {}): Manifest {
  const format = options.format ?? detectFormat(text);

  let raw: unknown;
  try {
    raw = format === 'json' ? JSON.parse(text) : YAML.parse(text);
  } catch (e) {
    throw new ManifestParseError(
      `Failed to parse manifest as ${format}`,
      [{ path: '<root>', message: e instanceof Error ? e.message : String(e) }],
      e,
    );
  }

  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    throw new ManifestParseError(
      'Manifest failed schema validation',
      flattenZodIssues(result.error),
      result.error,
    );
  }
  return canonicalizeKeys(result.data);
}

/**
 * Validate an already-parsed value against the schema. Useful when the input
 * has gone through another parser (e.g., a custom YAML loader in the build
 * pipeline). Returns either the typed manifest or the issues.
 */
export function validateManifest(
  raw: unknown,
):
  | { ok: true; manifest: Manifest }
  | { ok: false; issues: ReadonlyArray<{ path: string; message: string }> } {
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: flattenZodIssues(result.error) };
  }
  return { ok: true, manifest: canonicalizeKeys(result.data) };
}

/** Serialize a manifest to canonical YAML or JSON. */
export function stringifyManifest(manifest: Manifest, options: StringifyOptions = {}): string {
  const format = options.format ?? 'yaml';
  const canonical = canonicalizeKeys(manifest);
  if (format === 'json') {
    return JSON.stringify(canonical, null, 2) + '\n';
  }
  return YAML.stringify(canonical, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
    nullStr: '~',
  });
}

/**
 * Reorder top-level keys to canonical order (`CANONICAL_KEY_ORDER`). Nested
 * object key order is left to zod (which emits keys in schema-definition
 * order) — see schema.ts.
 */
function canonicalizeKeys(manifest: Manifest): Manifest {
  const out: Record<string, unknown> = {};
  for (const key of CANONICAL_KEY_ORDER) {
    if (key in manifest) {
      out[key] = (manifest as Record<string, unknown>)[key];
    }
  }
  // Preserve any unknown top-level keys at the end (forward-compat with v1.x
  // additive changes the parser hasn't been updated for yet).
  for (const key of Object.keys(manifest)) {
    if (!(key in out)) {
      out[key] = (manifest as Record<string, unknown>)[key];
    }
  }
  return out as Manifest;
}
