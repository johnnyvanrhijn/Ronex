/**
 * stores/activeWorkout.ts
 *
 * Purpose
 * -------
 * Client-side state for a SINGLE in-progress workout session. The user starts
 * a workout, logs sets, and finishes — this store owns that entire lifecycle
 * up to (but NOT including) the moment the data is persisted to Supabase.
 *
 * Why this exists
 * ---------------
 * Workout logging must work OFFLINE (see agent brief + docs/SPEC.md §4.5):
 * a user on a dead-zone gym floor taps "Log set" 30 times and every tap must
 * succeed immediately. That precludes round-tripping to Supabase on each set.
 * Instead:
 *   1. Every set-level mutation hits this zustand store.
 *   2. Zustand's `persist` middleware mirrors state to AsyncStorage on every
 *      change, so an OS-level app kill mid-workout doesn't lose progress —
 *      re-opening the app restores the exact same active session.
 *   3. A separate sync helper (T-207/T-208, NOT in this file) will batch the
 *      store's state up to Supabase opportunistically (on workout finish,
 *      on app foreground, etc.).
 *
 * Scope boundary (T-203)
 * ----------------------
 * - IN SCOPE:  state shape, selective setters, AsyncStorage persistence,
 *              a serializeForInsert() mapper that prepares rows for Supabase.
 * - OUT OF SCOPE: any `supabase.from(...)` call. The store must not depend on
 *              `lib/supabase.ts` so that it remains trivially testable and
 *              never blocks the UI thread on a network round-trip.
 *
 * How future sync (T-207/T-208) will work
 * ---------------------------------------
 * 1. On first save-point (e.g. first completed set or "finish workout"):
 *      - If `workoutId` is null, INSERT a row into `workouts` using
 *        `serializeForInsert(state).workout`, capture the returned id, and
 *        call `setWorkoutId(returned.id)`.
 *      - INSERT all sets whose `serverId` is null via
 *        `serializeForInsert(state).sets` (after patching each set's
 *        `workout_id`). On success, map localId → serverId and patch the
 *        store via `setServerIdForLocal(localId, serverId)`.
 * 2. On subsequent saves (user logs more sets / edits prior sets):
 *      - UPDATE the `workouts` row (completed_at, name).
 *      - UPSERT sets: rows with `serverId` → UPDATE by id; rows without
 *        `serverId` → INSERT, then backfill serverId as above.
 * 3. On `reset()` after a successful flush: state is wiped. If the user taps
 *    "cancel" on an in-progress workout and some sets were already server-
 *    side, the sync helper must decide whether to DELETE the workouts row
 *    (cascades to sets) — that policy decision belongs to T-207, NOT here.
 *
 * Edge cases flagged for T-207/T-208
 * ----------------------------------
 *   (a) Partial server state: `workoutId` is set (parent inserted) but a
 *       subset of sets have null `serverId`. This is the normal state during
 *       incremental sync — the helper iterates sets, INSERTs the null ones,
 *       UPDATEs the rest.
 *   (b) Orphan local state: app killed mid-sync → on restart the store has
 *       completed sets with null serverId but a non-null workoutId. The sync
 *       helper should treat these as "needs insert" (idempotent — Postgres
 *       will happily accept a fresh row).
 *   (c) Server rejects a set (e.g. trigger-enforced logging_type mismatch).
 *       The UI layer should surface the error against the offending localId;
 *       the store has no opinion on retry vs drop.
 *   (d) User logs, syncs, then edits the weight on a synced set. The helper
 *       detects this via a dirty-flag or by diffing; adding a dirty bit
 *       here is premature — T-207 can decide whether it wants one.
 *
 * Persistence details
 * -------------------
 * - Storage key: `@ronex/activeWorkout` (prefixed, easy to grep/wipe in dev).
 * - No schema-version field yet. If the shape changes pre-launch, bump the
 *   storage key (e.g. `-v2`) and let stale drafts fall on the floor — the
 *   worst case is the user loses an in-progress workout, which is acceptable
 *   given the rarity of the event and the simplicity of the workaround.
 *
 * App-kill-during-workout behaviour
 * ---------------------------------
 * 1. User starts workout → `startWorkout()` writes timestamp → AsyncStorage
 *    write happens inline (zustand persist is synchronous wrt the component
 *    tree but writes to disk async; the in-memory copy is immediate).
 * 2. User logs 5 sets → 5 `updateSet()` calls → 5 AsyncStorage writes.
 * 3. OS kills app (low-memory, manual swipe, crash) with workout in progress.
 * 4. User re-opens app. zustand `persist` rehydrates from AsyncStorage during
 *    bootstrap. The store's fields are populated with the last persisted
 *    state — `workoutId`, `startedAt`, every logged set, `completedAt` is
 *    still null.
 * 5. UI layer (T-204 onward) inspects `startedAt !== null && completedAt ===
 *    null` and resumes the session at the workout screen.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActiveSet,
  SplitTypeT,
  WorkoutSourceT,
  WorkoutInsert,
  WorkoutSetInsert,
} from '@/types/workout';

/**
 * T-212 integration — every store mutation schedules a background sync so the
 * server state eventually mirrors the client. `scheduleSync()` is debounced
 * (see lib/sync/syncActiveWorkout.ts) so rapid-fire setters collapse into one
 * request. `scheduleImmediate()` is used by completeWorkout() — the user
 * expects an instant flush when they tap "Finish".
 *
 * Lazy `require` rather than a top-level `import`: syncActiveWorkout.ts also
 * imports from this file (for `useActiveWorkout.getState()` + `serializeFor-
 * Insert`), which creates a real require-cycle at module load. A lazy require
 * inside the helper defers resolution to first setter invocation — by then
 * both modules have finished loading and the named exports are defined.
 */
