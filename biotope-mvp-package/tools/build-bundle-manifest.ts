/**
 * Build a bundle manifest for a scenario folder.
 *
 * Usage:
 *   npx tsx tools/build-bundle-manifest.ts <scenario-folder> [--out <path>]
 *
 * Walks the folder, hashes every file with sha256, and writes a JSON
 * manifest that the runtime AssetLoader (engine/assets) reads at scenario
 * load time. The scenario's own manifest.yaml provides scenarioId + version.
 *
 * Run after the asset compression pass — the manifest captures the bytes
 * that actually ship.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseManifest } from '../engine/manifest/index';
import type { BundleFile, BundleManifest } from '../engine/assets/types';

function* walk(root: string): Generator<string> {
  for (const name of readdirSync(root)) {
    if (name.startsWith('.')) continue;
    const full = join(root, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (stat.isFile()) {
      yield full;
    }
  }
}

function sha256Hex(bytes: Uint8Array): string {
  const h = createHash('sha256');
  h.update(bytes);
  return h.digest('hex');
}

const EXCLUDE = new Set(['manifest.yaml', 'manifest.yml', 'manifest.json', 'bundle.json']);

function build(scenarioFolder: string): BundleManifest {
  const folder = resolve(scenarioFolder);
  const manifestPath = join(folder, 'manifest.yaml');
  const manifestText = readFileSync(manifestPath, 'utf8');
  const scenarioManifest = parseManifest(manifestText);

  const files: BundleFile[] = [];
  let totalSizeBytes = 0;
  for (const absPath of walk(folder)) {
    const rel = relative(folder, absPath).split('\\').join('/');
    if (EXCLUDE.has(rel)) continue;
    const bytes = new Uint8Array(readFileSync(absPath));
    const sizeBytes = bytes.byteLength;
    if (sizeBytes === 0) continue;
    const sha256 = sha256Hex(bytes);
    files.push({ path: rel, sizeBytes, sha256 });
    totalSizeBytes += sizeBytes;
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    scenarioId: scenarioManifest.id,
    version: scenarioManifest.version,
    totalSizeBytes,
    files,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: build-bundle-manifest <scenario-folder> [--out <path>]');
    process.exit(2);
  }
  const folder = args[0]!;
  const outFlag = args.indexOf('--out');
  const outPath = outFlag >= 0 ? args[outFlag + 1]! : join(folder, 'bundle.json');
  const manifest = build(folder);
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(
    `✓ wrote ${outPath} — ${manifest.files.length} files, ${(manifest.totalSizeBytes / 1024).toFixed(1)} KB`,
  );
  void dirname; // referenced by future relative-path resolution
}

main();
