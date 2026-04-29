import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePwaInstall } from './usePwaInstall';

afterEach(() => {
  vi.restoreAllMocks();
});

function dispatchBeforeInstallPrompt(opts: {
  prompt?: ReturnType<typeof vi.fn>;
  outcome?: 'accepted' | 'dismissed';
}) {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    platforms: string[];
  };
  event.prompt = opts.prompt ?? vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({
    outcome: opts.outcome ?? 'accepted',
    platform: 'android',
  });
  event.platforms = ['android'];
  window.dispatchEvent(event);
  return event;
}

describe('usePwaInstall', () => {
  it('starts with no install event and not installed', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canPromptInstall).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('captures beforeinstallprompt and exposes promptInstall', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      dispatchBeforeInstallPrompt({ prompt, outcome: 'accepted' });
    });
    expect(result.current.canPromptInstall).toBe(true);

    let outcome: 'accepted' | 'dismissed' | 'unavailable' | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe('accepted');
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('promptInstall returns "unavailable" when no event was captured', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const outcome = await result.current.promptInstall();
    expect(outcome).toBe('unavailable');
  });

  it('responds to appinstalled by marking installed', () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      dispatchBeforeInstallPrompt({});
    });
    expect(result.current.canPromptInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canPromptInstall).toBe(false);
  });
});
