import { Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import { Suspense, useEffect, type ReactNode } from 'react';
import { setKtx2Renderer } from './loaders';

/**
 * Top-level Canvas wrapper. Wraps R3F's Canvas in a Suspense boundary with a
 * child-friendly loading state, sets sensible mobile defaults (DPR cap,
 * `gl.powerPreference: 'high-performance'`), and wires the KTX2Loader's
 * detectSupport once the WebGLRenderer is available.
 *
 * XR is configured but the wrapping XR provider is not mounted in MVP — the
 * `@react-three/xr` package is installed for future use per bd-engn.1's
 * design notes ("XR deferred but configured").
 */
export type StageProps = {
  children: ReactNode;
  fallback?: ReactNode;
} & Omit<CanvasProps, 'children'>;

export function Stage({ children, fallback, ...canvasProps }: StageProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ powerPreference: 'high-performance', antialias: true }}
      camera={{ position: [3, 2, 4], fov: 50 }}
      {...canvasProps}
    >
      <KTX2Bridge />
      <Suspense fallback={fallback ?? <SceneLoader />}>{children}</Suspense>
    </Canvas>
  );
}

/** Activates KTX2Loader's renderer-driven format detection once GL is up. */
function KTX2Bridge() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setKtx2Renderer(gl);
  }, [gl]);
  return null;
}

/**
 * Default Suspense fallback — a soft pulsing dot in front of the camera.
 * Designed for kids: no spinner, no text, just a friendly "we're loading"
 * cue. Real branded fallback is asset-pipeline work.
 */
function SceneLoader() {
  return (
    <mesh>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial color="#7fb085" />
    </mesh>
  );
}
