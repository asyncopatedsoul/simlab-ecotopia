/**
 * Region pack validator — implements the §9 checks from
 * `docs/region-pack-format.md`. Used by the build CLI as a post-write gate
 * and (per bd-uce) eventually wired into `tools/biotope-validate.ts`.
 *
 * Checks:
 *   - pack.json passes packMetaSchema
 *   - schema_version in pack.json matches REGION_PACK_SCHEMA_VERSION
 *   - pack_meta in data.sqlite agrees with pack.json (pack_id, schema_version)
 *   - stats.taxa_count / photos_count / audio_count match the SQL row counts
 *   - every photos_manifest / audio_manifest row resolves to a file under assets/
 *   - every license + attribution column is non-empty
 *   - every file under assets/ has a manifest row (warning, not error)
 */

import { readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import {
  packMetaSchema,
  REGION_PACK_SCHEMA_VERSION,
} from '@engine/region-pack';

export type ValidatorSeverity = 'error' | 'warning';

export type ValidatorIssue = {
  code: string;
  severity: ValidatorSeverity;
  message: string;
};

export type ValidatorReport = {
  ok: boolean;
  issues: ValidatorIssue[];
  /** Total byte size of pack.json + schema.sql + data.sqlite + every assets/ file. */
  totalBytes: number;
};

export async function validatePackDir(packDir: string): Promise<ValidatorReport> {
  const issues: ValidatorIssue[] = [];
  let totalBytes = 0;

  const packJsonBytes = await safeRead(packDir, 'pack.json');
  if (!packJsonBytes) {
    return {
      ok: false,
      totalBytes: 0,
      issues: [
        {
          code: 'PACK_JSON_MISSING',
          severity: 'error',
          message: 'pack.json not found',
        },
      ],
    };
  }
  totalBytes += packJsonBytes.byteLength;

  let metaRaw: unknown;
  try {
    metaRaw = JSON.parse(new TextDecoder().decode(packJsonBytes));
  } catch (e) {
    return {
      ok: false,
      totalBytes,
      issues: [
        {
          code: 'PACK_JSON_INVALID',
          severity: 'error',
          message: `pack.json is not valid JSON: ${(e as Error).message}`,
        },
      ],
    };
  }
  const parsed = packMetaSchema.safeParse(metaRaw);
  if (!parsed.success) {
    return {
      ok: false,
      totalBytes,
      issues: parsed.error.issues.map((i) => ({
        code: 'PACK_JSON_SCHEMA_INVALID',
        severity: 'error' as const,
        message: `${i.path.join('.') || '<root>'}: ${i.message}`,
      })),
    };
  }
  const meta = parsed.data;

  if (meta.schema_version !== REGION_PACK_SCHEMA_VERSION) {
    issues.push({
      code: 'PACK_SCHEMA_VERSION_UNSUPPORTED',
      severity: 'error',
      message: `pack.json schema_version=${meta.schema_version} but validator supports ${REGION_PACK_SCHEMA_VERSION}`,
    });
  }

  // schema.sql is informational; warn if missing.
  const schemaBytes = await safeRead(packDir, 'schema.sql');
  if (schemaBytes) {
    totalBytes += schemaBytes.byteLength;
  } else {
    issues.push({
      code: 'SCHEMA_SQL_MISSING',
      severity: 'warning',
      message: 'schema.sql not found (informational file expected per format spec)',
    });
  }

  const dbBytes = await safeRead(packDir, 'data.sqlite');
  if (!dbBytes) {
    issues.push({
      code: 'DATA_SQLITE_MISSING',
      severity: 'error',
      message: 'data.sqlite not found',
    });
    return finalize(issues, totalBytes);
  }
  totalBytes += dbBytes.byteLength;

  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBytes);
  try {
    const dbMeta = readPackMetaRows(db);
    if (dbMeta.get('pack_id') !== meta.pack_id) {
      issues.push({
        code: 'PACK_META_PACK_ID_MISMATCH',
        severity: 'error',
        message: `pack.json pack_id=${meta.pack_id} but data.sqlite says ${dbMeta.get('pack_id') ?? '<missing>'}`,
      });
    }
    if (Number(dbMeta.get('schema_version')) !== meta.schema_version) {
      issues.push({
        code: 'PACK_META_SCHEMA_VERSION_MISMATCH',
        severity: 'error',
        message: `pack.json schema_version=${meta.schema_version} but data.sqlite says ${dbMeta.get('schema_version') ?? '<missing>'}`,
      });
    }

    const taxaCount = scalarInt(db, 'SELECT COUNT(*) FROM taxa');
    const photoCount = scalarInt(db, 'SELECT COUNT(*) FROM photos_manifest');
    const audioCount = scalarInt(db, 'SELECT COUNT(*) FROM audio_manifest');

    if (taxaCount !== meta.stats.taxa_count) {
      issues.push({
        code: 'STATS_TAXA_COUNT_MISMATCH',
        severity: 'error',
        message: `stats.taxa_count=${meta.stats.taxa_count} but data.sqlite has ${taxaCount}`,
      });
    }
    if (photoCount !== meta.stats.photos_count) {
      issues.push({
        code: 'STATS_PHOTOS_COUNT_MISMATCH',
        severity: 'error',
        message: `stats.photos_count=${meta.stats.photos_count} but data.sqlite has ${photoCount}`,
      });
    }
    if (audioCount !== meta.stats.audio_count) {
      issues.push({
        code: 'STATS_AUDIO_COUNT_MISMATCH',
        severity: 'error',
        message: `stats.audio_count=${meta.stats.audio_count} but data.sqlite has ${audioCount}`,
      });
    }

    issues.push(...checkLicenseColumns(db));

    const manifestPaths = new Set<string>();
    for (const r of selectRows<{ path: string; license: string }>(
      db,
      'SELECT path, license FROM photos_manifest',
    )) {
      manifestPaths.add(`assets/${r.path}`);
    }
    for (const r of selectRows<{ path: string; license: string }>(
      db,
      'SELECT path, license FROM audio_manifest',
    )) {
      manifestPaths.add(`assets/${r.path}`);
    }

    for (const p of manifestPaths) {
      const bytes = await safeRead(packDir, p);
      if (!bytes) {
        issues.push({
          code: 'ASSET_MISSING',
          severity: 'error',
          message: `${p} listed in manifest but missing on disk`,
        });
      } else {
        totalBytes += bytes.byteLength;
      }
    }

    const onDiskAssets = await listAssetFiles(packDir);
    for (const p of onDiskAssets) {
      if (!manifestPaths.has(p)) {
        issues.push({
          code: 'ASSET_ORPHAN',
          severity: 'warning',
          message: `${p} on disk but no manifest row references it`,
        });
      }
    }
  } finally {
    db.close();
  }

  return finalize(issues, totalBytes);
}

