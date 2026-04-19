/**
 * lib/sync/syncActiveWorkout.ts
 *
 * Task T-212 — Offline-first sync engine for the active workout.
 *
 * Responsibility
 * --------------
 * Take the current `useActiveWorkout` state (client-owned, offline-safe) and
 * reconcile it against Supabase. Runs outside the React tree so it survives
 * component unmounts and doesn't block UI.
 *
 * Non-goals (deferred)
 * --------------------
 * - Multi-device merge / conflict resolution. MVP policy is last-write-wins;
 *   two devices editing the same workout simultaneously will overwrite each
 *   other's changes. See docs/ARCHITECTURE.md for rationale.
 * - Server-side orphan cleanup. If a user discards a local workout after
 *   parts have synced, the server row is left as-is; a periodic cleanup job
 *   (Phase 3+) can sweep stale `completed_at IS NULL` workouts.
 * - Sync of PRs. T-214 owns that, on a separate code path.
 *
 * High-level contract
 * -------------------
 *   scheduleSync()       — debounced entry point. Setter mutations call this.
 *   scheduleImmediate()  — no-debounce entry point. completeWorkout() calls.
 *   retrySync()          — manual retry after `error` status.
 *   initSync()           — module-lifecycle hook that wires up the reconnect-
 *                          triggers auto-retry. Called from app root (future).
 *
 * Strategy for THIS MVP
 * ---------------------
 * 1. Optimistic local write + reactive background sync (no event queue).
 *    Every mutation on `useActiveWorkout` happens in-memory + AsyncStorage
 *    FIRST. THEN we schedule a sync to mirror the state to Postgres.
 *
 * 2. "Always upsert all sets" dirty policy.
 *    We do NOT track per-field dirty bits. Each sync attempt sends the full
 *    set list up. Rationale: (a) sets are tiny (<200 bytes each), (b) a
 *    typical workout has <40 sets, (c) avoiding dirty tracking eliminates a
 *    whole class of "I updated the set but didn't mark it dirty" bugs which
 *    are painful to diagnose. Network overhead is ~8KB per sync max, which
 *    is trivial even on 3G. Flagged for Phase 3 optimization if it ever
 *    matters (spoiler: it won't).
 *
 * 3. Single in-flight attempt; coalescing.
 *    If a sync is already running, setter mutations don't spawn a second one.
 *    Instead we set a "dirty" flag and re-run once the first attempt settles.
 *    This prevents two parallel writes from racing on the same workout row.
 *
 * 4. Retry with exponential backoff.
 *    Failures inside a single attempt retry at 1s → 2s → 4s (cap 10s) for a
 *    maximum of 3 attempts. After the third failure, status flips to `error`
 *    and the user must manually call retrySync(). This balances "glitchy
 *    wifi recovers in 2-6s" against "don't drain the user's battery doing
 *    exponential retries forever".
 *
 * 5. Network-aware.
 *    Before kicking off an attempt we check `getIsOnline()`. If false, we
 *    flip status to `offline` and bail. A reconnect event (subscribeOnline)
 *    re-triggers the sync.
 *
 * 6. Auth-aware.
 *    `supabase.auth.getUser()` is checked on every attempt. No session =
 *    same behaviour as offline (no attempt, no error). RLS policies from
 *    T-201 handle the "is this user's own workout?" check server-side.
 *
 * Interaction with activeWorkout store
 * ------------------------------------
 * The sync engine reads via `useActiveWorkout.getState()` and writes back
 * via the store's setters (`setWorkoutId`, `setServerIdForLocal`). It DOES
 * NOT mutate set fields other than serverId — if the user edits a set while
 * a sync is in flight, the edit is on the next attempt.
 *
 * The setters in activeWorkout.ts call `scheduleSync()` (see the integration
 * in that file). When a setter fires:
 *   1. Local state updates immediately (in-memory + AsyncStorage).
 *   2. scheduleSync() is called → debounce timer resets to 500ms.
 *   3. After 500ms of quiet, the attempt runs.
 */

import { supabase } from '@/lib/supabase';
import { useActiveWorkout, serializeForInsert } from '@/stores/activeWorkout';
import { useSyncStore } from '@/stores/syncStatus';
import { getIsOnline, subscribeOnline } from '@/lib/network/useIsOnline';
import { queryClient } from '@/lib/queryClient';
import { lastSetQueryKey } from '@/lib/queries/useLastSetForExercise';

// ---------- Tunables ----------

/** Debounce window for setter-triggered syncs. Rapid logging of sets doesn't
 *  spawn N requests; they coalesce into one flush ~500ms after the last tap. */
const DEBOUNCE_MS = 500;

/** Max retries per sync ATTEMPT (not per mutation). After this many failures,
 *  status → 'error' and the user must manual-retry. */
