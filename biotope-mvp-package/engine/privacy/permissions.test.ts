import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PermissionGateError,
  __resetForTests,
  registerExplainerRenderer,
  requestPermission,
  setActiveScenarioStep,
} from './permissions';
import type { PermissionRequest } from './types';

afterEach(() => {
  __resetForTests();
  vi.restoreAllMocks();
});

const cameraReq = (overrides: Partial<PermissionRequest> = {}): PermissionRequest => ({
  kind: 'camera',
  scenarioId: 'window-watch',
  stepId: 'photograph-bird',
  copy: 'We need the camera so you can take a picture of the bird you spotted.',
  ...overrides,
});

describe('permission gating', () => {
  it('throws if no active scenario step is set', async () => {
    await expect(requestPermission(cameraReq())).rejects.toBeInstanceOf(PermissionGateError);
  });

  it('throws if scenarioId/stepId mismatch the active step', async () => {
    setActiveScenarioStep({ scenarioId: 'window-watch', stepId: 'identify-bird' });
    await expect(requestPermission(cameraReq())).rejects.toMatchObject({
      name: 'PermissionGateError',
    });
  });

  it('throws if no explainer renderer is registered', async () => {
    setActiveScenarioStep({ scenarioId: 'window-watch', stepId: 'photograph-bird' });
    await expect(requestPermission(cameraReq())).rejects.toMatchObject({
      name: 'PermissionGateError',
    });
  });

  it('returns dismissed (and never invokes OS prompt) if user dismisses explainer', async () => {
    setActiveScenarioStep({ scenarioId: 'window-watch', stepId: 'photograph-bird' });
    registerExplainerRenderer(async () => 'dismiss');

    const getUserMedia = vi.fn();
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    await expect(requestPermission(cameraReq())).resolves.toBe('dismissed');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('invokes camera OS prompt when explainer is confirmed', async () => {
    setActiveScenarioStep({ scenarioId: 'window-watch', stepId: 'photograph-bird' });
    registerExplainerRenderer(async () => 'confirm');

    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    await expect(requestPermission(cameraReq())).resolves.toBe('granted');
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith({ video: true });
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe('geolocation gating', () => {
  it('rejects geolocation requests without distanceBoundMeters', async () => {
    setActiveScenarioStep({ scenarioId: 'backyard', stepId: 'walk-perimeter' });
    registerExplainerRenderer(async () => 'confirm');

    const req: PermissionRequest = {
      kind: 'geolocation',
      scenarioId: 'backyard',
      stepId: 'walk-perimeter',
      copy: 'We use your location to know how far you walked.',
    };
    await expect(requestPermission(req)).rejects.toBeInstanceOf(PermissionGateError);
  });

  it('rejects geolocation requests with non-positive distanceBoundMeters', async () => {
    setActiveScenarioStep({ scenarioId: 'backyard', stepId: 'walk-perimeter' });
    registerExplainerRenderer(async () => 'confirm');

    const req: PermissionRequest = {
      kind: 'geolocation',
      scenarioId: 'backyard',
      stepId: 'walk-perimeter',
      copy: 'We use your location to know how far you walked.',
      distanceBoundMeters: 0,
    };
    await expect(requestPermission(req)).rejects.toBeInstanceOf(PermissionGateError);
  });

  it('accepts geolocation request with bounded distance', async () => {
    setActiveScenarioStep({ scenarioId: 'backyard', stepId: 'walk-perimeter' });
    registerExplainerRenderer(async () => 'confirm');

    const getCurrentPosition = vi
      .fn<Geolocation['getCurrentPosition']>()
      .mockImplementation((onSuccess) => {
        onSuccess({
          coords: {
            latitude: 49.282,
            longitude: -123.121,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition);
      });
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() },
    });

    const req: PermissionRequest = {
      kind: 'geolocation',
      scenarioId: 'backyard',
      stepId: 'walk-perimeter',
      copy: 'We use your location to know how far you walked.',
      distanceBoundMeters: 50,
    };
    await expect(requestPermission(req)).resolves.toBe('granted');
  });
});

describe('module side effects (acceptance: no permissions at app launch)', () => {
  it('does not touch navigator on import', async () => {
    const navProxy = new Proxy(globalThis.navigator, {
      get(_target, prop) {
        if (prop === 'mediaDevices' || prop === 'geolocation' || prop === 'permissions') {
          throw new Error(`navigator.${String(prop)} accessed during import`);
        }
        return Reflect.get(_target, prop);
      },
    });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navProxy });

    await import('./permissions?fresh=' + Date.now());
    await import('./geo?fresh=' + Date.now());
    await import('./index?fresh=' + Date.now());
  });
});
