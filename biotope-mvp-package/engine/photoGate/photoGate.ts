import type { BlobStore, KvStore } from '@engine/storage';
import type { AgeRung } from '@engine/manifest';
import type {
  GateContext,
  PendingPhotoEntry,
  PhotoGate,
  SubmitOutcome,
} from './types';

const KV_PREFIX = 'photo-gate:pending:';

/** Age rungs where the gate is forced on regardless of manifest. */
const FORCE_GATE_RUNGS: ReadonlySet<AgeRung> = new Set(['5-6', '7-8']);

export type CreatePhotoGateOptions = {
  kv: KvStore;
  blobs: BlobStore;
};

export function createPhotoGate(opts: CreatePhotoGateOptions): PhotoGate {
  const { kv, blobs } = opts;

  const pendingListeners = new Set<(e: PendingPhotoEntry) => void>();
  const confirmedListeners = new Set<(e: PendingPhotoEntry) => void>();
  const discardedListeners = new Set<(path: string) => void>();

  function emit<T>(set: Set<(arg: T) => void>, arg: T) {
    for (const l of set) {
      try {
        l(arg);
      } catch {
        /* listener errors must not break the gate */
      }
    }
  }

  function shouldGate(ctx: GateContext): boolean {
    if (ctx.mode === 'solo') return false;
    if (FORCE_GATE_RUNGS.has(ctx.ageRung)) return true;
    return ctx.manifestPhotoGate === true;
  }

  function kvKey(path: string): string {
    return `${KV_PREFIX}${path}`;
  }

  return {
    shouldGate,

    async submit(photo, ctx): Promise<SubmitOutcome> {
      const entry: PendingPhotoEntry = {
        path: photo.path,
        scenarioId: ctx.scenarioId,
        ageRung: ctx.ageRung,
        capturedAt: photo.capturedAt,
        width: photo.width,
        height: photo.height,
      };
      if (!shouldGate(ctx)) {
        emit(confirmedListeners, entry);
        return { state: 'confirmed' };
      }
      await kv.set(kvKey(photo.path), entry);
      emit(pendingListeners, entry);
      return { state: 'pending' };
    },

    async confirm(path) {
      const entry = await kv.get<PendingPhotoEntry>(kvKey(path));
      if (!entry) return; // idempotent
      await kv.delete(kvKey(path));
      emit(confirmedListeners, entry);
    },

    async discard(path) {
      const exists = await kv.get(kvKey(path));
      await kv.delete(kvKey(path));
      await blobs.delete(path);
      if (exists !== undefined) emit(discardedListeners, path);
    },

    async listPending(): Promise<PendingPhotoEntry[]> {
      const keys = await kv.keys(KV_PREFIX);
      const out: PendingPhotoEntry[] = [];
      for (const k of keys) {
        const entry = await kv.get<PendingPhotoEntry>(k);
        if (entry) out.push(entry);
      }
      out.sort((a, b) => a.capturedAt - b.capturedAt);
      return out;
    },

    onPending(listener) {
      pendingListeners.add(listener);
      return () => {
        pendingListeners.delete(listener);
      };
    },
    onConfirmed(listener) {
      confirmedListeners.add(listener);
      return () => {
        confirmedListeners.delete(listener);
      };
    },
    onDiscarded(listener) {
      discardedListeners.add(listener);
      return () => {
        discardedListeners.delete(listener);
      };
    },
  };
}
