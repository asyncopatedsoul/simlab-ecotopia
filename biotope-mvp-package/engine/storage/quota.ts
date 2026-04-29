import type { QuotaListener, QuotaObserver, QuotaSnapshot } from './types';

type Subscription = {
  threshold: number;
  listener: QuotaListener;
  /** True if we have fired for the most recent crossing of the threshold. */
  armed: boolean;
};

export type QuotaObserverOptions = {
  /** Polling interval in ms. Default 30s. */
  pollIntervalMs?: number;
  /** Override `navigator.storage.estimate` (test seam). */
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
};

export function createQuotaObserver(opts: QuotaObserverOptions = {}): QuotaObserver {
  const pollIntervalMs = opts.pollIntervalMs ?? 30_000;
  const estimate: () => Promise<{ usage?: number; quota?: number }> =
    opts.estimate ??
    (() => {
      if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
        return Promise.resolve({});
      }
      return navigator.storage.estimate();
    });

  const subs = new Set<Subscription>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  async function snapshot(): Promise<QuotaSnapshot> {
    const e = await estimate();
    const usage = e.usage ?? 0;
    const quota = e.quota ?? 0;
    const ratio = quota > 0 ? usage / quota : 0;
    return { usageBytes: usage, quotaBytes: quota, ratio };
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    const snap = await snapshot();
    for (const sub of subs) {
      if (snap.ratio >= sub.threshold) {
        if (!sub.armed) {
          sub.armed = true;
          try {
            sub.listener(snap);
          } catch {
            /* listener errors must not break polling */
          }
        }
      } else {
        sub.armed = false;
      }
    }
  }

  function ensureTimer(): void {
    if (timer != null || stopped || subs.size === 0) return;
    timer = setInterval(() => {
      void tick();
    }, pollIntervalMs);
  }

  function maybeStopTimer(): void {
    if (timer != null && subs.size === 0) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    onThreshold(threshold, listener) {
      const sub: Subscription = { threshold, listener, armed: false };
      subs.add(sub);
      ensureTimer();
      void tick();
      return () => {
        subs.delete(sub);
        maybeStopTimer();
      };
    },
    refresh: snapshot,
    stop() {
      stopped = true;
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
      subs.clear();
    },
  };
}
