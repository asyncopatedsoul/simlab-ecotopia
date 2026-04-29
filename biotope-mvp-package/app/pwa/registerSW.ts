import { registerSW } from 'virtual:pwa-register';

/**
 * Register the service worker with auto-update behavior. Called once from
 * main.tsx after React has mounted. The SW takes over after the first visit;
 * subsequent loads (including offline) are served from the precache.
 *
 * Auto-update strategy: when a new SW is detected, it activates immediately
 * on the next page load. We don't currently surface an "update available"
 * toast — for MVP, the kid-driven session loop is short enough that a hard
 * refresh on next app open is the right UX.
 */
export function initServiceWorker(): void {
  registerSW({
    immediate: true,
    onRegisterError(err) {
      console.error('[pwa] service worker registration failed', err);
    },
  });
}
