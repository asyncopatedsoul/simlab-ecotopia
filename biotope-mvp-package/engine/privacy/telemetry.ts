/**
 * Telemetry: deliberately a no-op in MVP.
 *
 * Per `AGENTS.md` rule 5 and `CLAUDE.md` privacy posture: no third-party
 * analytics, no telemetry by default. This module exists so the rest of the
 * codebase has a stable shape to call into — and so any future opt-in,
 * first-party, on-device-aggregated telemetry has one obvious place to land.
 *
 * Do NOT wire this to any third-party SDK (Segment, mParticle, AppsFlyer, etc.)
 * without filing an issue and getting it through privacy review.
 */
export type TelemetryEvent = {
  name: string;
  /** Properties MUST be non-PII and non-identifying. */
  properties?: Record<string, string | number | boolean>;
};

let sink: ((event: TelemetryEvent) => void) | null = null;

export function track(event: TelemetryEvent): void {
  sink?.(event);
}

/** Test/debug only. The MVP ships with no sink. */
export function __setTelemetrySink(fn: typeof sink): void {
  sink = fn;
}
