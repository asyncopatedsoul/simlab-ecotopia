/**
 * `create-biotope-scenario <slug>` — bd-auth.1 CLI.
 *
 * Run via: `npm run scenario:new -- <slug>` or `npx tsx tools/create-biotope-scenario.ts <slug>`.
 *
 * Copies tools/scenario-template/ into a new <slug>/ folder, substituting
 * placeholders ({{slug}}, {{title}}, {{scene_size_kb}}, {{narrative_size_kb}}).
 * Asset sizes are computed at scaffold time so the resulting manifest's
 * assets.bundles[].size_kb is exact — the scaffold passes biotope-validate
 * with zero warnings, not just zero errors.
 *
 * Non-interactive: takes a slug arg and uses sensible defaults. Interactive
 * prompts (title, age rungs, modes, biome) are a follow-up.
 */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, 'scenario-template');

type Replacements = Record<string, string>;

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function applyReplacements(content: string, replacements: Replacements): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (!(key in replacements)) {
      throw new Error(`Template references {{${key}}} but no replacement was provided.`);
    }
    return replacements[key]!;
  });
}

function copyTemplateTree(srcRoot: string, destRoot: string): string[] {
  const written: string[] = [];
  function walk(srcDir: string) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      const rel = relative(srcRoot, srcPath);
      // Skip .gitkeep — empty placeholder, no value in shipping into user folders.
      if (entry.name === '.gitkeep') continue;

      if (entry.isDirectory()) {
        mkdirSync(join(destRoot, rel), { recursive: true });
        walk(srcPath);
      } else if (entry.isFile()) {
        // .tmpl is handled later (after we have computed sizes).
        if (entry.name.endsWith('.tmpl')) continue;
        const destPath = join(destRoot, rel);
        mkdirSync(dirname(destPath), { recursive: true });
        copyFileSync(srcPath, destPath);
        written.push(destPath);
      }
    }
  }
  walk(srcRoot);
  return written;
}

function renderTemplates(srcRoot: string, destRoot: string, replacements: Replacements): string[] {
  const written: string[] = [];
  function walk(srcDir: string) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      if (entry.isDirectory()) {
        walk(srcPath);
      } else if (entry.isFile() && entry.name.endsWith('.tmpl')) {
        const rel = relative(srcRoot, srcPath).replace(/\.tmpl$/, '');
        const destPath = join(destRoot, rel);
        const text = readFileSync(srcPath, 'utf8');
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, applyReplacements(text, replacements), 'utf8');
        written.push(destPath);
      }
    }
  }
  walk(srcRoot);
  return written;
}

function bytesToSizeKb(bytes: number): string {
  // Round to 1 decimal place so the scaffold and the actual file size match
  // within the validator's ±5% tolerance. For tiny files (like a 130 B .ink),
  // we bottom out at 0.1 KB to keep size_kb positive (zod requires positive).
  const kb = bytes / 1024;
  if (kb < 0.1) return '0.1';
  return (Math.round(kb * 10) / 10).toFixed(1);
}

export function createScenario(targetFolder: string, slug: string, opts: { title?: string } = {}): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Invalid slug "${slug}". Slugs must be lowercase alphanumeric with optional hyphens, starting with a letter or digit.`);
  }
  const dest = resolve(targetFolder, slug);
  // Refuse to scaffold over an existing non-empty folder.
  try {
    const stat = statSync(dest);
    if (stat.isDirectory()) {
      const entries = readdirSync(dest);
      if (entries.length > 0) {
        throw new Error(`Refusing to scaffold into non-empty folder ${dest}.`);
      }
    } else {
      throw new Error(`${dest} exists and is not a directory.`);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  mkdirSync(dest, { recursive: true });

  // 1. Copy verbatim files (incl. scenes/main.glb placeholder).
  copyTemplateTree(TEMPLATE_DIR, dest);

  // 2. Compute asset sizes from the just-copied files.
  const sceneBytes = statSync(join(dest, 'scenes', 'main.glb')).size;
  const narrativeBytes = statSync(join(TEMPLATE_DIR, 'narrative', 'en.ink')).size;

  const title = opts.title ?? slugToTitle(slug);
  const replacements: Replacements = {
    slug,
    title,
    scene_size_kb: bytesToSizeKb(sceneBytes),
    narrative_size_kb: bytesToSizeKb(narrativeBytes),
  };

  // 3. Render .tmpl files with substitutions.
  renderTemplates(TEMPLATE_DIR, dest, replacements);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write('Usage: create-biotope-scenario <slug> [--target <dir>]\n');
    process.exit(2);
  }
  const slug = args[0]!;
  const targetIdx = args.indexOf('--target');
  const target = targetIdx >= 0 ? args[targetIdx + 1]! : process.cwd();

  try {
    createScenario(target, slug);
    const dest = resolve(target, slug);
    process.stdout.write(`✓ scaffolded ${slug} at ${dest}\n`);
    process.stdout.write(`  next: cd ${slug} && npm run scenario:validate -- .\n`);
  } catch (e) {
    process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}

// Only run main when invoked as a script (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
