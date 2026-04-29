import { ManifestParseError, parseManifest, type Manifest } from '@engine/manifest';
import { compileInk, InkCompileError } from '@engine/narrative';
import type { ScenarioSource } from './sources';
import { ScenarioLoadError, type ScenarioBundle } from './types';

export type LoadScenarioOptions = {
  /**
   * The path inside the scenario folder where the narrative file lives.
   * Defaults to the manifest's `content.narrative`.
   */
  narrativeOverride?: string;
};

/**
 * Load a scenario folder into a ready-to-play bundle:
 *   - Parse manifest.yaml.
 *   - Read content.narrative (manifest-relative path).
 *   - If the file is a `.ink` source, compile to JSON; if `.json`, pass through.
 *
 * Asset loading (3D scenes, audio bundles) is deliberately not done here —
 * scenes are lazy-loaded on phase entry, and the bundles list is the
 * manifest's responsibility. The loader's job is to make the *control* path
 * (manifest + narrative) ready, fast, and synchronous-after-await.
 */
export async function loadScenario(
  scenarioId: string,
  source: ScenarioSource,
  options: LoadScenarioOptions = {},
): Promise<ScenarioBundle> {
  const manifest = await readManifest(source);

  if (manifest.id !== scenarioId) {
    throw new ScenarioLoadError(
      `manifest.id "${manifest.id}" does not match requested scenarioId "${scenarioId}"`,
      'MANIFEST_INVALID',
    );
  }

  const narrativePath = options.narrativeOverride ?? manifest.content.narrative;
  if (narrativePath.includes('..') || narrativePath.startsWith('/')) {
    throw new ScenarioLoadError(
      `narrative path must be relative within the scenario folder: ${narrativePath}`,
      'NARRATIVE_PATH_INVALID',
    );
  }

  const narrativeBytes = await readOrThrow(source, narrativePath, 'INK_MISSING');
  const narrativeText = new TextDecoder().decode(narrativeBytes);

  const { storyJson, inkWarnings } = compileOrPassthrough(narrativeText, narrativePath);

  return {
    manifest,
    storyJson,
    inkWarnings,
    sourceRoot: scenarioId,
  };
}

async function readManifest(source: ScenarioSource): Promise<Manifest> {
  const bytes = await readOrThrow(source, 'manifest.yaml', 'MANIFEST_MISSING');
  try {
    return parseManifest(new TextDecoder().decode(bytes));
  } catch (e) {
    if (e instanceof ManifestParseError) {
      throw new ScenarioLoadError(
        `manifest.yaml failed schema validation: ${e.issues
          .map((i) => `${i.path}: ${i.message}`)
          .join('; ')}`,
        'MANIFEST_INVALID',
        e,
      );
    }
    throw new ScenarioLoadError(
      `failed to parse manifest.yaml: ${e instanceof Error ? e.message : String(e)}`,
      'MANIFEST_INVALID',
      e,
    );
  }
}

async function readOrThrow(
  source: ScenarioSource,
  path: string,
  code: 'MANIFEST_MISSING' | 'INK_MISSING',
): Promise<Uint8Array> {
  try {
    return await source.read(path);
  } catch (e) {
    if (e instanceof ScenarioLoadError) throw e;
    throw new ScenarioLoadError(
      `scenario source missing file: ${path}`,
      code,
      e,
    );
  }
}

function compileOrPassthrough(
  text: string,
  path: string,
): { storyJson: string; inkWarnings: ReadonlyArray<string> } {
  if (path.endsWith('.json')) {
    // Pre-compiled by the asset pipeline. Trust the producer.
    return { storyJson: text, inkWarnings: [] };
  }
  try {
    const result = compileInk(text);
    return { storyJson: result.json, inkWarnings: result.warnings };
  } catch (e) {
    if (e instanceof InkCompileError) {
      throw new ScenarioLoadError(
        `ink compile failed for ${path}: ${e.errors.join('; ')}`,
        'INK_COMPILE_FAILED',
        e,
      );
    }
    throw new ScenarioLoadError(
      `ink compile failed for ${path}: ${e instanceof Error ? e.message : String(e)}`,
      'INK_COMPILE_FAILED',
      e,
    );
  }
}
