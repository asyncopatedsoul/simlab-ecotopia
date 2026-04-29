import { DRACOLoader, KTX2Loader } from 'three-stdlib';
import type { WebGLRenderer } from 'three';

/**
 * Centralized GLTF loader extensions for the whole app. Per the design doc
 * (Component Matrix §7), all glTF assets ship Draco-compressed meshes with
 * KTX2/Basis textures — these loaders are required for useGLTF to decode
 * them.
 *
 * The decoder JS+wasm artifacts are loaded from the same origin (public/
 * subfolders) so they work offline once the SW has them precached. The wasm
 * paths must be configured before any useGLTF call; the App provides them
 * via setLoaderRenderer() at Canvas creation.
 */

const DRACO_DECODER_PATH = '/draco/';
const KTX2_TRANSCODER_PATH = '/basis/';

let dracoLoader: DRACOLoader | null = null;
let ktx2Loader: KTX2Loader | null = null;

export function getDracoLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    dracoLoader.setDecoderConfig({ type: 'js' });
  }
  return dracoLoader;
}

export function getKtx2Loader(): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(KTX2_TRANSCODER_PATH);
  }
  return ktx2Loader;
}

/**
 * KTX2Loader needs the renderer to introspect supported texture formats.
 * Call from inside a Canvas-mounted child (e.g. a `useEffect` after
 * useThree's `gl` is available) so the loader is fully wired before any
 * useGLTF resolves.
 */
export function setKtx2Renderer(gl: WebGLRenderer): void {
  getKtx2Loader().detectSupport(gl);
}

/** drei's GLTFLoader extension hook signature: (loader: GLTFLoader) => void. */
export function configureGLTFLoader(loader: { setDRACOLoader: (l: DRACOLoader) => void; setKTX2Loader: (l: KTX2Loader) => void }): void {
  loader.setDRACOLoader(getDracoLoader());
  loader.setKTX2Loader(getKtx2Loader());
}
