import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compileInk, InkCompileError } from '@engine/narrative';
import type { Manifest } from '@engine/manifest';
import { ISSUE_CODES, type ValidationIssue } from '../types';

/**
 * Walk the compiled Ink JSON to enumerate every reachable knot.stitch path.
 * Inkjs's runtime path resolver (TagsForContentAtPath / ChoosePathString)
 * has side effects or null behavior that's not reliable for "does this path
 * exist" — introspecting the compiled structure directly is cleaner.
 *
 * Compiled Ink layout (per inkjs runtime format):
 *   { "root": [ [...content...], { "<knot>": [...container...] }, "..." ], "inkVersion": 21 }
 *
 * Each container is an array whose last meaningful entry can be a named-
 * children object. We walk the top-level for knots, and each knot for
 * stitches.
 */
function collectInkPaths(json: string): Set<string> {
  const parsed = JSON.parse(json) as { root?: unknown };
  const paths = new Set<string>();
  if (!Array.isArray(parsed.root)) return paths;
  const topNamed = findNamedChildren(parsed.root);
  if (!topNamed) return paths;
  for (const [knotName, knotContainer] of Object.entries(topNamed)) {
    paths.add(knotName);
    if (Array.isArray(knotContainer)) {
      const stitches = findNamedChildren(knotContainer);
      if (stitches) {
        for (const stitchName of Object.keys(stitches)) {
          paths.add(`${knotName}.${stitchName}`);
        }
      }
    }
  }
  return paths;
}

/**
 * In the inkjs runtime format, a container's named children object holds
 * sub-containers — i.e. every value is an array. Other plain objects in the
 * container array are control records (divert `{"->": "path"}`, choice
 * `{"*": "...", "flg": 4}`, etc.) whose values are scalars.
 *
 * Walk the container in reverse — by convention the children object sits
 * near the end, after the content list and any control records.
 */
function findNamedChildren(container: unknown[]): Record<string, unknown> | null {
  for (let i = container.length - 1; i >= 0; i--) {
    const item = container[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) continue;
    const allChildrenAreContainers = entries.every(
      ([k, v]) => !k.startsWith('#') && Array.isArray(v),
    );
    if (allChildrenAreContainers) return obj;
  }
  return null;
}

/**
 * Collect every Ink path referenced from the manifest. Each tuple is the
 * dotted manifest path (for error reporting) and the Ink path string.
 */
export function collectInkReferences(m: Manifest): ReadonlyArray<{
  manifestPath: string;
  inkPath: string;
}> {
  const refs: { manifestPath: string; inkPath: string }[] = [];
  for (const [kind, path] of Object.entries(m.permissions_explainer)) {
    refs.push({ manifestPath: `permissions_explainer.${kind}`, inkPath: path });
  }
  refs.push({
    manifestPath: 'loop.brief.narrative_node',
    inkPath: m.loop.brief.narrative_node,
  });
  for (const [rung, override] of Object.entries(m.loop.brief.skill_rung_overrides ?? {})) {
    if (override && typeof override === 'object' && typeof (override as Record<string, unknown>).narrative_node === 'string') {
      refs.push({
        manifestPath: `loop.brief.skill_rung_overrides.${rung}.narrative_node`,
        inkPath: (override as Record<string, string>).narrative_node!,
      });
    }
  }
  for (const [i, interaction] of m.loop.sim_episode.interactions.entries()) {
    refs.push({
      manifestPath: `loop.sim_episode.interactions.${i}.on_complete`,
      inkPath: interaction.on_complete,
    });
  }
  refs.push({
    manifestPath: 'loop.field_activity.instruction_node',
    inkPath: m.loop.field_activity.instruction_node,
  });
  refs.push({
    manifestPath: 'loop.field_activity.fallback_indoor.narrative_node',
    inkPath: m.loop.field_activity.fallback_indoor.narrative_node,
  });
  refs.push({
    manifestPath: 'loop.re_encoding.sim_response.narrative_node',
    inkPath: m.loop.re_encoding.sim_response.narrative_node,
  });
  refs.push({
    manifestPath: 'loop.re_encoding.sim_response.on_no_observation',
    inkPath: m.loop.re_encoding.sim_response.on_no_observation,
  });
  refs.push({
    manifestPath: 'loop.reflection.narrative_node',
    inkPath: m.loop.reflection.narrative_node,
  });
  for (const [phase, path] of Object.entries(m.mentor_apprentice?.parent_seat.coaching_prompts ?? {})) {
    refs.push({
      manifestPath: `mentor_apprentice.parent_seat.coaching_prompts.${phase}`,
      inkPath: path as string,
    });
  }
  return refs;
}

/**
 * Compile the scenario's Ink file, then check every manifest-referenced node
 * exists by walking the compiled JSON's knot/stitch tree.
 */
export function checkNarrative(scenarioFolder: string, manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inkRel = manifest.content.narrative;
  const inkAbs = resolve(scenarioFolder, inkRel);

  if (!existsSync(inkAbs)) {
    issues.push({
      code: ISSUE_CODES.INK_FILE_MISSING,
      severity: 'error',
      message: `Ink narrative file not found at ${inkRel} (resolved to ${inkAbs}). Check content.narrative in the manifest.`,
      path: inkAbs,
    });
    return issues;
  }

  let inkPaths: Set<string>;
  try {
    const source = readFileSync(inkAbs, 'utf8');
    const { json, warnings } = compileInk(source);
    inkPaths = collectInkPaths(json);
    for (const w of warnings) {
      issues.push({
        code: ISSUE_CODES.INK_COMPILE_FAILED,
        severity: 'warning',
        message: `Ink compile warning in ${inkRel}: ${w}`,
        path: inkAbs,
      });
    }
  } catch (e) {
    if (e instanceof InkCompileError) {
      for (const err of e.errors) {
        issues.push({
          code: ISSUE_CODES.INK_COMPILE_FAILED,
          severity: 'error',
          message: `Ink compile error in ${inkRel}: ${err}`,
          path: inkAbs,
        });
      }
    } else {
      issues.push({
        code: ISSUE_CODES.INK_COMPILE_FAILED,
        severity: 'error',
        message: `Ink compile failed in ${inkRel}: ${e instanceof Error ? e.message : String(e)}`,
        path: inkAbs,
      });
    }
    return issues;
  }

  for (const ref of collectInkReferences(manifest)) {
    if (!inkPaths.has(ref.inkPath)) {
      issues.push({
        code: ISSUE_CODES.INK_MISSING_NODE,
        severity: 'error',
        message:
          `Manifest references Ink node "${ref.inkPath}" at ${ref.manifestPath}, ` +
          `but the node does not exist in ${inkRel}. ` +
          `Add the knot/stitch to the Ink file, or fix the manifest reference.`,
        path: ref.manifestPath,
      });
    }
  }
  void dirname;
  return issues;
}
