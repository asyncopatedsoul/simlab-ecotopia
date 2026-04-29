import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Manifest } from '@engine/manifest';
import { ISSUE_CODES, type ValidationIssue } from '../types';

const SIZE_TOLERANCE = 0.05;

/**
 * Asset-budget + file-existence checks. Bundle entries can be a single file
 * path or a glob (with `*` matching anything-but-slash within a single path
 * segment). Sizes from `size_kb` are checked with a ±5% tolerance to allow
 * for re-compression jitter; total `total_size_max_mb` is hard.
 */
export function checkAssets(scenarioFolder: string, manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Asset paths referenced directly by the manifest:
  const directRefs: { manifestPath: string; assetPath: string; mustBeFile?: boolean }[] = [
    {
      manifestPath: 'loop.sim_episode.scene',
      assetPath: manifest.loop.sim_episode.scene,
      mustBeFile: true,
    },
    {
      manifestPath: 'content.narrative',
      assetPath: manifest.content.narrative,
      mustBeFile: true,
    },
    { manifestPath: 'content.species_pack', assetPath: manifest.content.species_pack },
    { manifestPath: 'content.region_pack', assetPath: manifest.content.region_pack },
  ];
  for (const ref of directRefs) {
    const abs = resolve(scenarioFolder, ref.assetPath);
    if (!existsSync(abs)) {
      issues.push({
        code: ISSUE_CODES.ASSET_MISSING,
        severity: 'error',
        message: `Asset referenced from ${ref.manifestPath} ("${ref.assetPath}") does not exist in the scenario folder.`,
        path: ref.manifestPath,
      });
      continue;
    }
    if (ref.mustBeFile && !statSync(abs).isFile()) {
      issues.push({
        code: ISSUE_CODES.ASSET_MISSING,
        severity: 'error',
        message: `Asset referenced from ${ref.manifestPath} ("${ref.assetPath}") is not a regular file.`,
        path: ref.manifestPath,
      });
    }
  }

  // Bundles: each entry is path + size_kb. Path may be a glob.
  let totalBytes = 0;
  for (const [i, bundle] of manifest.assets.bundles.entries()) {
    const matches = expandPath(scenarioFolder, bundle.path);
    if (matches.length === 0) {
      issues.push({
        code: ISSUE_CODES.ASSET_MISSING,
        severity: 'error',
        message: `Asset bundle ${i} ("${bundle.path}") matched no files in the scenario folder.`,
        path: `assets.bundles.${i}.path`,
      });
      continue;
    }
    let bundleBytes = 0;
    for (const f of matches) bundleBytes += statSync(f).size;
    totalBytes += bundleBytes;

    const declaredBytes = bundle.size_kb * 1024;
    const lower = declaredBytes * (1 - SIZE_TOLERANCE);
    const upper = declaredBytes * (1 + SIZE_TOLERANCE);
    if (bundleBytes < lower || bundleBytes > upper) {
      issues.push({
        code: ISSUE_CODES.ASSET_SIZE_MISMATCH,
        severity: 'warning',
        message:
          `Asset bundle ${i} ("${bundle.path}") declares ${bundle.size_kb} KB but actual is ` +
          `${(bundleBytes / 1024).toFixed(1)} KB (>5% drift). Re-run the asset pipeline to update size_kb.`,
        path: `assets.bundles.${i}.size_kb`,
      });
    }
  }

  const budgetBytes = manifest.assets.total_size_max_mb * 1024 * 1024;
  if (totalBytes > budgetBytes) {
    issues.push({
      code: ISSUE_CODES.ASSET_OVER_BUDGET,
      severity: 'error',
      message:
        `Scenario assets total ${(totalBytes / 1024 / 1024).toFixed(2)} MB but the manifest's ` +
        `assets.total_size_max_mb is ${manifest.assets.total_size_max_mb} MB. Compress assets ` +
        `further or split content into a region pack.`,
      path: 'assets.total_size_max_mb',
    });
  }

  return issues;
}

/**
 * Expand a path that may contain `*` against the scenario folder. `*` matches
 * any characters within a single path segment (no recursion). Multiple
 * star-segments in a row are not supported (we don't ship that pattern in
 * MVP).
 */
function expandPath(scenarioFolder: string, relPath: string): string[] {
  if (!relPath.includes('*')) {
    const abs = resolve(scenarioFolder, relPath);
    if (existsSync(abs) && statSync(abs).isFile()) return [abs];
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      // Treat directories as their flattened file set.
      return walkDirectory(abs);
    }
    return [];
  }
  const segments = relPath.split('/');
  const starIndex = segments.findIndex((s) => s.includes('*'));
  const baseSegments = segments.slice(0, starIndex);
  const pattern = segments[starIndex]!;
  const tailSegments = segments.slice(starIndex + 1);
  if (tailSegments.length > 0) {
    // Compound pattern (e.g. dir/*/file.ext). For MVP we don't support — flag.
    return [];
  }
  const baseDir = resolve(scenarioFolder, ...baseSegments);
  if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) return [];
  const regex = globSegmentToRegex(pattern);
  return readdirSync(baseDir)
    .filter((name) => regex.test(name))
    .map((name) => resolve(baseDir, name))
    .filter((p) => statSync(p).isFile());
}

function walkDirectory(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    const s = statSync(p);
    if (s.isFile()) out.push(p);
    else if (s.isDirectory()) out.push(...walkDirectory(p));
  }
  return out;
}

function globSegmentToRegex(seg: string): RegExp {
  let re = '^';
  for (const ch of seg) {
    if (ch === '*') re += '.*';
    else if (/[.+?^${}()|[\]\\]/.test(ch)) re += `\\${ch}`;
    else re += ch;
  }
  re += '$';
  return new RegExp(re);
}

void dirname; // exported helper retained for future tools
