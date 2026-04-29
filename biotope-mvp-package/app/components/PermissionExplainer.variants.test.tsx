/**
 * Tests for the bd-priv.3 enhancements to PermissionExplainer:
 *   - kind-specific illustration
 *   - age-rung-aware button labels
 *   - dialog data attributes used by the CSS for rung-specific sizing
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionExplainer } from './PermissionExplainer';
import {
  __resetForTests,
  requestPermission,
  setActiveScenarioStep,
} from '@engine/privacy/permissions';
import type { PermissionRequest } from '@engine/privacy';

afterEach(() => {
  __resetForTests();
  vi.restoreAllMocks();
});

function mockGetUserMedia() {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
}

function fireRequest(req: Omit<PermissionRequest, 'scenarioId' | 'stepId'>): Promise<unknown> {
  setActiveScenarioStep({ scenarioId: 'scn', stepId: 'step' });
  return requestPermission({ scenarioId: 'scn', stepId: 'step', ...req } as PermissionRequest);
}

describe('PermissionExplainer — kind-specific illustration', () => {
  it.each([
    ['camera', '/icons/permission-camera.svg'],
    ['geolocation', '/icons/permission-gps.svg'],
    ['microphone', '/icons/permission-microphone.svg'],
  ] as const)('renders the %s illustration', async (kind, expectedSrc) => {
    render(<PermissionExplainer />);
    mockGetUserMedia();
    const requestArgs: Omit<PermissionRequest, 'scenarioId' | 'stepId'> = {
      kind,
      copy: `Use the ${kind}.`,
      ...(kind === 'geolocation' ? { distanceBoundMeters: 50 } : {}),
    };
    void fireRequest(requestArgs);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.dataset.kind).toBe(kind);
    const illustration = dialog.querySelector('img.permission-explainer__illustration');
    expect(illustration?.getAttribute('src')).toBe(expectedSrc);
  });
});

describe('PermissionExplainer — age-rung-aware button labels', () => {
  it('5-6 rung uses simple Yes/No', async () => {
    render(<PermissionExplainer />);
    mockGetUserMedia();
    void fireRequest({ kind: 'camera', copy: 'x', ageRung: '5-6' });
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it('11-12 rung uses Allow / Don\'t allow', async () => {
    render(<PermissionExplainer />);
    mockGetUserMedia();
    void fireRequest({ kind: 'camera', copy: 'x', ageRung: '11-12' });
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Allow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Don't allow" })).toBeInTheDocument();
  });

  it('no rung set uses default OK / Not now', async () => {
    render(<PermissionExplainer />);
    mockGetUserMedia();
    void fireRequest({ kind: 'camera', copy: 'x' });
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });

  it('exposes ageRung as a data attribute for CSS rung-specific sizing', async () => {
    render(<PermissionExplainer />);
    mockGetUserMedia();
    void fireRequest({ kind: 'camera', copy: 'x', ageRung: '5-6' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog.dataset.rung).toBe('5-6');
  });
});

describe('PermissionExplainer — dialog accessibility', () => {
  it('has role="dialog", aria-modal="true", labelled by the title heading', async () => {
    render(<PermissionExplainer />);
    mockGetUserMedia();
    void fireRequest({ kind: 'camera', copy: 'x' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('permission-explainer-title');
    expect(screen.getByRole('heading', { name: /Use the camera/ })).toBeInTheDocument();
  });
});
