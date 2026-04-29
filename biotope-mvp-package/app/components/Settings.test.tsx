import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createDataDeletion } from '@engine/dataDeletion';
import { createNoopEmailTransport, createParentVerification } from '@engine/parentVerification';
import { createKvStore } from '@engine/storage';
import type { BlobStore, KvStore } from '@engine/storage';
import { Settings } from './Settings';

function inMemoryBlobs(): BlobStore {
  const m = new Map<string, Blob>();
  return {
    async put(p, d) {
      m.set(p, d instanceof Blob ? d : new Blob([d as ArrayBuffer]));
    },
    async get(p) { return m.get(p); },
    async delete(p) { m.delete(p); },
    async list() { return [...m.keys()]; },
    async bytesUsed() { return 0; },
  };
}

let kv: KvStore;
beforeEach(() => {
  kv = createKvStore(`settings-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await kv.clear();
  vi.restoreAllMocks();
});

describe('<Settings>', () => {
  it('renders both the parent-verification and data-deletion panels under one heading', async () => {
    const dataDeletion = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    const parentVerification = createParentVerification({ kv, transport: createNoopEmailTransport() });
    render(<Settings dataDeletion={dataDeletion} parentVerification={parentVerification} />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: "Verify a parent's email" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Delete all my data' }),
    ).toBeInTheDocument();
  });

  it('renders without any sign-in gate (account-free)', () => {
    const dataDeletion = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    const parentVerification = createParentVerification({ kv, transport: createNoopEmailTransport() });
    render(<Settings dataDeletion={dataDeletion} parentVerification={parentVerification} />);

    expect(screen.queryByRole('heading', { name: /sign in/i })).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});
