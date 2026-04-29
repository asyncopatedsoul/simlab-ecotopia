import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createKvStore } from '@engine/storage/kv';
import { createPhotoGate, type GateContext } from '@engine/photoGate';
import { PhotoGateModal } from './PhotoGateModal';

function inMemoryBlobs() {
  const map = new Map<string, Blob>();
  return {
    map,
    async put(path: string, data: Blob | BufferSource) {
      const b = data instanceof Blob ? data : new Blob([data as ArrayBuffer]);
      map.set(path, b);
    },
    async get(path: string) {
      return map.get(path);
    },
    async delete(path: string) {
      map.delete(path);
    },
    async list() {
      return [...map.keys()];
    },
    async bytesUsed() {
      let n = 0;
      for (const b of map.values()) n += b.size;
      return n;
    },
  };
}

function installCreateObjectURL() {
  if (typeof URL.createObjectURL !== 'function') {
    let counter = 0;
    Object.assign(URL, {
      createObjectURL: () => `blob:test/${++counter}`,
      revokeObjectURL: () => {},
    });
  }
}

beforeEach(() => {
  installCreateObjectURL();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('<PhotoGateModal>', () => {
  it('renders nothing when there are no pending photos', () => {
    const gate = createPhotoGate({ kv: createKvStore('m1'), blobs: inMemoryBlobs() });
    const { container } = render(<PhotoGateModal gate={gate} readBlob={async () => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the pending photo and confirms via the parent action', async () => {
    const blobs = inMemoryBlobs();
    const gate = createPhotoGate({ kv: createKvStore('m2'), blobs });
    const photoBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const path = 'photos/window-watch/100.jpg';
    await blobs.put(path, photoBlob);

    const user = userEvent.setup();
    render(<PhotoGateModal gate={gate} readBlob={(p) => blobs.get(p)} />);

    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: true,
    };
    await gate.submit(
      { path, blob: photoBlob, width: 1600, height: 900, capturedAt: 100 },
      ctx,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const confirmedSpy = vi.fn();
    gate.onConfirmed(confirmedSpy);
    await user.click(screen.getByRole('button', { name: 'Save photo' }));
    expect(confirmedSpy).toHaveBeenCalledOnce();
    // Blob still in OPFS.
    expect(blobs.map.has(path)).toBe(true);
  });

  it('discards via the parent action and purges the blob', async () => {
    const blobs = inMemoryBlobs();
    const gate = createPhotoGate({ kv: createKvStore('m3'), blobs });
    const photoBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const path = 'photos/window-watch/100.jpg';
    await blobs.put(path, photoBlob);

    const user = userEvent.setup();
    render(<PhotoGateModal gate={gate} readBlob={(p) => blobs.get(p)} />);

    const ctx: GateContext = {
      scenarioId: 'window-watch',
      ageRung: '5-6',
      mode: 'mentor_apprentice',
      manifestPhotoGate: true,
    };
    await gate.submit(
      { path, blob: photoBlob, width: 1600, height: 900, capturedAt: 100 },
      ctx,
    );

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(blobs.map.has(path)).toBe(false);
  });
});
