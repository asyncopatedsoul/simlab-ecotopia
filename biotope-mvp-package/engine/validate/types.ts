/**
 * Validator output (bd-auth.2). Multiple issues per run; the ok flag is
 * shorthand for "no error-severity issues". Warnings are surfaced but
 * don't fail validation.
 */

export type Severity = 'error' | 'warning';

export type ValidationIssue = {
  /** Stable, machine-readable issue id (e.g. 'INK_MISSING_NODE'). */
  code: string;
  severity: Severity;
  /** Human-readable, actionable. Mention the offending path and what to do. */
  message: string;
  /** Optional dotted path into the manifest, file path, or Ink node ref. */
  path?: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ReadonlyArray<ValidationIssue>;
};

export const ISSUE_CODES = {
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  MANIFEST_PARSE_FAILED: 'MANIFEST_PARSE_FAILED',
  ASSET_MISSING: 'ASSET_MISSING',
  ASSET_OVER_BUDGET: 'ASSET_OVER_BUDGET',
  ASSET_SIZE_MISMATCH: 'ASSET_SIZE_MISMATCH',
  INK_FILE_MISSING: 'INK_FILE_MISSING',
  INK_COMPILE_FAILED: 'INK_COMPILE_FAILED',
  INK_MISSING_NODE: 'INK_MISSING_NODE',
  LOCALE_MISSING: 'LOCALE_MISSING',
} as const;

export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES];
