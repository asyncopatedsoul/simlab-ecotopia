import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ManifestParseError, parseManifest } from '@engine/manifest';
import { checkAssets } from './checks/assets';
import { checkLocalization } from './checks/localization';
import { checkNarrative } from './checks/narrative';
import { ISSUE_CODES, type ValidationIssue, type ValidationResult } from './types';

/**
 * Run the full bd-auth.2 validation pass against a scenario folder.
 *
 * Order:
 *   1. Schema (zod). If parsing fails, stop — every other check needs the
 *      typed manifest.
 *   2. Assets — file existence + budget.
 *   3. Narrative — Ink compile + node existence for every manifest reference.
 *   4. Localization — one .ink per declared language.
 */
export function validateScenario(folder: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const absFolder = resolve(folder);
  const manifestPath = join(absFolder, 'manifest.yaml');

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      issues: [
        {
          code: ISSUE_CODES.MANIFEST_PARSE_FAILED,
          severity: 'error',
          message: `manifest.yaml not found at ${manifestPath}.`,
          path: manifestPath,
        },
      ],
    };
  }

  let manifest;
  try {
    manifest = parseManifest(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    if (e instanceof ManifestParseError) {
      const wrapped: ValidationIssue[] = e.issues.map((i) => ({
        code: ISSUE_CODES.MANIFEST_INVALID,
        severity: 'error',
        message: i.message,
        path: i.path,
      }));
      return { ok: false, issues: wrapped };
    }
    return {
      ok: false,
      issues: [
        {
          code: ISSUE_CODES.MANIFEST_PARSE_FAILED,
          severity: 'error',
          message: e instanceof Error ? e.message : String(e),
          path: manifestPath,
        },
      ],
    };
  }

  issues.push(...checkAssets(absFolder, manifest));
  issues.push(...checkNarrative(absFolder, manifest));
  issues.push(...checkLocalization(absFolder, manifest));

  const ok = !issues.some((i) => i.severity === 'error');
  return { ok, issues };
}
