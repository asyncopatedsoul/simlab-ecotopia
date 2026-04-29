import { useGLTF } from '@react-three/drei';
import { configureGLTFLoader } from './loaders';

/**
 * Like drei's useGLTF but wires DRACOLoader + KTX2Loader so scenario assets
 * compressed by the asset pipeline (bd-engn.3) decode correctly. Use this
 * instead of `useGLTF` directly inside a `<Stage>`.
 */
export function useScenarioGLTF(url: string) {
  return useGLTF(url, undefined, undefined, (loader) => {
    configureGLTFLoader(loader as unknown as Parameters<typeof configureGLTFLoader>[0]);
  });
}

/** Pre-load a glTF asset without rendering it. Mirrors drei's preload. */
useScenarioGLTF.preload = (url: string): void => {
  useGLTF.preload(url);
};