function finalize(issues: ValidatorIssue[], totalBytes: number): ValidatorReport {
  const ok = !issues.some((i) => i.severity === 'error');
  return { ok, issues, totalBytes };
}

async function safeRead(packDir: string, relPath: string): Promise<Uint8Array | null> {
  try {
    const buf = await readFile(join(packDir, relPath.split('/').join(sep)));
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

function readPackMetaRows(db: Database): Map<string, string> {
  const rows = selectRows<{ key: string; value: string }>(db, 'SELECT key, value FROM pack_meta');
  return new Map(rows.map((r) => [r.key, r.value]));
}

function selectRows<T>(db: Database, sql: string): T[] {
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const { columns, values } = result[0]!;
  return values.map((row) => {
    const obj: Record<string, SqlValue> = {};
    columns.forEach((c, i) => {
      obj[c] = row[i] ?? null;
    });
    return obj as T;
  });
}

function scalarInt(db: Database, sql: string): number {
  const result = db.exec(sql);
  return Number(result[0]?.values[0]?.[0] ?? 0);
}

function checkLicenseColumns(db: Database): ValidatorIssue[] {
  const issues: ValidatorIssue[] = [];
  for (const tbl of ['photos_manifest', 'audio_manifest']) {
    const bad = selectRows<{ path: string }>(
      db,
      `SELECT path FROM ${tbl} WHERE license IS NULL OR license = '' OR attribution IS NULL OR attribution = ''`,
    );
    for (const r of bad) {
      issues.push({
        code: 'LICENSE_OR_ATTRIBUTION_MISSING',
        severity: 'error',
        message: `${tbl} row ${r.path} has empty license or attribution`,
      });
    }
  }
  return issues;
}

async function listAssetFiles(packDir: string): Promise<string[]> {
  const out: string[] = [];
  await walk(packDir, 'assets', out);
  return out;
}

async function walk(packDir: string, rel: string, out: string[]): Promise<void> {
  const { readdir } = await import('node:fs/promises');
  const full = join(packDir, rel.split('/').join(sep));
  let entries;
  try {
    entries = await readdir(full, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const childRel = `${rel}/${ent.name}`;
    if (ent.isDirectory()) {
      await walk(packDir, childRel, out);
    } else if (ent.isFile()) {
      out.push(childRel);
    }
  }
}

/** Convenience: returns true if the pack passes all error-severity checks. */
export async function packPasses(packDir: string): Promise<boolean> {
  const r = await validatePackDir(packDir);
  return r.ok;
}

/** Total on-disk size in bytes (best-effort), useful for budget checks. */
export async function packDiskSize(packDir: string): Promise<number> {
  const r = await validatePackDir(packDir);
  return r.totalBytes;
}
