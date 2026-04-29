export type PermissionKind = 'camera' | 'geolocation' | 'microphone';

export type PermissionResult = 'granted' | 'denied' | 'dismissed';

export type PermissionRequest = {
  kind: PermissionKind;
  scenarioId: string;
  stepId: string;
  /** Kid-friendly one-sentence reason shown in the explainer overlay before the OS prompt. */
  copy: string;
  /** Optional: bounded distance in meters for geolocation steps. Required for `geolocation`. */
  distanceBoundMeters?: number;
};

export type ActiveScenarioStep = {
  scenarioId: string;
  stepId: string;
};

/**
 * UI-side renderer for the explainer overlay. Returns `confirm` if the user
 * accepts the explainer (we then trigger the OS prompt) or `dismiss` if they
 * back out — in which case the OS prompt is never shown.
 */
export type ExplainerRenderer = (req: PermissionRequest) => Promise<'confirm' | 'dismiss'>;
