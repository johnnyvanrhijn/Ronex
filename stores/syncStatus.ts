/**
 * stores/syncStatus.ts
 *
 * Zustand store that holds the sync state for the active-workout flush.
 *
 * Purpose
 * -------
 * Designer's UI (T-204) reads this store via `useSyncStatus()` (see
 * `hooks/useSyncStatus.ts`) to render a badge: "Synced 12s ago", "Offline",
 * "Syncing…", "Retry" etc. The sync engine (`lib/sync/syncActiveWorkout.ts`)
 * mutates this store as it progresses through attempts.
 *
 * Why a separate store (not part of activeWorkout)?
 * -------------------------------------------------
 * 1. `activeWorkout` is persisted to AsyncStorage on every mutation (see
 *    the `persist` middleware in stores/activeWorkout.ts). Sync status is
 *    transient: restarting the app shouldn't show "syncing" for a workout
 *    whose sync attempt died with the old process. A separate in-memory
 *    store keeps the persistence surface small.
 * 2. UI components that care only about sync-status re-render only when
 *    sync-status changes — not when the user logs a new set. Separating
 *    the stores keeps the re-render graph sane.
 *
 * State machine
 * -------------
 *   idle    — no workout has been touched since app start; nothing to sync.
 *   syncing — an attempt is in flight.
 *   synced  — last attempt succeeded; local state == server state.
 *   error   — last attempt failed AFTER retries were exhausted. UI shows a
 *             manual retry button that calls `retrySync()`.
 *   offline — we believe there's no network. No active attempts; a reconnect
 *             will trigger a fresh sync automatically.
 *
 * Valid transitions (drawn from syncActiveWorkout.ts lifecycle):
 *   idle    → syncing (new mutation arrives online)
 *   idle    → offline (new mutation arrives offline)
 *   syncing → synced  (success)
 *   syncing → error   (all retries exhausted)
 *   syncing → offline (network dropped mid-request)
 *   error   → syncing (user tapped retry)
 *   offline → syncing (reconnect triggers auto-retry)
 *   synced  → syncing (new local mutation)
 *   (any)   → idle    (reset after workout discard/complete-and-cleared)
 *
 * Note: we do NOT enforce these transitions with a guard — the engine is the
 * sole writer and we trust it. The comment above is documentation for anyone
 * extending the engine later.
 */

import { create } from 'zustand';

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline';

export type SyncStore = {
  status: SyncStatus;

  /**
   * ISO8601 timestamp of the last successful sync. Null until the first
   * successful flush. UI uses this to render "synced 12s ago".
   */
  lastSyncedAt: string | null;

  /**
   * Short, generic, user-facing error category. Intentionally NOT the raw
   * Supabase error text — those can leak internals and are rarely helpful.
   * Possible values (today): 'network' | 'auth' | 'server' | 'unknown' | null.
   */
  errorMessage: string | null;

  /**
   * Number of sets in the active workout that have not yet been confirmed
   * to exist on the server (i.e. have `serverId === null`). Updated by the
   * sync engine before and after each attempt. UI can display this as
   * "3 sets pending" when offline.
   */
  pendingOps: number;

  // ---------- Setters (called by the sync engine) ----------
  setStatus: (status: SyncStatus) => void;
  setError: (message: string | null) => void;
  setLastSyncedAt: (iso: string | null) => void;
  setPendingOps: (count: number) => void;

  /**
   * Convenience: set status='synced' + lastSyncedAt=now + errorMessage=null
   * atomically. Avoids a brief UI flicker where pieces of the "success"
   * state commit separately.
   */
  markSynced: () => void;

  /**
   * Convenience: set status='error' + errorMessage. Leaves lastSyncedAt
   * alone so the UI can still show "synced 2 min ago (error since)".
   */
  markError: (message: string) => void;

  /** Reset to initial state — called when the user discards the workout. */
  reset: () => void;
};

const EMPTY: Pick<
  SyncStore,
  'status' | 'lastSyncedAt' | 'errorMessage' | 'pendingOps'
> = {
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,
  pendingOps: 0,
};

export const useSyncStore = create<SyncStore>((set) => ({
  ...EMPTY,

  setStatus: (status) => set({ status }),
  setError: (errorMessage) => set({ errorMessage }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingOps: (pendingOps) => set({ pendingOps }),

  markSynced: () =>
    set({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      errorMessage: null,
    }),

  markError: (message) =>
    set({
      status: 'error',
      errorMessage: message,
    }),

  reset: () => set({ ...EMPTY }),
}));
