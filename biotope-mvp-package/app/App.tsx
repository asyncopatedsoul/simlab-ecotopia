import { Suspense, lazy } from 'react';
import { greet } from '@engine/hello';
import { PermissionExplainer } from '@app/components/PermissionExplainer';
import { InstallPrompt } from '@app/components/InstallPrompt';

const TestSceneStage = lazy(() =>
  import('@app/components/TestScene').then((m) => ({ default: m.TestSceneStage })),
);

export function App() {
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('test-scene')
  ) {
    return (
      <Suspense fallback={<main className="app">Loading scene…</main>}>
        <TestSceneStage />
      </Suspense>
    );
  }
  return (
    <>
      <main className="app">
        <h1>Biotope</h1>
        <p>{greet('explorer')}</p>
        <InstallPrompt />
      </main>
      <PermissionExplainer />
    </>
  );
}
