import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Hook for the kid-friendly "Add to home screen" affordance.
 *
 * - On Android Chrome: captures `beforeinstallprompt` so the app can decide
 *   when to surface the install affordance (NOT at app launch — that's noisy
 *   and triggers the prompt before the user has any context).
 * - On iOS Safari: there is no programmatic install. Returns `isIos: true`
 *   so the UI can show inline "Tap Share → Add to Home Screen" guidance.
 *
 * Per the privacy posture, the prompt is opt-in from a UX moment, not
 * automatic.
 */
export function usePwaInstall() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia?.('(display-mode: standalone)').matches ||
        // iOS Safari standalone flag
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!event) return 'unavailable';
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    return outcome;
  }, [event]);

  const isIos = (() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !(navigator as Navigator & { MSStream?: unknown }).MSStream;
  })();

  return {
    canPromptInstall: event !== null,
    promptInstall,
    isInstalled: installed,
    isIos,
  };
}