const MAX_RETRIES = 3;

/** Exponential backoff series (ms). Length must equal or exceed MAX_RETRIES. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 10000];

// ---------- Module-local state ----------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** True while an attempt is actively running. Prevents concurrent attempts. */
let inFlight = false;

/** Set true whenever scheduleSync() fires during an in-flight attempt. After
 *  the current attempt resolves (success or failure), we immediately re-run
 *  to capture whatever mutations arrived mid-flight. */
let dirtyAfterStart = false;

/** True after initSync() has wired up the reconnect listener. Guards against
 *  double-initialization if the app root re-renders / re-mounts. */
let initialized = false;

// ---------- Public API ----------

/**
 * Debounced sync trigger. Call after any mutation that should eventually
 * land on the server. Safe to call from any thread / any component.
 */
export function scheduleSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runAttempt();
  }, DEBOUNCE_MS);
}

/**
 * No-debounce sync trigger. Call when the user expects the flush to happen
 * NOW (e.g. pressing "Finish workout"). Cancels any pending debounce so we
 * don't run twice back-to-back.
 */
export function scheduleImmediate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void runAttempt();
}

/**
 * Manual retry — called from the UI after a failed sync (status='error').
 * Resets any pending retry timer and kicks off a fresh attempt.
 */
export function retrySync(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void runAttempt();
}

/**
 * Wire up the reconnect-triggers-sync behavior. Call once from the app root
 * (e.g. app/_layout.tsx), ideally after AuthProvider has mounted.
 *
 * Returns an unsubscribe function so tests / HMR can clean up.
 */
export function initSync(): () => void {
  if (initialized) {
    // Return a noop unsubscribe so callers can always call .();
    return () => {};
  }
  initialized = true;

  const unsub = subscribeOnline((online) => {
    if (online) {
      // Reconnect: only kick off a sync if we have something to do. If the
      // active workout is empty, there's nothing to sync.
      const state = useActiveWorkout.getState();
      if (state.startedAt !== null) {
        scheduleImmediate();
      }
    } else {
      // Just went offline. If we were mid-retry, don't waste energy on the
      // backoff timer — it'll fail anyway. Stop the timer; reconnect will
      // restart sync.
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      // Only flip to 'offline' if we're not in the middle of a (doomed)
      // attempt. If one is in flight, let it fail naturally and the catch
      // handler will set the right status.
      if (!inFlight) {
        useSyncStore.getState().setStatus('offline');
      }
    }
  });

  return () => {
    initialized = false;
    unsub();
  };
}

// ---------- Internals ----------

/**
 * Count sets that haven't received a serverId yet. Updated into the store
 * before/after each attempt so UI can show "N pending".
 */
function computePendingOps(): number {
  const { sets } = useActiveWorkout.getState();
  return sets.filter((s) => s.serverId === null).length;
}

/**
 * Single sync attempt with retry-backoff. Returns void; all side effects
 * flow through the sync-status and active-workout stores.
 */
async function runAttempt(): Promise<void> {
  // Coalesce: if an attempt is already running, just mark dirty and let the
  // current attempt's epilogue re-run us.
  if (inFlight) {
    dirtyAfterStart = true;
    return;
  }

  const state = useActiveWorkout.getState();

  // Nothing to sync if no workout has been started.
  if (state.startedAt === null) {
    // Keep status idle; don't touch lastSyncedAt.
    return;
  }

  const syncStore = useSyncStore.getState();

  // Gate 1: offline check. Cheap short-circuit that avoids hitting the
  // network layer only to have it reject us.
  if (!getIsOnline()) {
    syncStore.setStatus('offline');
    syncStore.setPendingOps(computePendingOps());
    return;
  }

  // Gate 2: auth check. If we don't have a user, we can't write anything
  // (RLS would reject the insert). Surface as 'offline' because it's
  // effectively the same UX — user can't do anything about it until they
  // sign in, which is handled by AuthProvider.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    syncStore.setStatus('offline');
    syncStore.setPendingOps(computePendingOps());
    return;
  }
  const userId = userData.user.id;

  // All clear — run the attempt with retry-backoff.
  inFlight = true;
  dirtyAfterStart = false;
  syncStore.setStatus('syncing');
  syncStore.setPendingOps(computePendingOps());

  let attempt = 0;
  let lastErr: string | null = null;

  while (attempt <= MAX_RETRIES) {
    try {
      await performSync(userId);
      // Success.
      useSyncStore.getState().markSynced();
      useSyncStore.getState().setPendingOps(computePendingOps());

      // T-210: invalidate "last set" caches for every exercise that has a
      // completed set in the just-synced workout. Keep the invalidation
      // outside performSync so a mid-attempt throw doesn't fire a false
      // positive. Reads state AFTER the flush so serverIds (and thus the
      // canonical completed set list) reflect the write that succeeded.
      invalidateLastSetCaches();

      lastErr = null;
      break;
    } catch (err) {
      const message = classifyError(err);
      lastErr = message;

      // If we went offline mid-attempt, abort the retry loop and let the
      // reconnect handler restart sync. This avoids burning the retry
      // budget on definitely-doomed attempts.
      if (!getIsOnline()) {
        useSyncStore.getState().setStatus('offline');
        useSyncStore.getState().setPendingOps(computePendingOps());
        lastErr = null; // not an error state; offline
        break;
      }

      // Auth errors never recover from retry — bail immediately.
      if (message === 'auth') {
        break;
      }

      // Out of retries?
      if (attempt >= MAX_RETRIES) break;

      // Sleep the backoff, then try again. Store the timer so a manual
      // retry / reconnect can cancel us.
      const delay = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      await new Promise<void>((resolve) => {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          resolve();
        }, delay);
      });
      attempt += 1;
    }
  }

  if (lastErr !== null) {
    useSyncStore.getState().markError(lastErr);
    useSyncStore.getState().setPendingOps(computePendingOps());
  }

  inFlight = false;

  // Epilogue: if mutations arrived while we were running, re-run now so
  // they land.
  if (dirtyAfterStart) {
    dirtyAfterStart = false;
    // No debounce — we already waited for the attempt to finish, the user
    // has been waiting long enough.
    scheduleImmediate();
  }
}

