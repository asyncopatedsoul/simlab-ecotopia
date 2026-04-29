import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateScenario } from '@engine/validate';
import { createScenario } from './create-biotope-scenario';

const tempFolders: string[] = [];

beforeEach(() => {
  tempFolders.length = 0;
});
afterEach(() => {
  while (tempFolders.length) {
    try {
      rmSync(tempFolders.pop()!, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

function mkTempTarget(): string {
  const dir = mkdtempSync(join(tmpdir(), 'create-scenario-'));
  tempFolders.push(dir);
  return dir;
}

describe('createScenario — acceptance', () => {
  it('produces a scaffold that immediately passes biotope-validate with zero errors', () => {
    const target = mkTempTarget();
    createScenario(target, 'test-scenario');
    const folder = join(target, 'test-scenario');

    expect(existsSync(folder)).toBe(true);
    expect(existsSync(join(folder, 'manifest.yaml'))).toBe(true);
    expect(existsSync(join(folder, 'narrative', 'en.ink'))).toBe(true);
    expect(existsSync(join(folder, 'scenes', 'main.glb'))).toBe(true);
    expect(existsSync(join(folder, 'species.json'))).toBe(true);
    expect(existsSync(join(folder, 'README.md'))).toBe(true);

    const result = validateScenario(folder);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('produces zero validator warnings (clean scaffold)', () => {
    const target = mkTempTarget();
    createScenario(target, 'clean-scenario');
    const folder = join(target, 'clean-scenario');
    const result = validateScenario(folder);
    expect(result.issues).toEqual([]);
  });
});

describe('createScenario — slug + title handling', () => {
  it('uses the slug as id and humanizes it for title', () => {
    const target = mkTempTarget();
    createScenario(target, 'backyard-bird-hour');
    const manifestText = readFileSync(
      join(target, 'backyard-bird-hour', 'manifest.yaml'),
      'utf8',
    );
    expect(manifestText).toContain('id: "backyard-bird-hour"');
    expect(manifestText).toContain('title: "Backyard Bird Hour"');
  });

  it('honors a custom title via opts', () => {
    const target = mkTempTarget();
    createScenario(target, 'window-watch', { title: 'Window Watch (alpha)' });
    const text = readFileSync(join(target, 'window-watch', 'manifest.yaml'), 'utf8');
    expect(text).toContain('title: "Window Watch (alpha)"');
  });

  it('rejects invalid slugs', () => {
    const target = mkTempTarget();
    expect(() => createScenario(target, 'Bad Slug')).toThrow(/Invalid slug/);
    expect(() => createScenario(target, '-leading-hyphen')).toThrow(/Invalid slug/);
    expect(() => createScenario(target, 'has_underscore')).toThrow(/Invalid slug/);
  });

  it('refuses to scaffold over a non-empty folder', () => {
    const target = mkTempTarget();
    createScenario(target, 'first');
    expect(() => createScenario(target, 'first')).toThrow(/non-empty folder/);
  });

  it('substitutes the slug into the README too', () => {
    const target = mkTempTarget();
    createScenario(target, 'pond-window');
    const readme = readFileSync(join(target, 'pond-window', 'README.md'), 'utf8');
    expect(readme).toContain('# Pond Window');
    expect(readme).toContain('pond-window/');
  });
});

describe('createScenario — asset sizing', () => {
  it('writes asset bundle size_kb that matches the actual scaffolded files (no drift warning)', () => {
    const target = mkTempTarget();
    createScenario(target, 'sized');
    const folder = join(target, 'sized');
    const result = validateScenario(folder);
    const sizeWarnings = result.issues.filter((i) => i.code === 'ASSET_SIZE_MISMATCH');
    expect(sizeWarnings).toEqual([]);
  });
});
