import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import type { Group } from 'three';
import { Stage, useScenarioGLTF } from '@engine/render';

const TEST_GLB_URL = '/test/cube-on-plane.glb';

/**
 * bd-engn.1 acceptance scene. Renders the Draco-compressed cube + plane with
 * a KTX2-compressed albedo through the same useGLTF path scenarios will use.
 *
 * Visit at `/?test-scene=1` in dev to verify visually.
 */
export function TestSceneStage() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', inset: 0 }}>
      <Stage>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <SpinningCubeOnPlane />
        <OrbitControls makeDefault enableDamping />
      </Stage>
    </div>
  );
}

function SpinningCubeOnPlane() {
  const gltf = useScenarioGLTF(TEST_GLB_URL);
  const cubeRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (cubeRef.current) cubeRef.current.rotation.y += delta * 0.6;
  });

  // The .glb has a `Cube` and `Plane` node under a `Test` scene; clone it
  // and animate the cube node by name.
  const cubeNode = gltf.scene.getObjectByName('Cube');
  const planeNode = gltf.scene.getObjectByName('Plane');

  return (
    <>
      {cubeNode ? <primitive ref={cubeRef} object={cubeNode} /> : null}
      {planeNode ? <primitive object={planeNode} /> : null}
    </>
  );
}
