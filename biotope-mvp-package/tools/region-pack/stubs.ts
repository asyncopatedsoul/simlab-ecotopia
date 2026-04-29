/**
 * Stub asset generation for dev region packs.
 *
 * Real bd-spec.2b acquires CC-BY photos from iNaturalist research-grade
 * observations. Until then, the dev pack ships with tiny generated placeholder
 * webp files so the format, loader, and downstream wiring all work end-to-end.
 *
 * Each stub photo is a 64×64 webp with a deterministic color derived from the
 * taxon id, so a developer eyeballing a UI sees distinct tiles instead of a
 * sea of identical placeholders.
 *
 * The generator is intentionally pure: it does not write to disk; the build
 * orchestrator collects bytes and hands them to `buildRegionPack`.
 */

import sharp from 'sharp';
import type { PhotoInput } from '@engine/region-pack';

export const STUB_PHOTO_SIZE_PX = 64;
export const STUB_PHOTOS_PER_TAXON = 3;

export type StubPhotoOptions = {
  taxonId: number;
  /** Number of photos to generate. Defaults to STUB_PHOTOS_PER_TAXON. */
  count?: number;
};

export async function generateStubPhotos(
  options: StubPhotoOptions,
): Promise<PhotoInput[]> {
  const count = options.count ?? STUB_PHOTOS_PER_TAXON;
  const out: PhotoInput[] = [];
  for (let i = 0; i < count; i++) {
    const { r, g, b } = colorForTaxonPhoto(options.taxonId, i);
    const bytes = await renderSolidWebp(STUB_PHOTO_SIZE_PX, { r, g, b });
    out.push({
      path: `photos/${options.taxonId}/${String(i + 1).padStart(3, '0')}.webp`,
      width: STUB_PHOTO_SIZE_PX,
      height: STUB_PHOTO_SIZE_PX,
      byte_size: bytes.byteLength,
      attribution: 'Stub placeholder (dev build) — replace with CC-BY iNat photo before ship',
      license: 'CC0-1.0',
      source_url: null,
      bytes,
    });
  }
  return out;
}

async function renderSolidWebp(
  size: number,
  rgb: { r: number; g: number; b: number },
): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: rgb,
    },
  })
    .webp({ quality: 60, effort: 4 })
    .toBuffer();
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Deterministic color from (taxonId, photoIndex). The hash spreads taxa
 * across hue space; the photo index tweaks lightness so the three stubs for
 * one taxon look like a coherent set.
 */
function colorForTaxonPhoto(
  taxonId: number,
  photoIndex: number,
): { r: number; g: number; b: number } {
  const hue = (taxonId * 47) % 360;
  const lightness = 0.45 + photoIndex * 0.12;
  return hslToRgb(hue / 360, 0.55, lightness);
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}
