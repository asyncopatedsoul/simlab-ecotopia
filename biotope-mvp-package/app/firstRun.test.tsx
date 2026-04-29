/**
 * Account-free first-run assertion (bd-priv.3).
 *
 * The MVP design says: "Account creation deferred to first save." For local-
 * only photos and no telemetry, that means no account is needed at all.
 * This test pins the assertion: rendering App on a fresh window — no kv,
 * no auth state — produces the home screen, NOT a login or verification
 * gate.
 *
 * If a future change adds a login screen anywhere in the boot path, this
 * test fails and forces an explicit decision.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '@app/App';

describe('first-run UX (account-free)', () => {
  it('home screen renders without any sign-in or verification prompt', () => {
    render(<App />);
    // Home heading is present.
    expect(screen.getByRole('heading', { name: 'Biotope' })).toBeInTheDocument();
    // No sign-in or verification UI on first paint.
    expect(screen.queryByRole('heading', { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /verify a parent's email/i })).toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});
