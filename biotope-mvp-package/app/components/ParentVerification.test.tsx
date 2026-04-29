import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createNoopEmailTransport,
  createParentVerification,
} from '@engine/parentVerification';
import { createKvStore } from '@engine/storage';
import type { KvStore } from '@engine/storage';
import { ParentVerificationFlow } from './ParentVerification';

let kv: KvStore;
beforeEach(() => {
  kv = createKvStore(`pv-flow-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await kv.clear();
  vi.restoreAllMocks();
});

describe('<ParentVerificationFlow>', () => {
  it('starts on the email-entry screen with Send link disabled until input', async () => {
    const transport = createNoopEmailTransport();
    const service = createParentVerification({ kv, transport });
    render(<ParentVerificationFlow service={service} />);
    expect(
      await screen.findByRole('heading', { name: "Verify a parent's email" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send link' })).toBeDisabled();
  });

  it('shows a clear inline error for malformed emails (no dark patterns)', async () => {
    const user = userEvent.setup();
    const transport = createNoopEmailTransport();
    const service = createParentVerification({ kv, transport });
    render(<ParentVerificationFlow service={service} />);
    const input = await screen.findByLabelText('Parent email');
    await user.type(input, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("doesn't look like an email"),
    );
    expect(transport.sent).toEqual([]);
  });

  it('walks the happy path: email → awaiting → verify → verified', async () => {
    const user = userEvent.setup();
    const transport = createNoopEmailTransport();
    const service = createParentVerification({
      kv,
      transport,
      generateToken: () => 'TKN_123',
    });
    const onVerified = vi.fn();
    render(<ParentVerificationFlow service={service} onVerified={onVerified} />);

    await user.type(await screen.findByLabelText('Parent email'), 'parent@example.org');
    await user.click(screen.getByRole('button', { name: 'Send link' }));

    await screen.findByRole('heading', { name: 'Check your email' });
    expect(screen.getByText('parent@example.org')).toBeInTheDocument();
    expect(transport.sent).toHaveLength(1);

    await user.type(screen.getByLabelText('Code'), 'TKN_123');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('parent@example.org'));
    expect(await screen.findByRole('heading', { name: 'Verified' })).toBeInTheDocument();
  });

  it('shows a clear inline error when the code is wrong', async () => {
    const user = userEvent.setup();
    const transport = createNoopEmailTransport();
    const service = createParentVerification({
      kv,
      transport,
      generateToken: () => 'CORRECT',
    });
    render(<ParentVerificationFlow service={service} />);

    await user.type(await screen.findByLabelText('Parent email'), 'parent@example.org');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    await screen.findByRole('heading', { name: 'Check your email' });

    await user.type(screen.getByLabelText('Code'), 'WRONG');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('did not match'),
    );
  });

  it('Back from awaiting returns to the email-entry screen', async () => {
    const user = userEvent.setup();
    const transport = createNoopEmailTransport();
    const service = createParentVerification({
      kv,
      transport,
      generateToken: () => 'T',
    });
    render(<ParentVerificationFlow service={service} />);
    await user.type(await screen.findByLabelText('Parent email'), 'a@b.org');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    await screen.findByRole('heading', { name: 'Check your email' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: "Verify a parent's email" }),
      ).toBeInTheDocument(),
    );
  });

  it('verified state: Sign out resets back to unverified', async () => {
    const user = userEvent.setup();
    const transport = createNoopEmailTransport();
    const service = createParentVerification({
      kv,
      transport,
      generateToken: () => 'T',
    });
    await service.beginVerification('a@b.org');
    await service.completeVerification('T');

    render(<ParentVerificationFlow service={service} />);
    await screen.findByRole('heading', { name: 'Verified' });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: "Verify a parent's email" }),
      ).toBeInTheDocument(),
    );
  });
});
