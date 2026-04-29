import { useEffect, useState } from 'react';
import { registerExplainerRenderer } from '@engine/privacy';
import type { ExplainerRenderer, PermissionRequest } from '@engine/privacy';

type PendingRequest = {
  request: PermissionRequest;
  resolve: (choice: 'confirm' | 'dismiss') => void;
};

const KIND_LABEL: Record<PermissionRequest['kind'], string> = {
  camera: 'Use the camera',
  geolocation: 'Use your location',
  microphone: 'Use the microphone',
};

/**
 * Mounts at app root. Registers itself as the explainer renderer at mount time
 * and unregisters on unmount. The runtime calls `requestPermission()`, which
 * resolves through the renderer registered here.
 *
 * Visual polish (illustration, parent-narrator VO, animation) is bd-priv.3.
 * This component delivers the behavioral guarantee: no OS prompt fires unless
 * the user explicitly confirms here.
 */
export function PermissionExplainer() {
  const [pending, setPending] = useState<PendingRequest | null>(null);

  useEffect(() => {
    const renderer: ExplainerRenderer = (request) =>
      new Promise((resolve) => setPending({ request, resolve }));
    registerExplainerRenderer(renderer);
    return () => registerExplainerRenderer(null);
  }, []);

  if (!pending) return null;

  const { request, resolve } = pending;
  const close = (choice: 'confirm' | 'dismiss') => {
    setPending(null);
    resolve(choice);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-explainer-title"
      className="permission-explainer"
    >
      <div className="permission-explainer__card">
        <div className="permission-explainer__illustration" aria-hidden="true">
          {/* placeholder — bd-priv.3 will replace with real illustration + VO */}
          🌱
        </div>
        <h2 id="permission-explainer-title">{KIND_LABEL[request.kind]}?</h2>
        <p>{request.copy}</p>
        <div className="permission-explainer__actions">
          <button type="button" onClick={() => close('dismiss')}>
            Not now
          </button>
          <button type="button" onClick={() => close('confirm')} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
