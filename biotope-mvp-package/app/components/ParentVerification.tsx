import { useEffect, useState } from 'react';
import { VerificationError } from '@engine/parentVerification';
import type { ParentVerification, VerificationStatus } from '@engine/parentVerification';

/**
 * Parent-verification UI scaffold (bd-priv.3).
 *
 * Three-step flow:
 *   1. Enter email → calls service.beginVerification(email) → magic-link
 *      sent via the registered EmailTransport.
 *   2. "Check your email" screen with a token-paste fallback for environments
 *      where the magic link can't open the app directly (handy in dev too).
 *   3. Verified.
 *
 * The actual email-send backend is bd-priv.3-email — the MVP ships a no-op
 * transport that records calls so this UI is wired end-to-end and can be
 * playtested with a real (test) email address once the backend lands.
 *
 * No dark patterns: at every step the user can back out (Back / Reset). No
 * forced verification — verification is opt-in for features that need it.
 */
export type ParentVerificationProps = {
  service: ParentVerification;
  onVerified?: (email: string) => void;
};

export function ParentVerificationFlow({ service, onVerified }: ParentVerificationProps) {
  const [status, setStatus] = useState<VerificationStatus>({ state: 'unverified' });
  const [emailDraft, setEmailDraft] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void service.status().then(setStatus);
  }, [service]);

  const handleBegin = async () => {
    setError(null);
    setBusy(true);
    try {
      const next = await service.beginVerification(emailDraft.trim());
      setStatus(next);
      setEmailDraft('');
    } catch (e) {
      setError(
        e instanceof VerificationError
          ? errorMessageFor(e.code)
          : `Couldn't send the link: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    setError(null);
    setBusy(true);
    try {
      const next = await service.completeVerification(tokenDraft.trim());
      setStatus(next);
      setTokenDraft('');
      if (next.state === 'verified' && onVerified) onVerified(next.email);
    } catch (e) {
      setError(
        e instanceof VerificationError
          ? errorMessageFor(e.code)
          : `Couldn't verify: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    await service.reset();
    setStatus({ state: 'unverified' });
  };

  if (status.state === 'verified') {
    return (
      <section className="parent-verification" aria-labelledby="pv-title">
        <h3 id="pv-title">Verified</h3>
        <p>Verified as {status.email}.</p>
        <button type="button" onClick={handleReset}>
          Sign out
        </button>
      </section>
    );
  }

  if (status.state === 'awaiting_link') {
    return (
      <section className="parent-verification" aria-labelledby="pv-title">
        <h3 id="pv-title">Check your email</h3>
        <p>
          We sent a link to <strong>{status.email}</strong>. Tap it to confirm. Or paste
          the code from the email here:
        </p>
        <label className="parent-verification__field">
          Code
          <input
            type="text"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            disabled={busy}
            autoComplete="one-time-code"
          />
        </label>
        {error && (
          <p role="alert" className="parent-verification__error">
            {error}
          </p>
        )}
        <div className="parent-verification__actions">
          <button type="button" onClick={handleReset} disabled={busy}>
            Back
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={busy || tokenDraft.trim().length === 0}
          >
            Verify
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="parent-verification" aria-labelledby="pv-title">
      <h3 id="pv-title">Verify a parent's email</h3>
      <p>
        Some features (sharing, syncing across devices) require a parent to confirm by
        email. We'll send a one-tap link.
      </p>
      <label className="parent-verification__field">
        Parent email
        <input
          type="email"
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          disabled={busy}
          autoComplete="email"
          inputMode="email"
        />
      </label>
      {error && (
        <p role="alert" className="parent-verification__error">
          {error}
        </p>
      )}
      <div className="parent-verification__actions">
        <button
          type="button"
          onClick={handleBegin}
          disabled={busy || emailDraft.trim().length === 0}
        >
          Send link
        </button>
      </div>
    </section>
  );
}

function errorMessageFor(code: VerificationError['code']): string {
  switch (code) {
    case 'INVALID_EMAIL':
      return "That doesn't look like an email address. Try again?";
    case 'INVALID_TOKEN':
      return 'That code did not match. Check your email and try again.';
    case 'TOKEN_EXPIRED':
      return 'That code has expired. Send a new one to try again.';
    case 'NOT_AWAITING':
      return "Nothing's waiting on a code right now. Start over.";
  }
}
