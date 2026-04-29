import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKvStore } from '@engine/storage';
import type { KvStore } from '@engine/storage';
import {
  createNoopEmailTransport,
  createParentVerification,
  VerificationError,
} from './parentVerification';

let kv: KvStore;
beforeEach(() => {
  kv = createKvStore(`pv-test-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await kv.clear();
  vi.restoreAllMocks();
});

describe('parentVerification — happy path', () => {
  it('starts unverified', async () => {
    const transport = createNoopEmailTransport();
    const pv = createParentVerification({ kv, transport });
    expect(await pv.status()).toEqual({ state: 'unverified' });
  });

  it('beginVerification sends a magic link and transitions to awaiting_link', async () => {
    const transport = createNoopEmailTransport();
    const nowMs = 12345;
    const pv = createParentVerification({
      kv,
      transport,
      now: () => nowMs,
      generateToken: () => 'TOKEN_X',
    });
    const status = await pv.beginVerification('parent@example.org');
    expect(status).toEqual({ state: 'awaiting_link', email: 'parent@example.org', sentAt: 12345 });
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.email).toBe('parent@example.org');
    expect(transport.sent[0]?.token.token).toBe('TOKEN_X');
  });

  it('completeVerification with the right token transitions to verified', async () => {
    const transport = createNoopEmailTransport();
    let nowMs = 1000;
    const pv = createParentVerification({
      kv,
      transport,
      now: () => nowMs,
      generateToken: () => 'GOOD',
    });
    await pv.beginVerification('parent@example.org');
    nowMs = 2000;
    const status = await pv.completeVerification('GOOD');
    expect(status).toEqual({
      state: 'verified',
      email: 'parent@example.org',
      verifiedAt: 2000,
    });
  });

  it('verified state survives across instances (rehydrates from kv)', async () => {
    const transport = createNoopEmailTransport();
    const pv1 = createParentVerification({
      kv,
      transport,
      generateToken: () => 'T1',
    });
    await pv1.beginVerification('a@b.org');
    await pv1.completeVerification('T1');

    const pv2 = createParentVerification({ kv, transport });
    const status = await pv2.status();
    expect(status.state).toBe('verified');
  });
});

describe('parentVerification — error paths', () => {
  it('rejects malformed emails before sending', async () => {
    const transport = createNoopEmailTransport();
    const pv = createParentVerification({ kv, transport });
    await expect(pv.beginVerification('not-an-email')).rejects.toMatchObject({
      code: 'INVALID_EMAIL',
    });
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects completeVerification with no awaiting state', async () => {
    const transport = createNoopEmailTransport();
    const pv = createParentVerification({ kv, transport });
    await expect(pv.completeVerification('X')).rejects.toMatchObject({
      code: 'NOT_AWAITING',
    });
  });

  it('rejects mismatched tokens', async () => {
    const transport = createNoopEmailTransport();
    const pv = createParentVerification({
      kv,
      transport,
      generateToken: () => 'CORRECT',
    });
    await pv.beginVerification('a@b.org');
    await expect(pv.completeVerification('WRONG')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects expired tokens (after 24h TTL)', async () => {
    const transport = createNoopEmailTransport();
    let nowMs = 0;
    const pv = createParentVerification({
      kv,
      transport,
      now: () => nowMs,
      generateToken: () => 'GOOD',
    });
    await pv.beginVerification('a@b.org');
    nowMs = 25 * 60 * 60 * 1000; // 25 hours later
    await expect(pv.completeVerification('GOOD')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });

  it('reset clears state back to unverified', async () => {
    const transport = createNoopEmailTransport();
    const pv = createParentVerification({
      kv,
      transport,
      generateToken: () => 'T',
    });
    await pv.beginVerification('a@b.org');
    await pv.completeVerification('T');
    await pv.reset();
    expect(await pv.status()).toEqual({ state: 'unverified' });
  });
});

describe('VerificationError', () => {
  it('is a real Error subclass with name and code', () => {
    const e = new VerificationError('bad', 'INVALID_EMAIL');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('VerificationError');
    expect(e.code).toBe('INVALID_EMAIL');
  });
});
