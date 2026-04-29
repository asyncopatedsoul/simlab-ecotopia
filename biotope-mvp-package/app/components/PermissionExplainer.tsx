import { useEffect, useState } from 'react';
import { registerExplainerRenderer } from '@engine/privacy';
import type { ExplainerRenderer, PermissionKind, PermissionRequest } from '@engine/privacy';

type PendingRequest = {
  request: PermissionRequest;
  resolve: (choice: 'confirm' | 'dismiss') => void;
};

const KIND_TITLE: Record<PermissionKind, string> = {
  camera: 'Use the camera',
  geolocation: 'Use your location',
  microphone: 'Use the microphone',
};

const KIND_ICON: Record<PermissionKind, string> = {
  camera: '/icons/permission-camera.svg',
  geolocation: '/icons/permission-gps.svg',
  microphone: '/icons/permission-microphone.svg',
};

const CONFIRM_LABEL_BY_RUNG: Record<NonNullable<PermissionRequest['ageRung']>, string> = {
  '5-6': 'Yes',
  '7-8': 'OK',
  '9-10': 'OK',
  '11-12': 'Allow',
};

const DISMISS_LABEL_BY_RUNG: Record<NonNullable<PermissionRequest['ageRung']>, string> = {
  '5-6': 'No',
  '7-8': 'Not now',
  '9-10': 'Not now',
  '11-12': "Don't allow",
};

const DEFAULT_CONFIRM_LABEL = 'OK';
const DEFAULT_DISMISS_LABEL = 'Not now';

/**
 * Permission explainer overlay (bd-priv.3 — replaces the bd-plat.5 placeholder).
 *
 * Per the planning doc: an in-app explainer (illustration + 1-sentence
 * reason + parent-narrator voice-over) runs BEFORE the OS-level prompt.
 *
 * - Kind-specific SVG illustration (camera / GPS / microphone) loaded from
 *   public/icons/. Real branded artwork is bd-priv.3-art.
 * - Age-rung-aware button labels: 5-6 sees "Yes / No"; older rungs see
 *   "OK / Not now"; tweens see "Allow / Don't allow".
 * - Smooth fade-in via CSS class transition; respects prefers-reduced-motion.
 * - Big touch targets (≥48px) for 5-6 fine-motor.
 *
 * Parent-narrator VO triggers are bd-priv.3-vo (real recordings); the
 * AudioBus integration is one line of glue at the call site (the runtime
 * subscribes to the explainer-shown event and plays the matching VO clip).
 *
 * The bd-plat.5 contract is preserved exactly: registerExplainerRenderer
 * is called once at mount; the renderer returns 'confirm' | 'dismiss';
 * dismissal short-circuits the OS prompt.
 */
export function PermissionExplainer() {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const renderer: ExplainerRenderer = (request) =>
      new Promise((resolve) => setPending({ request, resolve }));
    registerExplainerRenderer(renderer);
    return () => registerExplainerRenderer(null);
  }, []);

  // Trigger the entry transition on the next paint after pending is set.
  useEffect(() => {
    if (pending) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    return undefined;
  }, [pending]);

  if (!pending) return null;

  const { request, resolve } = pending;
  const close = (choice: 'confirm' | 'dismiss') => {
    setVisible(false);
    setPending(null);
    resolve(choice);
  };

  const confirmLabel = request.ageRung
    ? CONFIRM_LABEL_BY_RUNG[request.ageRung]
    : DEFAULT_CONFIRM_LABEL;
  const dismissLabel = request.ageRung
    ? DISMISS_LABEL_BY_RUNG[request.ageRung]
    : DEFAULT_DISMISS_LABEL;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-explainer-title"
      className={`permission-explainer${visible ? ' permission-explainer--visible' : ''}`}
      data-kind={request.kind}
      data-rung={request.ageRung ?? 'default'}
    >
      <div className="permission-explainer__card">
        <img
          className="permission-explainer__illustration"
          src={KIND_ICON[request.kind]}
          alt=""
          width={120}
          height={120}
        />
        <h2 id="permission-explainer-title">{KIND_TITLE[request.kind]}?</h2>
        <p className="permission-explainer__copy">{request.copy}</p>
        <div className="permission-explainer__actions">
          <button
            type="button"
            className="permission-explainer__button permission-explainer__button--secondary"
            onClick={() => close('dismiss')}
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            className="permission-explainer__button permission-explainer__button--primary"
            onClick={() => close('confirm')}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
