import { useEffect, useState } from 'react';
import type { PendingPhotoEntry, PhotoGate } from '@engine/photoGate';

/**
 * Parent-confirmation modal for the photo gate (bd-flda.3).
 *
 * Subscribes to pendingPhotos, shows the most recent capture with confirm /
 * discard buttons. Renders the photo by reading the saved blob from OPFS via
 * the supplied `readBlob` accessor (typically `cameraService.read`).
 *
 * Real seat-aware UI (slide-out parent overlay, long-press badge, kid-side
 * "showing this to your grown-up" state) is bd-rntm.4 work. This modal is
 * the minimal scaffolding that meets bd-flda.3's acceptance — capture →
 * parent confirm or discard → photo flows or is purged.
 */
export type PhotoGateModalProps = {
  gate: PhotoGate;
  readBlob: (path: string) => Promise<Blob | undefined>;
};

export function PhotoGateModal({ gate, readBlob }: PhotoGateModalProps) {
  const [entry, setEntry] = useState<PendingPhotoEntry | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const pending = await gate.listPending();
      if (pending[0]) setEntry(pending[0]);
    })();
    return gate.onPending((e) => setEntry((current) => current ?? e));
  }, [gate]);

  useEffect(() => {
    if (!entry) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    void (async () => {
      const blob = await readBlob(entry.path);
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry, readBlob]);

  if (!entry) return null;

  const handleConfirm = async () => {
    await gate.confirm(entry.path);
    setEntry(null);
  };
  const handleDiscard = async () => {
    await gate.discard(entry.path);
    setEntry(null);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="photo-gate-title" className="photo-gate">
      <div className="photo-gate__card">
        <h2 id="photo-gate-title">Show this to your grown-up</h2>
        {previewUrl ? (
          <img className="photo-gate__preview" src={previewUrl} alt="Pending photo" />
        ) : (
          <div className="photo-gate__preview photo-gate__preview--loading" aria-hidden="true" />
        )}
        <div className="photo-gate__actions">
          <button type="button" onClick={handleDiscard}>
            Discard
          </button>
          <button type="button" onClick={handleConfirm} autoFocus>
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
