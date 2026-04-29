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
  /**
   * Optional age rung. When set, the explainer overlay can pick an
   * age-appropriate copy variant + illustration size (bd-priv.3). When
   * absent, the overlay renders the default variant.
   */
  ageRung?: '5-6' | '7-8' | '9-10' | '11-12';
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
