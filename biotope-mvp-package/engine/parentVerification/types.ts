/**
 * Parent verification (bd-priv.3) — COPPA-style email-loop scaffolding.
 *
 * The MVP architecture has no backend (per AGENTS.md), so the actual
 * "email a magic link" step has no service to call. This module ships the
 * state machine + interface; the email-send + magic-link-verify backend
 * is bd-priv.3-email (filed as a follow-up).
 *
 * Verification is not mandatory for MVP scenarios — local-only photos and
 * no telemetry mean there's no PII collected that requires consent. The
 * flow exists for future opt-in features (sharing, cross-device sync).
 */

export type VerificationStatus =
  | { state: 'unverified' }
  | { state: 'awaiting_link'; email: string; sentAt: number }
  | { state: 'verified'; email: string; verifiedAt: number };

export type VerificationToken = {
  token: string;
  email: string;
  /** Epoch ms; the magic link expires after this. */
  expiresAt: number;
};

export interface ParentVerification {
  status(): Promise<VerificationStatus>;
  /**
   * Begin verification: capture the email and call the registered
   * email-send transport. Transitions state to `awaiting_link`. The
   * transport may reject if the email format is bad or the backend is
   * unavailable.
   */
  beginVerification(email: string): Promise<VerificationStatus>;
  /**
   * Complete verification with a token from a magic link. Transitions to
   * `verified` if the token is valid + matches the awaiting email + not
   * expired; throws otherwise.
   */
  completeVerification(token: string): Promise<VerificationStatus>;
  /** Reset back to unverified. */
  reset(): Promise<void>;
}

/**
 * Email-send transport. Production implementation calls a backend
 * (Mailgun, SendGrid, SES) with a magic-link URL containing the token.
 * The MVP ships a no-op default that records the call for inspection.
 */
export interface EmailTransport {
  sendMagicLink(args: { email: string; token: VerificationToken }): Promise<void>;
}
