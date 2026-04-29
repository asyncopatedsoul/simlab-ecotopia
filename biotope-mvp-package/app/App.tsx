import { greet } from '@engine/hello';
import { PermissionExplainer } from '@app/components/PermissionExplainer';

export function App() {
  return (
    <>
      <main className="app">
        <h1>Biotope</h1>
        <p>{greet('explorer')}</p>
      </main>
      <PermissionExplainer />
    </>
  );
}
