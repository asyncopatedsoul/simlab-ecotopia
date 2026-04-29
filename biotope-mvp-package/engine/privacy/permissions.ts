import type {
  ActiveScenarioStep,
  ExplainerRenderer,
  PermissionKind,
  PermissionRequest,
  PermissionResult,
} from './types';

let activeStep: ActiveScenarioStep | null = null;
let explainerRenderer: ExplainerRenderer | null = null;

export function setActiveScenarioStep(step: ActiveScenarioStep | null): void {
  activeStep = step;
}

export function getActiveScenarioStep(): ActiveScenarioStep | null {
  return activeStep;
}

export function registerExplainerRenderer(fn: ExplainerRenderer | null): void {
  explainerRenderer = fn;
}

export class PermissionGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionGateError';
  }
}

export async function requestPermission(req: PermissionRequest): Promise<PermissionResult> {
  if (!activeStep) {
    throw new PermissionGateError(
      `Permission '${req.kind}' requested with no active scenario step. ` +
        `Permissions may only be requested from inside a scenario step handler.`,
    );
  }
  if (activeStep.scenarioId !== req.scenarioId || activeStep.stepId !== req.stepId) {
    throw new PermissionGateError(
      `Permission request scenarioId/stepId (${req.scenarioId}/${req.stepId}) ` +
        `does not match active step (${activeStep.scenarioId}/${activeStep.stepId}).`,
    );
  }
  if (req.kind === 'geolocation' && (req.distanceBoundMeters == null || req.distanceBoundMeters <= 0)) {
    throw new PermissionGateError(
      'Geolocation requests must specify a positive distanceBoundMeters. ' +
        'GPS may only be used by steps that bound the distance the activity covers.',
    );
  }
  if (!explainerRenderer) {
    throw new PermissionGateError(
      'No explainer renderer registered. The UI must register one at app boot ' +
        'via registerExplainerRenderer().',
    );
  }

  const userChoice = await explainerRenderer(req);
  if (userChoice === 'dismiss') return 'dismissed';

  return invokeOsPrompt(req.kind);
}

async function invokeOsPrompt(kind: PermissionKind): Promise<PermissionResult> {
  switch (kind) {
    case 'camera': {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        return 'granted';
      } catch {
        return 'denied';
      }
    }
    case 'microphone': {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return 'granted';
      } catch {
        return 'denied';
      }
    }
    case 'geolocation': {
      return new Promise<PermissionResult>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          () => resolve('denied'),
          { maximumAge: 60_000, timeout: 10_000 },
        );
      });
    }
  }
}

/** Test-only: reset module state. Not exported from the package barrel. */
export function __resetForTests(): void {
  activeStep = null;
  explainerRenderer = null;
}
