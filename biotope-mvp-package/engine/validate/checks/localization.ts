import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Manifest } from '@engine/manifest';
import { ISSUE_CODES, type ValidationIssue } from '../types';

/**
 * Verify that an Ink file exists for every language declared in
 * languages_available. Convention: `<narrative-folder>/<lang>.ink`,
 * derived from the manifest's `content.narrative` path.
 */
export function checkLocalization(scenarioFolder: string, manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const defaultRel = manifest.content.narrative;
  const narrativeDir = dirname(defaultRel);
  for (const lang of manifest.languages_available) {
    const rel = join(narrativeDir, `${lang}.ink`);
    const abs = resolve(scenarioFolder, rel);
    if (!existsSync(abs)) {
      issues.push({
        code: ISSUE_CODES.LOCALE_MISSING,
        severity: 'error',
        message:
          `Language "${lang}" is in languages_available but no Ink file exists at "${rel}". ` +
          `Add the translation, or remove "${lang}" from languages_available.`,
        path: `languages_available[${lang}]`,
      });
    }
  }
  return issues;
}
