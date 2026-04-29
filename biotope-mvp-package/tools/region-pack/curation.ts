/**
 * Curation CSV parser for region pack builds.
 *
 * Format (one row per taxon, header required):
 *   id,scientific_name,rank,kingdom,class,common_name_en,common_name_es,
 *   inat_taxon_id,gbif_taxon_id,scenarios,notes
 *
 * - `id` is the integer pack-internal id used everywhere downstream. Stable
 *   across pack rebuilds — do NOT renumber.
 * - `class` is allowed empty (plants/fungi).
 * - `common_name_es` is optional.
 * - `inat_taxon_id` and `gbif_taxon_id` are optional integers; blank for stub
 *   packs that have not been reconciled against iNat/GBIF yet.
 * - `scenarios` is a `;`-separated list of scenario slugs that need this
 *   taxon. The build emits a coverage report so authors can spot gaps.
 * - `notes` is a free-form human note (skipped by the build).
 *
 * The parser is intentionally hand-rolled and tolerates RFC 4180-quoted
 * values (commas + escaped quotes inside quoted fields). It rejects rows
 * with the wrong column count rather than guessing at intent.
 */

import type { Kingdom, TaxonRank } from '@engine/region-pack';

export type CurationRow = {
  id: number;
  scientific_name: string;
  rank: TaxonRank;
  kingdom: Kingdom;
  class: string | null;
  common_name_en: string;
  common_name_es: string | null;
  inat_taxon_id: number | null;
  gbif_taxon_id: number | null;
  /** Scenario slugs this taxon is needed by. */
  scenarios: string[];
  notes: string;
};

export class CurationParseError extends Error {
  override readonly name = 'CurationParseError';
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(`${message} (line ${line})`);
  }
}

const REQUIRED_HEADERS = [
  'id',
  'scientific_name',
  'rank',
  'kingdom',
  'class',
  'common_name_en',
  'common_name_es',
  'inat_taxon_id',
  'gbif_taxon_id',
  'scenarios',
  'notes',
] as const;

const VALID_RANKS: ReadonlySet<TaxonRank> = new Set(['species', 'subspecies', 'genus']);
const VALID_KINGDOMS: ReadonlySet<Kingdom> = new Set(['Animalia', 'Plantae', 'Fungi']);

export function parseCurationCsv(text: string): CurationRow[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    throw new CurationParseError('curation CSV is empty', 1);
  }

  const headerCells = parseCsvRow(lines[0]!, 1);
  for (const [i, expected] of REQUIRED_HEADERS.entries()) {
    if (headerCells[i] !== expected) {
      throw new CurationParseError(
        `header column ${i + 1} must be "${expected}", got "${headerCells[i] ?? ''}"`,
        1,
      );
    }
  }

  const rows: CurationRow[] = [];
  const seenIds = new Set<number>();
  for (let i = 1; i < lines.length; i++) {
    const lineText = lines[i]!;
    if (lineText.trim() === '' || lineText.trimStart().startsWith('#')) continue;
    const cells = parseCsvRow(lineText, i + 1);
    if (cells.length !== REQUIRED_HEADERS.length) {
      throw new CurationParseError(
        `expected ${REQUIRED_HEADERS.length} columns, got ${cells.length}`,
        i + 1,
      );
    }

    const id = parseRequiredInt(cells[0]!, 'id', i + 1);
    if (seenIds.has(id)) {
      throw new CurationParseError(`duplicate id: ${id}`, i + 1);
    }
    seenIds.add(id);

    const rank = cells[2]!.trim() as TaxonRank;
    if (!VALID_RANKS.has(rank)) {
      throw new CurationParseError(`rank must be one of ${[...VALID_RANKS].join('|')}`, i + 1);
    }
    const kingdom = cells[3]!.trim() as Kingdom;
    if (!VALID_KINGDOMS.has(kingdom)) {
      throw new CurationParseError(
        `kingdom must be one of ${[...VALID_KINGDOMS].join('|')}`,
        i + 1,
      );
    }

    const scientific_name = cells[1]!.trim();
    const common_name_en = cells[5]!.trim();
    if (!scientific_name) {
      throw new CurationParseError('scientific_name is required', i + 1);
    }
    if (!common_name_en) {
      throw new CurationParseError('common_name_en is required', i + 1);
    }

    rows.push({
      id,
      scientific_name,
      rank,
      kingdom,
      class: cells[4]!.trim() || null,
      common_name_en,
      common_name_es: cells[6]!.trim() || null,
      inat_taxon_id: parseOptionalInt(cells[7]!, 'inat_taxon_id', i + 1),
      gbif_taxon_id: parseOptionalInt(cells[8]!, 'gbif_taxon_id', i + 1),
      scenarios: cells[9]!
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: cells[10]!.trim(),
    });
  }

  return rows;
}

/** Build a coverage report: which scenarios are covered, which species are unused. */
export type ScenarioCoverage = {
  scenarioCounts: Map<string, number>;
  unscoped: CurationRow[];
};

export function reportScenarioCoverage(rows: CurationRow[]): ScenarioCoverage {
  const counts = new Map<string, number>();
  const unscoped: CurationRow[] = [];
  for (const r of rows) {
    if (r.scenarios.length === 0) {
      unscoped.push(r);
      continue;
    }
    for (const s of r.scenarios) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  return { scenarioCounts: counts, unscoped };
}

// ─── csv lexer ────────────────────────────────────────────────────────

function splitLines(text: string): string[] {
  // Normalize CRLF + strip a trailing newline so we don't emit an empty row.
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
}

function parseCsvRow(line: string, lineNum: number): string[] {
  const cells: string[] = [];
  let i = 0;
  // Outer loop runs once per cell. We push exactly one cell per iteration,
  // then either consume a comma and continue (next cell) or break.
  // The `i === line.length` case yields a final empty cell when the line
  // ended with a comma — handled by entering the unquoted branch with
  // line[i] === undefined and pushing acc=''.
  while (i <= line.length) {
    let acc = '';
    if (line[i] === '"') {
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          acc += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          acc += line[i];
          i++;
        }
      }
      if (i < line.length && line[i] !== ',') {
        throw new CurationParseError(`expected ',' after quoted cell`, lineNum);
      }
    } else {
      while (i < line.length && line[i] !== ',') {
        acc += line[i];
        i++;
      }
    }
    cells.push(acc);
    if (line[i] === ',') {
      i++;
    } else {
      break;
    }
  }
  return cells;
}

function parseRequiredInt(raw: string, field: string, line: number): number {
  const v = raw.trim();
  if (!v) throw new CurationParseError(`${field} is required`, line);
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new CurationParseError(`${field} must be an integer, got "${v}"`, line);
  }
  return n;
}

function parseOptionalInt(raw: string, field: string, line: number): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new CurationParseError(`${field} must be an integer, got "${v}"`, line);
  }
  return n;
}
