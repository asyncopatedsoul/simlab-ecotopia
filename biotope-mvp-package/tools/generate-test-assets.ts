/**
 * Generate the bd-engn.1 acceptance test asset:
 *   public/test/cube-on-plane.glb — a glTF scene with a cube on a plane,
 *   Draco-compressed mesh, KTX2-compressed albedo texture.
 *
 * Run with: `npx tsx tools/generate-test-assets.ts`
 *
 * Pipeline:
 *   1. Build a raw glTF programmatically with @gltf-transform/core.
 *   2. Apply Draco mesh compression (draco3d encoder, JS wasm).
 *   3. Apply KTX2/Basis texture compression via the local `toktx` CLI
 *      (KTX-Software). Falls back to leaving the PNG inline if toktx is
 *      unavailable, so the script works in CI without the binary, and
 *      surfaces an obvious warning.
 *
 * The output is committed under public/test/ so the smoke scene can load
 * it offline. Re-run when the test scene needs to change.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const OUT_GLB = resolve(REPO, 'public/test/cube-on-plane.glb');

async function main() {
  mkdirSync(dirname(OUT_GLB), { recursive: true });

  const doc = new Document();
  const buffer = doc.createBuffer();

  const cubeMesh = makeCubeMesh(doc, buffer);
  const planeMesh = makePlaneMesh(doc, buffer);

  // Procedural 64×64 albedo: a soft green checker so we can visually verify
  // texture sampling is happening. Sharp generates the PNG.
  const png = await makeCheckerPng(64);
  const ktx2 = await tryEncodeKTX2(png);
  const textureBytes = ktx2 ?? png;
  const textureMime = ktx2 ? 'image/ktx2' : 'image/png';

  const texture = doc
    .createTexture('checker')
    .setImage(textureBytes)
    .setMimeType(textureMime);

  const cubeMat = doc
    .createMaterial('CubeMat')
    .setBaseColorTexture(texture)
    .setRoughnessFactor(0.7);
  cubeMesh.listPrimitives()[0]!.setMaterial(cubeMat);

  const planeMat = doc
    .createMaterial('PlaneMat')
    .setBaseColorFactor([0.6, 0.7, 0.6, 1])
    .setRoughnessFactor(0.9);
  planeMesh.listPrimitives()[0]!.setMaterial(planeMat);

  const cubeNode = doc.createNode('Cube').setMesh(cubeMesh).setTranslation([0, 0.5, 0]);
  const planeNode = doc.createNode('Plane').setMesh(planeMesh);
  doc.createScene('Test').addChild(cubeNode).addChild(planeNode);

  await doc.transform(draco({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5 }));

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  await io.write(OUT_GLB, doc);
  const sizeKb = (readFileSync(OUT_GLB).byteLength / 1024).toFixed(1);
  console.log(`✓ wrote ${OUT_GLB} (${sizeKb} KB, texture=${textureMime})`);
}

function makeCubeMesh(doc: Document, buffer: ReturnType<Document['createBuffer']>) {
  // 24 vertices for per-face normals/UVs.
  const positions = new Float32Array([
    // +X
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // -X
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5,
    // +Y
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // -Y
    -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    // +Z
    0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
    // -Z
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
  ]);
  const normals = new Float32Array([
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  ]);
  const uvs = new Float32Array([
    0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1,
    0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
    14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);

  const pos = doc.createAccessor('cube_pos').setArray(positions).setType('VEC3').setBuffer(buffer);
  const norm = doc.createAccessor('cube_norm').setArray(normals).setType('VEC3').setBuffer(buffer);
  const uv = doc.createAccessor('cube_uv').setArray(uvs).setType('VEC2').setBuffer(buffer);
  const idx = doc.createAccessor('cube_idx').setArray(indices).setType('SCALAR').setBuffer(buffer);

  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', pos)
    .setAttribute('NORMAL', norm)
    .setAttribute('TEXCOORD_0', uv)
    .setIndices(idx);
  return doc.createMesh('Cube').addPrimitive(prim);
}

function makePlaneMesh(doc: Document, buffer: ReturnType<Document['createBuffer']>) {
  const s = 4;
  const positions = new Float32Array([-s, 0, -s, s, 0, -s, s, 0, s, -s, 0, s]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  const pos = doc.createAccessor('plane_pos').setArray(positions).setType('VEC3').setBuffer(buffer);
  const norm = doc.createAccessor('plane_norm').setArray(normals).setType('VEC3').setBuffer(buffer);
  const uv = doc.createAccessor('plane_uv').setArray(uvs).setType('VEC2').setBuffer(buffer);
  const idx = doc.createAccessor('plane_idx').setArray(indices).setType('SCALAR').setBuffer(buffer);

  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', pos)
    .setAttribute('NORMAL', norm)
    .setAttribute('TEXCOORD_0', uv)
    .setIndices(idx);
  return doc.createMesh('Plane').addPrimitive(prim);
}

async function makeCheckerPng(size: number): Promise<Uint8Array> {
  const cells = 8;
  const cellSize = size / cells;
  const channels = 3;
  const raw = new Uint8Array(size * size * channels);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      const dark = (cx + cy) % 2 === 0;
      const i = (y * size + x) * channels;
      raw[i + 0] = dark ? 0x4f : 0xa8;
      raw[i + 1] = dark ? 0x80 : 0xd4;
      raw[i + 2] = dark ? 0x5c : 0xb3;
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer()
    .then((b) => new Uint8Array(b));
}

async function tryEncodeKTX2(pngBytes: Uint8Array): Promise<Uint8Array | null> {
  // Use toktx via the local KTX-Software install. ETC1S mode for small size +
  // wide GPU support; UASTC would be higher quality at larger size.
  if (!hasToktx()) {
    console.warn('  ! toktx not found on PATH — emitting PNG instead of KTX2.');
    return null;
  }
  const tmpPng = resolve(REPO, 'public/test/.tmp-checker.png');
  const tmpKtx = resolve(REPO, 'public/test/.tmp-checker.ktx2');
  writeFileSync(tmpPng, pngBytes);
  try {
    execFileSync(
      'toktx',
      ['--encode', 'etc1s', '--clevel', '4', '--qlevel', '128', tmpKtx, tmpPng],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const bytes = readFileSync(tmpKtx);
    return new Uint8Array(bytes);
  } catch (e) {
    console.warn('  ! toktx invocation failed:', e instanceof Error ? e.message : e);
    return null;
  } finally {
    try {
      if (existsSync(tmpPng)) execFileSync('rm', [tmpPng]);
      if (existsSync(tmpKtx)) execFileSync('rm', [tmpKtx]);
    } catch {
      /* cleanup is best-effort */
    }
  }
}

function hasToktx(): boolean {
  try {
    execFileSync('toktx', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

await main();
