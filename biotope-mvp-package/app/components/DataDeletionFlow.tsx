import { useEffect, useState } from 'react';
import type { DataDeletion, DeletionStatus } from '@engine/dataDeletion';

/**
 * Settings → "Delete all my data" flow (bd-priv.3).
 *
 * Three states:
 *   inactive — show a single "Delete all my data" button. Clicking opens the
 *     confirmation prompt; only "Yes, delete in 7 days" actually schedules.
 *   pending  — show the deadline + a "Cancel deletion" button. The kid-side
 *     UI (any other screen) does NOT lose data during the cooling-off; only
 *     the actual sweep on launch is destructive.
 *   (post-sweep) — handled by the next app launch via dataDeletion.sweepIfDue;
 *     this component never sees that state because the app reloads after.
 *
 * No dark patterns: confirm is a separate explicit step; cancel is one tap;
 * the deadline is shown clearly.
 */
export type DataDeletionFlowProps = {
  service: DataDeletion;
  /** Override Date.now for testing. */
  now?: () => number;
};

export function DataDeletionFlow({ service, now = Date.now }: DataDeletionFlowProps) {
  const [status, setStatus] = useState<DeletionStatus>({ state: 'inactive' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void service.status().then(setStatus);
  }, [service]);

  const handleSchedule = async () => {
    setBusy(true);
    try {
      const next = await service.schedule();
      setStatus(next);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await service.cancel();
      setStatus({ state: 'inactive' });
    } finally {
      setBusy(false);
    }
  };

  if (status.state === 'pending') {
    const remainingMs = status.executeAfter - now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    return (
      <section className="data-deletion" aria-labelledby="dd-title">
        <h3 id="dd-title">Deletion pending</h3>
        <p>
          Your data will be deleted in {remainingDays} day{remainingDays === 1 ? '' : 's'}.
          You can cancel any time before then.
        </p>
        <button type="button" onClick={handleCancel} disabled={busy}>
          Cancel deletion
        </button>
      </section>
    );
  }

  return (
    <section className="data-deletion" aria-labelledby="dd-title">
      <h3 id="dd-title">Delete all my data</h3>
      <p>
        This deletes every photo, every saved progress, and every species pack you've
        loaded. You'll have a 7-day cooling-off period to cancel before it's
        irreversible.
      </p>
      {confirming ? (
        <div className="data-deletion__confirm">
          <p>
            <strong>Are you sure?</strong> This will start the 7-day clock. You can
            cancel any time before the clock ends.
          </p>
          <div className="data-deletion__actions">
            <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
              Back
            </button>
            <button type="button" onClick={handleSchedule} disabled={busy}>
              Yes, delete in 7 days
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          Delete all my data
        </button>
      )}
    </section>
  );
}
