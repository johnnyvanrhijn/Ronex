/**
 * types/workout.ts
 *
 * Central type definitions for the workout-logging domain. Kept in `types/`
 * (rather than co-located in `stores/activeWorkout.ts`) because these types
 * will also be referenced by:
 *   - T-204/T-205: workout-logging UI screens (render set rows)
 *   - T-207/T-208: server-sync helpers (map store → Supabase insert payloads)
 *   - T-214:      PR detector (reads completed sets from server state)
 *
 * Enums mirrored from the database
 * --------------------------------
 * Both `WorkoutSourceT` and `SplitTypeT` are TypeScript mirrors of Postgres
 * enums defined in `supabase/migrations/`. They are intentionally hand-
 * written rather than generated because:
 *   (a) we don't run supabase-js codegen yet, and
 *   (b) these lists are short and stable — adding a value is a deliberate,
 *       multi-file change that should be reviewed (client/server drift is
 *       the hazard codegen would protect against, but so is a code review).
 *
 * If these ever drift from the DB, the symptom is a Postgres `invalid input
 * value for enum` error on insert. Keep the source-of-truth comment below
 * pointing at the migration that owns each enum.
 */

// Source: supabase/migrations/20260419105008_workouts_schema.sql
//         enum public.workout_source_t
export type WorkoutSourceT =
  | 'manual'
  | 'ai_generated'
  | 'plan'
  | 'challenge';

// Source: supabase/migrations/20260419000000_preferred_split_enum.sql
//         enum public.split_type_t
export type SplitTypeT =
  | 'ppl'
  | 'upper_lower'
  | 'full_body'
  | 'custom';

/**
 * A single set belonging to an in-progress (client-owned) workout.
 *
 * Field mapping to Supabase `workout_sets`
 * ----------------------------------------
 *   localId       → n/a (client-only, stable React key + in-array lookup)
 *   serverId      → `workout_sets.id`  (populated after server insert)
 *   exerciseId    → `workout_sets.exercise_id`
 *   weightKg      → `workout_sets.weight_kg`
 *   reps          → `workout_sets.reps`
 *   seconds       → `workout_sets.seconds`
 *   rpe           → `workout_sets.rpe`
 *   notes         → `workout_sets.notes`
 *   completed     → `workout_sets.completed`
 *   (position in array → `workout_sets.set_order`, see serializeForInsert)
 *
 * Validation
 * ----------
 * The store does NOT validate field-set-vs-logging-type invariants. That is
 * enforced server-side by the `workout_sets_enforce_logging_type` trigger
 * (see migration 20260419105008). Client-side UI-level validation lives in
 * T-204/T-205 (the set-row components that own the inputs).
 */
export type ActiveSet = {
  localId: string;
  serverId: string | null;
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  rpe: number | null;
  notes: string | null;
  completed: boolean;
};

/**
 * Shape of the row we POST to `workouts` on first flush. Field names are
 * snake_case to match Supabase's column names 1:1 — future sync helpers can
 * spread this directly into `supabase.from('workouts').insert(...)`.
 *
 * `user_id` is NOT included here: it comes from the authenticated session
 * inside the sync helper (single source of truth = `auth.uid()`), keeping
 * the client state ignorant of the logged-in user id.
 */
export type WorkoutInsert = {
  id?: string; // client may pre-assign via randomUUID; omit to let PG default
  name: string | null;
  source: WorkoutSourceT;
  split_type: SplitTypeT | null;
  started_at: string;       // ISO8601
  completed_at: string | null;
};

/**
 * Shape of a row we POST to `workout_sets`. `workout_id` is filled in by
 * the sync helper once the parent `workouts` row has an id. `set_order`
 * is derived from the set's index in the store's array (index + 1).
 */
export type WorkoutSetInsert = {
  id?: string;                   // optional pre-assigned uuid
  workout_id: string;            // FK — provided by the sync helper
  exercise_id: string;
  set_order: number;             // 1-based
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  rpe: number | null;
  notes: string | null;
  completed: boolean;
};
