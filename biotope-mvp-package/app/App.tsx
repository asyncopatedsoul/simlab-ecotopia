import { greet } from '@engine/hello';
import { PermissionExplainer } from '@app/components/PermissionExplainer';
import { InstallPrompt } from '@app/components/InstallPrompt';

export function App() {
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
