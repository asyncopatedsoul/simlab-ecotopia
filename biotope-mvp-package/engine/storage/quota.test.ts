import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuotaObserver } from './quota';

describe('quota observer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the listener once when usage crosses the threshold', async () => {
    let usage = 0;
    const quota = 1_000_000;
    const observer = createQuotaObserver({
      pollIntervalMs: 1000,
      estimate: async () => ({ usage, quota }),
    });
    const listener = vi.fn();
    observer.onThreshold(0.8, listener);

    await vi.runOnlyPendingTimersAsync();
    expect(listener).not.toHaveBeenCalled();

    usage = 850_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      usageBytes: 850_000,
      quotaBytes: 1_000_000,
    });
    expect(listener.mock.calls[0]?.[0].ratio).toBeCloseTo(0.85, 5);

    await vi.advanceTimersByTimeAsync(1000);
    expect(listener).toHaveBeenCalledOnce();
    observer.stop();
  });

  it('re-arms the listener after usage drops below the threshold', async () => {
    let usage = 900_000;
    const observer = createQuotaObserver({
      pollIntervalMs: 1000,
      estimate: async () => ({ usage, quota: 1_000_000 }),
    });
    const listener = vi.fn();
    observer.onThreshold(0.8, listener);

    await vi.runOnlyPendingTimersAsync();
    expect(listener).toHaveBeenCalledTimes(1);

    usage = 500_000;
    await vi.advanceTimersByTimeAsync(1000);
    usage = 850_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(listener).toHaveBeenCalledTimes(2);
    observer.stop();
  });

  it('listener exceptions do not break polling', async () => {
    const observer = createQuotaObserver({
      pollIntervalMs: 1000,
      estimate: async () => ({ usage: 900_000, quota: 1_000_000 }),
    });
    const ok = vi.fn();
    observer.onThreshold(0.8, () => {
      throw new Error('boom');
    });
    observer.onThreshold(0.8, ok);

    await vi.runOnlyPendingTimersAsync();
    expect(ok).toHaveBeenCalledOnce();
    observer.stop();
  });

  it('refresh returns a snapshot without polling', async () => {
    const observer = createQuotaObserver({
      pollIntervalMs: 1000,
      estimate: async () => ({ usage: 500, quota: 1000 }),
    });
    const snap = await observer.refresh();
    expect(snap).toEqual({ usageBytes: 500, quotaBytes: 1000, ratio: 0.5 });
    observer.stop();
  });

  it('handles missing quota gracefully', async () => {
    const observer = createQuotaObserver({
      pollIntervalMs: 1000,
      estimate: async () => ({}),
    });
    const snap = await observer.refresh();
    expect(snap).toEqual({ usageBytes: 0, quotaBytes: 0, ratio: 0 });
    observer.stop();
  });

  it('stops polling when all subscribers unsubscribe', async () => {
    const estimate = vi.fn(async () => ({ usage: 0, quota: 1000 }));
    const observer = createQuotaObserver({ pollIntervalMs: 1000, estimate });
    const off = observer.onThreshold(0.8, () => {});
    await vi.runOnlyPendingTimersAsync();
    const callsBeforeUnsub = estimate.mock.calls.length;
    off();
    await vi.advanceTimersByTimeAsync(5000);
    expect(estimate.mock.calls.length).toBe(callsBeforeUnsub);
    observer.stop();
  });
});