function syncScheduleSync(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sync = require('@/lib/sync/syncActiveWorkout') as typeof import('@/lib/sync/syncActiveWorkout');
  sync.scheduleSync();
}

function syncScheduleImmediate(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sync = require('@/lib/sync/syncActiveWorkout') as typeof import('@/lib/sync/syncActiveWorkout');
  sync.scheduleImmediate();
}

/**
 * Generate a collision-unlikely localId for a set.
 *
 * Why not `crypto.randomUUID()`?
 *   Hermes (the default JS runtime for Expo's RN) does not ship
 *   `crypto.randomUUID` on all versions we support. `react-native-url-polyfill`
 *   (already imported by lib/supabase.ts) polyfills `crypto.getRandomValues`
 *   but NOT `randomUUID`. Adding `expo-crypto` just for localIds is overkill.
 *
 * Is this secure? No — and it doesn't need to be. localIds never leave the
 * device. They're used for React keys and in-array lookups within a single
 * workout's set list (rarely more than ~40 items). Math.random-sourced uuids
 * are more than collision-resistant enough at that scale.
 *
 * Server-assigned set ids (`serverId` / `workout_sets.id`) come from Postgres
 * `gen_random_uuid()` and ARE cryptographically sound.
 */
function generateLocalId(): string {
  // RFC-4122 v4-shaped string. Not cryptographically random; see doc above.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type ActiveWorkoutState = {
  workoutId: string | null;
  name: string | null;
  source: WorkoutSourceT;
  splitType: SplitTypeT | null;
  startedAt: string | null;
  completedAt: string | null;
  sets: ActiveSet[];

  // ---------- Lifecycle ----------
  startWorkout: (
    source: WorkoutSourceT,
    name?: string | null,
    splitType?: SplitTypeT | null,
  ) => void;
  completeWorkout: () => void;
  reset: () => void;

  // ---------- Set manipulation ----------
  addSet: (exerciseId: string) => void;
  /**
   * Like `addSet`, but pre-populates weight/reps/seconds from caller-provided
   * values. See UX-herziening 2026-04-19: the first set in a bucket hydrates
   * from history (via `useLastSetForExercise`), each subsequent set hydrates
   * from the just-completed prior set in the same bucket ("carry-forward").
   *
   * `completed` stays false — prefilled values are suggestions, not
   * confirmations. The server trigger only validates field-sets on rows
   * where `completed = true`, so placeholder rows sync safely.
   *
   * Offline-first invariant: no Supabase call in this path. Identical to
   * `addSet` except for the seeded values; only `syncScheduleSync()` at the
   * end, which is debounced and non-blocking.
   */
  addSetWithPrefill: (
    exerciseId: string,
    prefill: {
      weightKg: number | null;
      reps: number | null;
      seconds: number | null;
    },
  ) => void;
  updateSet: (
    localId: string,
    patch: Partial<Omit<ActiveSet, 'localId'>>,
  ) => void;
  removeSet: (localId: string) => void;
  removeExercise: (exerciseId: string) => void;
  reorderSets: (from: number, to: number) => void;

  // ---------- Sync-support hooks (called by T-207/T-208) ----------
  setWorkoutId: (id: string) => void;
  setServerIdForLocal: (localId: string, serverId: string) => void;
};

