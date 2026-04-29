import type { DataDeletion } from '@engine/dataDeletion';
import type { ParentVerification } from '@engine/parentVerification';
import { DataDeletionFlow } from './DataDeletionFlow';
import { ParentVerificationFlow } from './ParentVerification';

/**
 * Settings panel (bd-priv.3). Composes the two flows that the parent acts on:
 *   - data deletion (always available)
 *   - parent verification (opt-in for features that need a verified email)
 *
 * Account-free first-run is upheld here too — opening Settings doesn't
 * require any login; both flows render their own auth state.
 */
export type SettingsProps = {
  dataDeletion: DataDeletion;
  parentVerification: ParentVerification;
};

export function Settings({ dataDeletion, parentVerification }: SettingsProps) {
  return (
    <div className="settings">
      <h2>Settings</h2>
      <ParentVerificationFlow service={parentVerification} />
      <hr className="settings__divider" />
      <DataDeletionFlow service={dataDeletion} />
    </div>
  );
}
