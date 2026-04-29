import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { greet } from '@engine/hello';
import type { AgeRung, Mode } from '@engine/manifest';
import { createBlobStore, createKvStore } from '@engine/storage';
import { createDataDeletion } from '@engine/dataDeletion';
import { createNoopEmailTransport, createParentVerification } from '@engine/parentVerification';
import type { DataDeletion } from '@engine/dataDeletion';
import type { ParentVerification } from '@engine/parentVerification';
import { createFetchScenarioSource } from '@engine/scenario';
import { PermissionExplainer } from '@app/components/PermissionExplainer';
import { InstallPrompt } from '@app/components/InstallPrompt';
import { Settings } from '@app/components/Settings';
import { ScenarioPlayer } from '@app/scenarioPlayer';

const TestSceneStage = lazy(() =>
  import('@app/components/TestScene').then((m) => ({ default: m.TestSceneStage })),
);

const VALID_RUNGS: ReadonlyArray<AgeRung> = ['5-6', '7-8', '9-10', '11-12'];
const VALID_MODES: ReadonlyArray<Mode> = ['mentor_apprentice', 'solo'];

export function App() {
  if (typeof window === 'undefined') {
    return <DefaultLanding />;
  }
  const params = new URLSearchParams(window.location.search);

  if (params.has('test-scene')) {
    return (
      <Suspense fallback={<main className="app">Loading scene…</main>}>
        <TestSceneStage />
      </Suspense>
    );
  }

  const scenarioId = params.get('scenario');
  if (scenarioId) {
    return <ScenarioRoute scenarioId={scenarioId} params={params} />;
  }

  if (params.has('settings')) {
    return <SettingsRoute />;
  }

  return <DefaultLanding />;
}

function ScenarioRoute({
  scenarioId,
  params,
}: {
  scenarioId: string;
  params: URLSearchParams;
}) {
  const ageRung = (params.get('age') ?? '7-8') as AgeRung;
  const mode = (params.get('mode') ?? 'mentor_apprentice') as Mode;
  // Memoize unconditionally (hooks must not follow an early return).
  const source = useMemo(() => createFetchScenarioSource(`/scenarios/${scenarioId}/`), [scenarioId]);
  const kv = useMemo(() => createKvStore('biotope-kv'), []);

  if (!VALID_RUNGS.includes(ageRung) || !VALID_MODES.includes(mode)) {
    return (
      <main className="app">
        <h1>Bad URL</h1>
        <p>
          age must be one of {VALID_RUNGS.join(', ')}; mode must be one of {VALID_MODES.join(', ')}.
        </p>
      </main>
    );
  }

  return (
    <>
      <ScenarioPlayer
        scenarioId={scenarioId}
        ageRung={ageRung}
        mode={mode}
        source={source}
        kv={kv}
      />
      <PermissionExplainer />
    </>
  );
}

type SettingsServices = {
  dataDeletion: DataDeletion;
  parentVerification: ParentVerification;
};

function SettingsRoute() {
  const [services, setServices] = useState<SettingsServices | null>(null);

  useEffect(() => {
    const kv = createKvStore('biotope-kv');
    void (async () => {
      const blobs = await createBlobStore();
      setServices({
        dataDeletion: createDataDeletion({ kv, blobs }),
        parentVerification: createParentVerification({
          kv,
          transport: createNoopEmailTransport(),
        }),
      });
    })();
  }, []);

  if (!services) {
    return <main className="app"><p>Loading…</p></main>;
  }

  return (
    <>
      <Settings dataDeletion={services.dataDeletion} parentVerification={services.parentVerification} />
      <PermissionExplainer />
    </>
  );
}

function DefaultLanding() {
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