/**
 * Empty/default state. `source` defaults to 'manual' because that's the
 * no-context case — `startWorkout()` overrides this when the caller knows
 * better (AI-generated, plan-driven, challenge).
 */
const EMPTY_STATE: Pick<
  ActiveWorkoutState,
  'workoutId' | 'name' | 'source' | 'splitType' | 'startedAt' | 'completedAt' | 'sets'
> = {
  workoutId: null,
  name: null,
  source: 'manual',
  splitType: null,
  startedAt: null,
  completedAt: null,
  sets: [],
};

export const useActiveWorkout = create<ActiveWorkoutState>()(
  persist(
    (set) => ({
      ...EMPTY_STATE,

      startWorkout: (source, name = null, splitType = null) => {
        set({
          // Fresh session — discard any lingering fields. We deliberately do
          // NOT consult the existing in-memory state: if it's non-empty,
          // that's a bug the caller should have caught (UI prompts "resume
          // or discard?" BEFORE calling startWorkout).
          workoutId: null,
          name,
          source,
          splitType,
          startedAt: new Date().toISOString(),
          completedAt: null,
          sets: [],
        });
        // T-212: first touchpoint of a new session — kick off a sync so the
        // server gets an empty workouts row ASAP. Subsequent addSet/updateSet
        // calls will PATCH it.
        syncScheduleSync();
      },

      completeWorkout: () => {
        // Client clock. The DB allows completed_at to be any timestamptz,
        // and workouts.started_at defaults to now() so the DB will happily
        // accept a client-generated completion time. The small clock-skew
        // risk is tolerated (workouts are never ordered by completed_at
        // between users).
        set({ completedAt: new Date().toISOString() });
        // T-212: user pressed Finish. Skip the debounce — they want this
        // flush to happen NOW.
        syncScheduleImmediate();
      },

      // Reset does NOT trigger sync. It's called after a successful flush or
      // when the user discards the workout. In the latter case, the server
      // may have a partial row left over — we accept that as an "orphan"
      // until Phase 3 ships a periodic cleanup. See T-212 edge-cases.
      reset: () => set({ ...EMPTY_STATE }),

      addSet: (exerciseId) => {
        set((state) => ({
          // UX-herziening 2026-04-19: auto-start the session on first set-add.
          // The workout-screen no longer bootstraps a session on mount — the
          // timer only starts ticking when the user actually adds an exercise.
          // Rationale: mounting the screen with no content shouldn't count as
          // "training"; the stopwatch would tick on an empty shell, which is
          // confusing.
          ...(state.startedAt === null
            ? { startedAt: new Date().toISOString() }
            : {}),
          sets: [
            ...state.sets,
            {
              localId: generateLocalId(),
              serverId: null,
              exerciseId,
              weightKg: null,
              reps: null,
              seconds: null,
              rpe: null,
              notes: null,
              // Placeholder: server trigger only enforces field-set rules
              // when `completed` flips to true, so unfilled placeholder rows
              // sync safely. See workouts_schema.sql §5.
              completed: false,
            },
          ],
        }));
        syncScheduleSync();
      },

      addSetWithPrefill: (exerciseId, prefill) => {
        set((state) => ({
          // UX-herziening 2026-04-19: mirror addSet — auto-start on first touch.
          ...(state.startedAt === null
            ? { startedAt: new Date().toISOString() }
            : {}),
          sets: [
            ...state.sets,
            {
              localId: generateLocalId(),
              serverId: null,
              exerciseId,
              // Caller decides what to seed. Any of these may legitimately be
              // null (e.g. reps_only exercises pass weightKg: null; first-ever
              // set of an exercise passes all three null because history is
              // empty — in that case behaviour is identical to addSet).
              weightKg: prefill.weightKg,
              reps: prefill.reps,
              seconds: prefill.seconds,
              rpe: null,
              notes: null,
              completed: false,
            },
          ],
        }));
        syncScheduleSync();
      },

      updateSet: (localId, patch) => {
        set((state) => ({
          sets: state.sets.map((s) =>
            s.localId === localId ? { ...s, ...patch } : s,
          ),
        }));
        syncScheduleSync();
      },

      // Removal DOES NOT re-sequence remaining sets' indices. The array's
      // array-index is the canonical `set_order` source (see
      // serializeForInsert), and the re-index happens implicitly at
      // serialization time. Trade-off documented: if the server already has
      // a deleted set with a specific set_order, the sync helper must issue
      // a DELETE by serverId — the local array collapse does not leave a
      // gap the UI can see. The only observable effect of "no re-indexing
      // here" is that in-memory array indices shift, which is what the UI
      // wants anyway (no empty rows between existing rows).
      removeSet: (localId) => {
        set((state) => ({
          sets: state.sets.filter((s) => s.localId !== localId),
        }));
        // Note: T-212's sync engine does NOT currently issue server-side
        // DELETE for removed sets. If the set was already synced (had a
        // serverId), the server row becomes orphaned until the parent
        // workouts row is eventually deleted. This is a flagged Phase 3
        // limitation (see T-212 report) — adding DELETE is straightforward
        // but requires tracking removed-serverIds in the store so the sync
        // engine can issue targeted deletes. Out of scope for MVP.
        syncScheduleSync();
      },

      // B-029: bucket-level delete. Wipes every set whose exerciseId matches,
      // preserving store-order of the remaining buckets. Mirrors removeSet's
      // server-orphan policy — synced rows on the server become orphans until
      // the Phase 3 cleanup pass issues targeted DELETEs. The parent workouts
      // row's upsert still reflects the correct post-delete state via the
      // remaining sets; orphans are invisible to any UI (queries are keyed by
      // workout_id and the totals view re-aggregates on every read).
      removeExercise: (exerciseId) => {
        set((state) => ({
          sets: state.sets.filter((s) => s.exerciseId !== exerciseId),
        }));
        syncScheduleSync();
      },

      reorderSets: (from, to) => {
        set((state) => {
          if (
            from === to ||
            from < 0 ||
            to < 0 ||
            from >= state.sets.length ||
            to >= state.sets.length
          ) {
            return state;
          }
          const next = state.sets.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          // No explicit set_order field on ActiveSet — reordering is
          // reflected by the array's new element order. serializeForInsert
          // derives set_order = index + 1 at sync time.
          return { sets: next };
        });
        syncScheduleSync();
      },

      // T-212: setWorkoutId and setServerIdForLocal are called BY the sync
      // engine itself to backfill server-generated ids. They MUST NOT trigger
      // another sync — doing so would cause an infinite scheduleSync loop.
      // They're also stable, monotonic writes (null → id once) so no sync is
      // ever warranted from them anyway.
      setWorkoutId: (id) => set({ workoutId: id }),

      setServerIdForLocal: (localId, serverId) =>
        set((state) => ({
          sets: state.sets.map((s) =>
            s.localId === localId ? { ...s, serverId } : s,
          ),
        })),
    }),
    {
      name: '@ronex/activeWorkout',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data, not function references (zustand does this by
      // default but being explicit about the shape helps if the API expands).
      partialize: (state) => ({
        workoutId: state.workoutId,
        name: state.name,
        source: state.source,
        splitType: state.splitType,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        sets: state.sets,
      }),
    },
  ),
);

/**
 * getLastSetInStoreForExercise — synchronous, imperative lookup of the most-
 * recent set in the active-workout store for a given exerciseId.
 *
 * Why not a React hook
 * --------------------
 * This is called from UI event handlers (e.g. just after `updateSet(localId,
 * { completed: true })` to read the confirmed values for carry-forward).
 * Handlers need the store's *current* snapshot, not a subscribed value that
 * re-renders the component on every set change. Using `useActiveWorkout.
 * getState()` bypasses React's subscription machinery entirely — it returns
 * whatever is in memory right now.
 *
 * Note the scope: this only looks at the in-progress workout (what's in the
 * zustand store). For historical data from prior workouts, use
 * `useLastSetForExercise(exerciseId)` (lib/queries/useLastSetForExercise.ts)
 * — that one queries Supabase and is the "cold-start hint" for the first
 * set in a bucket. This helper is for the in-session "carry-forward" after
 * the first set has been logged.
 *
 * Iteration order
 * ---------------
 * We walk the array back-to-front because bucket-internal order equals
 * array-insertion order (see store.reorderSets + serializeForInsert). The
 * last element that matches `exerciseId` is therefore the most recently
 * added/updated set for that bucket.
 *
 * @param exerciseId  Exercise to filter on.
 * @returns           The most recent matching `ActiveSet`, or null.
 */
export function getLastSetInStoreForExercise(
  exerciseId: string,
): ActiveSet | null {
  const { sets } = useActiveWorkout.getState();
  for (let i = sets.length - 1; i >= 0; i--) {
    if (sets[i].exerciseId === exerciseId) return sets[i];
  }
  return null;
}

/**
 * serializeForInsert — pure helper that maps the current in-memory state to
 * the exact row shapes that Supabase's `workouts` and `workout_sets` tables
 * expect.
 *
 * NOT CALLED IN T-203. Provided now so T-207/T-208 have a single, reviewed
 * mapping to import. Pure (no side effects, no store access): pass a snapshot
 * of the state explicitly so callers can choose whether to read via the
 * hook (inside React) or via `useActiveWorkout.getState()` (outside React).
 *
 * Caveats
 * -------
 * - `sets[].workout_id` is filled with the argument `workoutId` (the caller
 *   must provide it; this is either the existing `state.workoutId` or the id
 *   returned by the workouts INSERT on first sync).
 * - `set_order` is derived from array index + 1. If the UI ever surfaces a
 *   "gap" (e.g. deleted a middle set), the gap is collapsed here — that's
 *   the intended contract (the DB doesn't care about gaps; sequence is
 *   merely a display order).
 * - Sets with non-null `serverId` are included too; the sync helper decides
 *   whether to send them as UPDATEs (by serverId) or skip them.
 */
export function serializeForInsert(
  state: Pick<
    ActiveWorkoutState,
    'name' | 'source' | 'splitType' | 'startedAt' | 'completedAt' | 'sets'
  >,
  workoutId: string,
): { workout: WorkoutInsert; sets: WorkoutSetInsert[] } {
  const workout: WorkoutInsert = {
    name: state.name,
    source: state.source,
    split_type: state.splitType,
    // Sync helper guarantees startedAt is non-null before calling serialize:
    // startWorkout() always populates it. We fall back defensively to `now`
    // so the function is total (never throws) even if a caller misuses it.
    started_at: state.startedAt ?? new Date().toISOString(),
    completed_at: state.completedAt,
  };

  const sets: WorkoutSetInsert[] = state.sets.map((s, index) => ({
    workout_id: workoutId,
    exercise_id: s.exerciseId,
    set_order: index + 1,
    weight_kg: s.weightKg,
    reps: s.reps,
    seconds: s.seconds,
    rpe: s.rpe,
    notes: s.notes,
    completed: s.completed,
  }));

  return { workout, sets };
}
