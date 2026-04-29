import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDataDeletion } from '@engine/dataDeletion';
import { createKvStore } from '@engine/storage';
import type { BlobStore, KvStore } from '@engine/storage';
import { DataDeletionFlow } from './DataDeletionFlow';

function inMemoryBlobs(): BlobStore {
  const m = new Map<string, Blob>();
  return {
    async put(p, d) {
      m.set(p, d instanceof Blob ? d : new Blob([d as ArrayBuffer]));
    },
    async get(p) {
      return m.get(p);
    },
    async delete(p) {
      m.delete(p);
    },
    async list() {
      return [...m.keys()];
    },
    async bytesUsed() {
      return 0;
    },
  };
}

let kv: KvStore;
beforeEach(() => {
  kv = createKvStore(`dd-flow-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await kv.clear();
  vi.restoreAllMocks();
});

describe('<DataDeletionFlow>', () => {
  it('inactive state shows the delete button; clicking opens the confirm step', async () => {
    const user = userEvent.setup();
    const service = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    render(<DataDeletionFlow service={service} />);
    const trigger = await screen.findByRole('button', { name: 'Delete all my data' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Yes, delete in 7 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('Back from the confirm step returns to inactive without scheduling', async () => {
    const user = userEvent.setup();
    const service = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    render(<DataDeletionFlow service={service} />);
    await user.click(await screen.findByRole('button', { name: 'Delete all my data' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText(/Are you sure/)).toBeNull();
    expect(await service.status()).toEqual({ state: 'inactive' });
  });

  it('confirming schedules the deletion and switches to the pending state', async () => {
    const user = userEvent.setup();
    const nowMs = 0;
    const service = createDataDeletion({ kv, blobs: inMemoryBlobs(), now: () => nowMs });
    render(<DataDeletionFlow service={service} now={() => nowMs} />);
    await user.click(await screen.findByRole('button', { name: 'Delete all my data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete in 7 days' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Deletion pending' })).toBeInTheDocument(),
    );
    expect((await service.status()).state).toBe('pending');
  });

  it('shows the remaining days remaining in the pending state', async () => {
    let nowMs = 0;
    const service = createDataDeletion({ kv, blobs: inMemoryBlobs(), now: () => nowMs });
    await service.schedule();
    nowMs = 4 * 24 * 60 * 60 * 1000; // 4 days in
    render(<DataDeletionFlow service={service} now={() => nowMs} />);
    await waitFor(() => {
      expect(screen.getByText(/3 days/)).toBeInTheDocument();
    });
  });

  it('Cancel returns to inactive and unschedules the deletion', async () => {
    const user = userEvent.setup();
    const service = createDataDeletion({ kv, blobs: inMemoryBlobs() });
    await service.schedule();
    render(<DataDeletionFlow service={service} />);
    await user.click(await screen.findByRole('button', { name: 'Cancel deletion' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Delete all my data' })).toBeInTheDocument(),
    );
    expect(await service.status()).toEqual({ state: 'inactive' });
  });
});
