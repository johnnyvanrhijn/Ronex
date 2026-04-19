/**
 * lib/queries/useLastSetForExercise.ts
 *
 * Task T-210 — "last time X kg for Y reps" historical hint.
 *
 * What it does
 * ------------
 * Given an `exerciseId`, returns the user's single most-recent completed
 * `workout_sets` row for that exercise. The KeyboardAccessory (T-204 Fase 1)
 * uses this to paint the "Laatste: 82.5 kg × 8" hint above the numpad.
 *
 * Query shape
 * -----------
 * Single-row fetch, ordered by `created_at DESC`, filtered on:
 *   - exercise_id = <this exercise>
 *   - completed = true
 *   - (implicitly) workouts.user_id = auth.uid() — RLS enforces this on
 *     the workouts JOIN, see key-decision note 5 in the T-201 migration.
 *
 * We JOIN on `workouts!inner(user_id)` and add an explicit `.eq(...)` on
 * `user_id` as belt-and-braces. RLS already forbids cross-user rows, but
 * naming user_id explicitly lets the PostgREST planner short-circuit the
 * join earlier and makes intent obvious to any reviewer reading the code.
 *
 * The read path is backed by the partial index
 *   workout_sets_exercise_completed_idx
 *     on public.workout_sets (exercise_id, created_at desc)
 *     where completed = true
 * introduced in 20260419105008_workouts_schema.sql. Lookup is O(log n)
 * against an already-filtered (completed=true) btree.
 *
 * Why we return all three value columns (weight_kg, reps, seconds)
 * ----------------------------------------------------------------
 * The exercise library has three logging types (weight_reps, reps_only,
 * time_seconds). FASE 2 of T-209 will add variants of the set-row that
 * display whichever column(s) apply. Returning all three keeps this hook
 * logging-type-agnostic so downstream row components can format without
 * a second query to `exercises.logging_type`.
 *
 * Caching
 * -------
 * `staleTime: 5 * 60 * 1000` — the value only changes when the user
 * completes a new set of this exercise, which we explicitly invalidate
 * from the sync success path (see `lib/sync/syncActiveWorkout.ts`).
 * 5 minutes covers the common "user re-focuses the app" scenario without
 * letting truly stale data linger through multi-day gym trips.
 *
 * `gcTime` uses the TanStack default (5 min) — there's no value in
 * retaining history for an exercise the user has navigated away from.
 *
 * Invariants
 * ----------
 * - `enabled` is false when exerciseId is null (no exercise selected yet).
 * - Returns `null` (not an error) when the user has no history for this
 *   exercise. The UI treats null as "show placeholder em-dash".
 * - Never throws on empty-result; `.maybeSingle()` returns `data: null`.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type LastSetForExercise = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  completedAt: string; // ISO timestamp of workout_sets.created_at
};

export type LastSetQueryKey = readonly ['lastSetForExercise', string];

/** Build the query key for a given exerciseId. Exported so other modules
 *  (e.g. the sync engine, for invalidation) can reference the canonical
 *  shape without re-typing the tuple. */
export function lastSetQueryKey(exerciseId: string): LastSetQueryKey {
  return ['lastSetForExercise', exerciseId] as const;
}

/**
 * Fetch the most recent completed workout_sets row for `exerciseId` +
 * the currently-authed user.
 *
 * Returns `null` when the user has never completed a set of this
 * exercise (or when the user is not signed in — handled defensively).
 *
 * Exported so non-React callers (e.g. the UX-herziening 2026-04-19
 * add-set flow in `app/workout/active.tsx`) can prime the TanStack
 * cache via `queryClient.ensureQueryData({ queryKey: lastSetQueryKey(id),
 * queryFn: () => fetchLastSetForExercise(id) })`. The hook version below
 * reuses the same function internally.
 */
export async function fetchLastSetForExercise(
  exerciseId: string,
): Promise<LastSetForExercise | null> {
  // Get auth user up-front: RLS would filter cross-user rows anyway, but
  // the explicit user_id predicate below is cheaper for the planner and
  // makes the query intention obvious.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    // No session → no history. Returning null (rather than throwing) is
    // friendlier to the UI; the KeyboardAccessory simply shows the em-
    // dash placeholder.
    return null;
  }
  const userId = userData.user.id;

  // PostgREST JOIN syntax: `workouts!inner(user_id)` embeds the parent
  // row and marks the join as INNER (row is dropped if no parent matches).
  // Filtering on the embedded column uses the dotted foreign-table path.
  const { data, error } = await supabase
    .from('workout_sets')
    .select(
      'weight_kg, reps, seconds, created_at, workouts!inner(user_id)',
    )
    .eq('exercise_id', exerciseId)
    .eq('completed', true)
    .eq('workouts.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Genuine network / RLS / query errors surface to the caller so
    // TanStack Query can retry per the global policy (retry: 1).
    throw new Error(`Failed to load last set: ${error.message}`);
  }

  if (!data) return null;

  // Normalize numeric(6,2) → number. Supabase returns NUMERIC as string
  // when the value is big enough to lose precision in JS; for our range
  // (0-9999) a Number coerce is safe.
  const weightRaw = (data as { weight_kg: number | string | null }).weight_kg;
  const weightKg =
    weightRaw === null || weightRaw === undefined
      ? null
      : typeof weightRaw === 'string'
        ? Number.parseFloat(weightRaw)
        : weightRaw;

  const reps = (data as { reps: number | null }).reps ?? null;
  const seconds = (data as { seconds: number | null }).seconds ?? null;
  const completedAt = (data as { created_at: string }).created_at;

  return {
    weightKg: weightKg !== null && Number.isFinite(weightKg) ? weightKg : null,
    reps,
    seconds,
    completedAt,
  };
}

/**
 * TanStack Query hook: returns the user's last completed set for
 * `exerciseId`, or `null` when no history exists.
 *
 * Pass `null` to disable the query (e.g. before an exercise is chosen).
 *
 * Invalidation: `lib/sync/syncActiveWorkout.ts` calls
 * `queryClient.invalidateQueries({ queryKey: lastSetQueryKey(exerciseId) })`
 * for every exercise in a completed workout after a successful flush.
 */
export function useLastSetForExercise(exerciseId: string | null) {
  return useQuery<LastSetForExercise | null>({
    queryKey: exerciseId ? lastSetQueryKey(exerciseId) : ['lastSetForExercise', 'disabled'],
    queryFn: () => fetchLastSetForExercise(exerciseId as string),
    enabled: exerciseId !== null,
    staleTime: 5 * 60 * 1000, // 5 min; invalidated explicitly on new set
  });
}
