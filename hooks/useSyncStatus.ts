/**
 * hooks/useSyncStatus.ts
 *
 * Consumer hook for UI components (Designer T-204). Returns the current sync
 * state plus a `retry()` handle. Thin wrapper over the zustand store in
 * `stores/syncStatus.ts` — keeping this as its own hook gives us a single
 * import path for consumers and lets us extend the return shape later
 * (e.g. adding a `cancel()` method) without refactoring every call site.
 *
 * History
 * -------
 * T-204 (Designer) shipped a placeholder that returned a bare string
 * ('synced' | 'pending' | 'error'). T-212 (this revision, Backend) replaces
 * it with the real implementation. The string-based tri-state the UI cared
 * about is preserved as a DERIVED value on the return object (`uiStatus`)
 * so WorkoutHeader only has to change its destructure, not its rendering
 * logic.
 *
 * Return shape
 * ------------
 *   status         — full enum reflecting the sync engine's state machine:
 *                    'idle' | 'syncing' | 'synced' | 'error' | 'offline'
 *   uiStatus       — collapsed tri-state for the cloud-icon in the header:
 *                    'synced' | 'pending' | 'error'
 *                    Mapping:
 *                      idle     → 'synced'  (nothing to sync)
 *                      syncing  → 'pending'
 *                      synced   → 'synced'
 *                      error    → 'error'
 *                      offline  → 'pending' (queued waiting for network)
 *   pendingOps     — count of unsynced sets in the active workout
 *   lastSyncedAt   — ISO timestamp of the last successful sync, or null
 *   errorMessage   — short category string ('network' | 'auth' | 'server' |
 *                    'unknown') or null when status !== 'error'
 *   retry()        — function UI calls when the user taps "try again". Safe
 *                    to call in any state.
 *
 * Re-render semantics
 * -------------------
 * zustand's selector subscription means this hook only re-renders when one
 * of the selected fields changes. `retry` is a stable function reference
 * (defined at module scope) so consumers can pass it into memoised
 * components without triggering re-renders.
 */

import { useSyncStore, type SyncStatus as FullSyncStatus } from '@/stores/syncStatus';
import { retrySync } from '@/lib/sync/syncActiveWorkout';

/**
 * The "UI status" the header icon cares about. Kept as a named export so
 * WorkoutHeader can import it for its switch statements (preserving the
 * original tri-state contract from the T-204 placeholder).
 */
export type SyncStatus = 'synced' | 'pending' | 'error';

/** Full sync-engine status — exposed for consumers that want more nuance. */
export type { FullSyncStatus };

export type UseSyncStatusReturn = {
  status: FullSyncStatus;
  uiStatus: SyncStatus;
  pendingOps: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  retry: () => void;
};

function mapToUi(status: FullSyncStatus): SyncStatus {
  switch (status) {
    case 'idle':
    case 'synced':
      return 'synced';
    case 'syncing':
    case 'offline':
      // 'offline' collapses to 'pending' because from the user's POV there's
      // work queued that just hasn't left the device yet. A dedicated offline
      // icon could be added later if product wants to distinguish.
      return 'pending';
    case 'error':
      return 'error';
  }
}

export function useSyncStatus(): UseSyncStatusReturn {
  const status = useSyncStore((s) => s.status);
  const pendingOps = useSyncStore((s) => s.pendingOps);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const errorMessage = useSyncStore((s) => s.errorMessage);

  return {
    status,
    uiStatus: mapToUi(status),
    pendingOps,
    lastSyncedAt,
    errorMessage,
    retry: retrySync,
  };
}
