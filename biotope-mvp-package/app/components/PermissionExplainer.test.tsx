import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionExplainer } from './PermissionExplainer';
import {
  __resetForTests,
  requestPermission,
  setActiveScenarioStep,
} from '@engine/privacy/permissions';

afterEach(() => {
  __resetForTests();
});

describe('<PermissionExplainer>', () => {
  it('renders nothing when there is no pending request', () => {
    const { container } = render(<PermissionExplainer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the request copy and resolves with confirm/dismiss', async () => {
    const user = userEvent.setup();
    render(<PermissionExplainer />);
    setActiveScenarioStep({ scenarioId: 'window-watch', stepId: 'photograph-bird' });

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });

    const promise = requestPermission({
      kind: 'camera',
      scenarioId: 'window-watch',
      stepId: 'photograph-bird',
      copy: 'Take a picture of the bird you spotted.',
    });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Take a picture of the bird you spotted.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OK' }));
    await expect(promise).resolves.toBe('granted');
  });

  it('returns dismissed when the user clicks "Not now"', async () => {
    const user = userEvent.setup();
    render(<PermissionExplainer />);
    setActiveScenarioStep({ scenarioId: 'window-watch', stepId: 'photograph-bird' });

    const getUserMedia = vi.fn();
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const promise = requestPermission({
      kind: 'camera',
      scenarioId: 'window-watch',
      stepId: 'photograph-bird',
      copy: 'Take a picture of the bird you spotted.',
    });

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Not now' }));

    await expect(promise).resolves.toBe('dismissed');
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
