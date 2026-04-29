import { usePwaInstall } from '@app/pwa/usePwaInstall';

/**
 * Lightweight "Add to home screen" affordance. Renders nothing if the app is
 * already installed or no install path is available. Real placement (when in
 * the session loop to surface it) is product-design work — this is the
 * scaffolding so the hook exists and the affordance can be slotted in later.
 */
export function InstallPrompt() {
  const { canPromptInstall, promptInstall, isInstalled, isIos } = usePwaInstall();

  if (isInstalled) return null;
  if (!canPromptInstall && !isIos) return null;

  return (
    <div className="install-prompt">
      {canPromptInstall && (
        <button
          type="button"
          className="install-prompt__button"
          onClick={() => {
            void promptInstall();
          }}
        >
          Add Biotope to home screen
        </button>
      )}
      {isIos && !canPromptInstall && (
        <p className="install-prompt__hint">
          To install: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}