/**
 * The actual write logic. Splits into three phases:
 *
 *   (a) Ensure `workouts` row exists. If state.workoutId is null, INSERT and
 *       backfill the id into the store.
 *   (b) UPDATE the parent workout row's mutable fields (name, completed_at,
 *       split_type, source, started_at). The user might have changed the
 *       name or pressed finish; the row has to reflect that.
 *   (c) Upsert sets. See "Always upsert all sets" in the module doc for why.
 *       After the upsert, backfill serverIds into the store.
 *
 * Throws on any Supabase error; the caller's retry loop handles backoff.
 */
async function performSync(userId: string): Promise<void> {
  const state = useActiveWorkout.getState();

  // Defensive: startedAt must be set (checked in the caller too).
  if (state.startedAt === null) return;

  // --- Phase (a): ensure workouts row exists ---
  let workoutId = state.workoutId;

  if (workoutId === null) {
    // First-time insert. We don't pre-assign a UUID client-side — letting PG
    // generate it is simpler and we get the canonical id back on SELECT.
    // user_id is REQUIRED by the schema; RLS ALSO requires auth.uid() = user_id.
    const insertRow = {
      user_id: userId,
      name: state.name,
      source: state.source,
      split_type: state.splitType,
      started_at: state.startedAt,
      completed_at: state.completedAt,
    };

    const { data, error } = await supabase
      .from('workouts')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) throw error;
    const insertedId = data?.id as string | undefined;
    if (!insertedId) throw new Error('insert_returned_no_id');

    workoutId = insertedId;
    useActiveWorkout.getState().setWorkoutId(insertedId);
  } else {
    // Existing row: UPDATE mutable fields. started_at is included because
    // it's cheap to re-send and we want the server to reflect whatever the
    // client has (if they ever edit it in the future).
    const updatePayload = {
      name: state.name,
      source: state.source,
      split_type: state.splitType,
      started_at: state.startedAt,
      completed_at: state.completedAt,
    };

    const { error } = await supabase
      .from('workouts')
      .update(updatePayload)
      .eq('id', workoutId);

    if (error) throw error;
  }

  // --- Phase (b)/(c): upsert sets. ---

  // Snapshot the sets AFTER the workout id has been set, so serializeForInsert
  // produces rows with the correct workout_id. Re-read state to capture any
  // edits that may have landed mid-write (though our in-flight guard usually
  // blocks those).
  const freshState = useActiveWorkout.getState();
  if (freshState.sets.length === 0) {
    // No sets to sync (user started a workout but hasn't logged anything).
    // That's fine — the workouts row alone is the source of truth for
    // "session started at X".
    return;
  }

  // Split into inserts (no serverId) vs updates (has serverId). We handle
  // them separately because we need to map insert-returned ids back into
  // the store, which requires `.select()`.
  const toInsert = freshState.sets
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.serverId === null);

  const toUpdate = freshState.sets
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.serverId !== null);

  // Updates first: these are cheap (no id-mapping needed). One query per
  // row — Supabase JS doesn't support bulk-update-by-id in a single call
  // without an RPC. For MVP with <40 sets this is fine; a fancier path
  // (upsert via onConflict) is a Phase 3 optimization.
  //
  // NOTE: we deliberately don't parallelise these with Promise.all — if one
  // fails we want deterministic error handling and a serial loop is easier
  // to reason about. The total cost is ~40 * 30ms = 1.2s worst case on
  // gym 4G, which is acceptable.
  for (const { s, index } of toUpdate) {
    const patch = {
      exercise_id: s.exerciseId,
      set_order: index + 1,
      weight_kg: s.weightKg,
      reps: s.reps,
      seconds: s.seconds,
      rpe: s.rpe,
      notes: s.notes,
      completed: s.completed,
    };
    const { error } = await supabase
      .from('workout_sets')
      .update(patch)
      // s.serverId is non-null here (filter above).
      .eq('id', s.serverId as string);
    if (error) throw error;
  }

  // Inserts: one bulk call with RETURNING so we can map localId → serverId.
  if (toInsert.length > 0) {
    // We keep localId order stable inside toInsert so we can zip the returned
    // rows back to local sets. Supabase preserves insert order on the
    // returned rows (Postgres `INSERT ... RETURNING` preserves input order).
    // Build rows via serializeForInsert's pure logic — we inline it here
    // because we need the original array index to compute set_order.
    const insertRows = toInsert.map(({ s, index }) => ({
      workout_id: workoutId as string,
      exercise_id: s.exerciseId,
      set_order: index + 1,
      weight_kg: s.weightKg,
      reps: s.reps,
      seconds: s.seconds,
      rpe: s.rpe,
      notes: s.notes,
      completed: s.completed,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('workout_sets')
      .insert(insertRows)
      .select('id');

    if (insertErr) throw insertErr;
    if (!inserted || inserted.length !== toInsert.length) {
      // Shouldn't happen, but guard — mismatched lengths would corrupt the
      // localId → serverId mapping.
      throw new Error('set_insert_length_mismatch');
    }

    // Backfill serverIds in the store. If the user removed a set mid-flight
    // (rare), the localId might no longer exist — setServerIdForLocal is a
    // no-op in that case (it filters by localId).
    for (let i = 0; i < inserted.length; i += 1) {
      const localId = toInsert[i].s.localId;
      const serverId = inserted[i].id as string;
      useActiveWorkout.getState().setServerIdForLocal(localId, serverId);
    }
  }

  // Keep serializeForInsert exported + referenced so the import doesn't trip
  // "unused" TS lint. It's used for type-shape guarantees in tests.
  void serializeForInsert;
}

/**
 * T-210 cache invalidation.
 *
 * After a successful sync, invalidate the "last set for exercise X" query
 * for every distinct exerciseId that has at least one completed set in
 * the just-flushed workout. Rationale:
 *
 *   - If the user just completed a new set of bench-press, any future
 *     workout that opens bench-press should see the fresh "last time"
 *     hint, not the 5-min-stale one.
 *   - We deliberately do NOT invalidate for placeholder (completed=false)
 *     sets — those aren't historical data and wouldn't be surfaced by the
 *     hook's `completed=true` predicate anyway.
 *
 * This is fire-and-forget: TanStack Query refetches subscribed queries
 * in the background. If no component is currently using the key, it's a
 * cheap no-op until next read.
 */
function invalidateLastSetCaches(): void {
  const { sets } = useActiveWorkout.getState();
  if (sets.length === 0) return;

  // Dedup exerciseIds that have any completed set. Using a Set keeps the
  // invalidation calls minimal when the user logged multiple sets of the
  // same exercise (the common case).
  const exerciseIds = new Set<string>();
  for (const s of sets) {
    if (s.completed) exerciseIds.add(s.exerciseId);
  }

  for (const exerciseId of exerciseIds) {
    // `void` — we don't await; invalidation kicks off a refetch but we
    // don't care when it settles.
    void queryClient.invalidateQueries({
      queryKey: lastSetQueryKey(exerciseId),
    });
  }
}

/**
 * Turn an unknown thrown value into one of our user-facing error categories.
 * See stores/syncStatus.ts#errorMessage for the allowed set.
 */
function classifyError(err: unknown): string {
  if (err === null || err === undefined) return 'unknown';

  // Supabase JS errors have a `message` field; PostgREST errors also have
  // `code` (e.g. '42501' = permission denied from RLS).
  const anyErr = err as {
    message?: string;
    code?: string;
    status?: number;
  };

  const message = (anyErr.message ?? '').toLowerCase();
  const code = anyErr.code ?? '';
  const status = anyErr.status ?? 0;

  if (code === '42501' || status === 401 || status === 403) return 'auth';
  if (status >= 500) return 'server';
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('failed to fetch')
  ) {
    return 'network';
  }

  return 'unknown';
}
