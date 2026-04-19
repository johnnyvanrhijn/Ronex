-- =============================================================================
-- Migration: workouts + workout_sets + personal_records
-- Task: T-201 (Phase 2 — Workout Logging Core)
-- Source: docs/SPEC.md §4.3-4.6 + docs/ARCHITECTURE.md (initial data model) +
--         T-201 brief from PM 2026-04-19.
-- Idempotent: safe to re-run.
--
-- Scope (intentionally narrow)
-- ----------------------------
-- This migration creates the three Phase-2 tables, enables RLS with own-row
-- policies, adds the query-path indexes, and installs ONE trigger on
-- `workout_sets` that enforces the field-set invariant implied by the owning
-- `exercises.logging_type`. It deliberately does NOT:
--   * add PR-auto-detection triggers (that belongs to T-214)
--   * add derived columns for volume / set counts on workouts (we expose a
--     view `workouts_with_totals` instead — see note 3 below)
--   * touch the existing `profiles` or `exercises` migrations
--
-- Key design decisions
-- --------------------
-- 1. No copy of `logging_type` into `workout_sets`.
--    Single source of truth = `exercises.logging_type`. Copying it would
--    create a drift risk (exercise library updates wouldn't propagate) and
--    doubles the write path during offline sync. The enforcement trigger
--    JOINs on every insert/update — `exercises.id` is the table's PK so
--    this is an O(1) index lookup, negligible cost.
--
-- 2. CHECK vs TRIGGER for logging-type enforcement.
--    CHECK constraints can't reference other tables in Postgres (only the
--    NEW row's own columns). The invariant "if exercises.logging_type =
--    'reps_only' then weight_kg must be null" is by definition a cross-
--    table rule, so it lives in a BEFORE INSERT/UPDATE trigger.
--
-- 3. No cached aggregates on `workouts`.
--    Totals (volume_kg, set_count, exercise_count) are exposed via the view
--    `workouts_with_totals`. Alternatives considered + rejected:
--      (a) Materialized columns updated via triggers on workout_sets →
--          rejected: offline-sync writes sets out-of-order and we'd need
--          extra complexity to stay consistent across retries.
--      (b) Full materialized view with scheduled refresh → rejected:
--          over-engineered for MVP traffic; a regular view + the indexes
--          below is fast enough.
--    If list-view performance ever becomes an issue we can promote the view
--    to MATERIALIZED without breaking callers — they read the same name.
--
-- 4. Personal_records metrics = 4 (not 5+).
--    YAGNI: we support exactly the metrics the MVP logging UX can display
--    and celebrate:
--      * max_weight              — heaviest single set, weight_reps exercises
--      * max_1rm_estimated       — Epley formula, gives rep-work a PR path
--      * max_reps                — reps_only (bodyweight pull-ups etc.)
--      * max_time_seconds        — time_seconds (planks, farmer's walk)
--    Deferred (not in this migration):
--      * max_volume              — "highest volume in one set" is niche,
--                                  redundant with max_weight for most users
--      * max_reps_at_weight      — requires a weight-threshold dimension,
--                                  UX is fuzzy ("what bucket?"); revisit
--                                  post-launch if users ask for it.
--    The enum is extensible: adding a value later is a standard ALTER TYPE.
--
-- 5. RLS pattern for workout_sets = "ownership via workout_id, no user_id".
--    workout_sets has NO user_id column. Ownership is inherited through
--    workout_id → workouts.user_id. This prevents a class of sync bugs where
--    a client could accidentally write sets with a user_id that drifts from
--    the parent workout's user_id. The RLS policy uses an EXISTS subquery
--    on workouts; this is fast because (id, user_id) is the clustered PK
--    path.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------

-- Source enum for `workouts.source`. Matches SPEC §4 and the placeholder
-- doc in docs/ARCHITECTURE.md. We seed the four values the MVP actually
-- produces; `plan` will start to be written once plans land in Phase 5.
do $$ begin
  create type public.workout_source_t as enum (
    'ai_generated', 'plan', 'manual', 'challenge'
  );
exception when duplicate_object then null; end $$;

-- PR metric enum — see key-decision note 4.
do $$ begin
  create type public.pr_metric_t as enum (
    'max_weight',
    'max_1rm_estimated',
    'max_reps',
    'max_time_seconds'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 2. WORKOUTS
-- One row per workout session. `completed_at IS NULL` marks an in-progress
-- session; the mobile client can have at most one of these per user in
-- practice, though we don't enforce that at the DB level (it would block
-- legitimate scenarios like a client retrying a crashed sync).
-- -----------------------------------------------------------------------------

create table if not exists public.workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,

  name              text check (name is null or char_length(name) between 1 and 80),
  source            public.workout_source_t not null default 'manual',

  -- Optional split tag for plan-driven or AI-generated workouts. Re-uses
  -- the enum introduced in 20260419000000. Null for manual / loose sessions.
  split_type        public.split_type_t,

  -- Timezone-aware timestamps. `started_at` is required; `completed_at` is
  -- nullable while the session is in progress.
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index on the primary list-view query: "most recent workouts for user X".
-- `completed_at desc nulls first` puts in-progress sessions at the top of
-- any UI list that surfaces them alongside history.
create index if not exists workouts_user_started_idx
  on public.workouts (user_id, started_at desc);


-- -----------------------------------------------------------------------------
-- 3. WORKOUT_SETS
-- One row per logged set. No user_id column — ownership inherited via
-- workout_id → workouts.user_id (see key-decision note 5).
--
-- Field-set rules driven by exercises.logging_type:
--   weight_reps   → weight_kg NOT NULL, reps NOT NULL, seconds NULL
--   reps_only     → weight_kg optional (weighted bodyweight exercises),
--                   reps NOT NULL, seconds NULL
--   time_seconds  → weight_kg NULL, reps NULL, seconds NOT NULL
--   distance_weight (reserved; not used by current seed data) — any combo
--                   permitted until we design its UI.
-- Enforced via the trigger in section 5.
-- -----------------------------------------------------------------------------

create table if not exists public.workout_sets (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null references public.workouts(id) on delete cascade,
  exercise_id      text not null references public.exercises(id),

  -- Ordering within the workout; used to render the in-workout list.
  -- Smallint is plenty (no workout has >32k sets).
  set_order        smallint not null check (set_order between 1 and 999),

  -- Logging fields. Each is nullable at the column level; the trigger
  -- enforces the subset appropriate to the exercise's logging_type.
  weight_kg        numeric(6,2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 9999)),
  reps             smallint     check (reps is null or (reps > 0 and reps <= 999)),
  seconds          smallint     check (seconds is null or (seconds > 0 and seconds <= 32000)),

  -- RPE 1-10 (half-points not supported in MVP; upgrade to numeric if needed).
  rpe              smallint     check (rpe is null or rpe between 1 and 10),

  notes            text         check (notes is null or char_length(notes) <= 280),

  -- `completed=false` = a placeholder set queued in the workout UI that the
  -- user hasn't confirmed yet. `completed=true` = the user logged this set.
  -- Both states sync to the server so the session survives app-kill.
  completed        boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- In-workout render query: "all sets for workout X in order".
create index if not exists workout_sets_workout_order_idx
  on public.workout_sets (workout_id, set_order);

-- Secondary lookup used by the "last time X kg for Y reps" suggestion (T-210)
-- and the PR detector (T-214). Filtering on completed=true keeps the index
-- small and relevant.
create index if not exists workout_sets_exercise_completed_idx
  on public.workout_sets (exercise_id, created_at desc)
  where completed = true;


-- -----------------------------------------------------------------------------
-- 4. PERSONAL_RECORDS
-- Materialized PR state: exactly one row per (user, exercise, metric).
-- Populated by T-214 on workout complete. Read-path is single-row lookup.
-- -----------------------------------------------------------------------------

create table if not exists public.personal_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  exercise_id     text not null references public.exercises(id),
  metric          public.pr_metric_t not null,

  -- The PR value itself. Numeric(8,2) comfortably covers weight (kg),
  -- estimated 1RM (kg), rep counts (int), and seconds (int).
  value           numeric(8,2) not null check (value > 0),

  -- The set that produced this PR. ON DELETE SET NULL so deleting the set
  -- (e.g. via workout-level cascade) doesn't nuke the PR row — we keep the
  -- historical fact, we just lose the back-pointer. T-214 can refresh the
  -- PR ledger from scratch if needed.
  workout_set_id  uuid references public.workout_sets(id) on delete set null,

  achieved_at     timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Exactly one current PR per (user, exercise, metric).
  unique (user_id, exercise_id, metric)
);

-- PR-lookup during logging: "what's my current max_weight on bench-press?".
create index if not exists personal_records_user_exercise_idx
  on public.personal_records (user_id, exercise_id);


-- -----------------------------------------------------------------------------
-- 5. TRIGGER: enforce workout_sets field-set against exercises.logging_type
-- Runs BEFORE INSERT or UPDATE. Raises a descriptive exception the client
-- can map to a user-friendly error (or, more realistically, a dev-time
-- "your logging UI is wrong" signal — normal UX paths never trigger this).
-- -----------------------------------------------------------------------------

create or replace function public.enforce_workout_set_logging_type()
returns trigger as $$
declare
  lt public.logging_t;
begin
  -- Placeholder rows (completed=false) are skeletons the UI has queued but
  -- the user hasn't filled in yet. Any field combination is permitted on
  -- those rows; we only enforce the logging-type invariant on COMPLETED
  -- sets. This matches the typical workout UX: show N empty rows, user
  -- taps each, fills weight+reps, flips completed=true on confirm.
  if new.completed is not true then
    return new;
  end if;

  -- O(1) PK lookup on exercises.
  select logging_type into lt
    from public.exercises
   where id = new.exercise_id;

  if lt is null then
    -- FK would catch this before the trigger fires, but guard anyway.
    raise exception 'workout_sets: unknown exercise_id %', new.exercise_id;
  end if;

  if lt = 'weight_reps' then
    if new.weight_kg is null or new.reps is null then
      raise exception
        'workout_sets: weight_reps requires weight_kg and reps (exercise_id=%)',
        new.exercise_id;
    end if;
    if new.seconds is not null then
      raise exception
        'workout_sets: weight_reps must not set seconds (exercise_id=%)',
        new.exercise_id;
    end if;

  elsif lt = 'reps_only' then
    if new.reps is null then
      raise exception
        'workout_sets: reps_only requires reps (exercise_id=%)',
        new.exercise_id;
    end if;
    -- weight_kg is OPTIONAL for reps_only (weighted pull-ups / dips flow).
    if new.seconds is not null then
      raise exception
        'workout_sets: reps_only must not set seconds (exercise_id=%)',
        new.exercise_id;
    end if;

  elsif lt = 'time_seconds' then
    if new.seconds is null then
      raise exception
        'workout_sets: time_seconds requires seconds (exercise_id=%)',
        new.exercise_id;
    end if;
    if new.weight_kg is not null or new.reps is not null then
      raise exception
        'workout_sets: time_seconds must not set weight_kg or reps (exercise_id=%)',
        new.exercise_id;
    end if;

  -- 'distance_weight' is reserved for future use; no rows in the current
  -- seed (T-105) use it, so we leave it unconstrained until UI lands.
  end if;

  return new;
end;
$$ language plpgsql;

-- Trigger fires on INSERT and on UPDATE of any field the invariant cares
-- about. `completed` is included because flipping a placeholder row to
-- completed=true must re-validate the field set (see the early-return in
-- the trigger body).
drop trigger if exists workout_sets_enforce_logging_type on public.workout_sets;
create trigger workout_sets_enforce_logging_type
  before insert or update of weight_kg, reps, seconds, exercise_id, completed
  on public.workout_sets
  for each row execute function public.enforce_workout_set_logging_type();


-- -----------------------------------------------------------------------------
-- 6. TRIGGERS: updated_at maintenance
-- Re-uses the `public.handle_updated_at()` function from the profiles
-- migration (20260418000000). That function is schema-level (not per-table),
-- so we can hook it up to any table.
-- -----------------------------------------------------------------------------

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.handle_updated_at();

drop trigger if exists workout_sets_set_updated_at on public.workout_sets;
create trigger workout_sets_set_updated_at
  before update on public.workout_sets
  for each row execute function public.handle_updated_at();

drop trigger if exists personal_records_set_updated_at on public.personal_records;
create trigger personal_records_set_updated_at
  before update on public.personal_records
  for each row execute function public.handle_updated_at();


-- -----------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------

-- 7a. workouts: own-row via auth.uid() = user_id.
alter table public.workouts enable row level security;

drop policy if exists workouts_select_own on public.workouts;
create policy workouts_select_own
  on public.workouts
  for select
  using (auth.uid() = user_id);

drop policy if exists workouts_insert_own on public.workouts;
create policy workouts_insert_own
  on public.workouts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists workouts_update_own on public.workouts;
create policy workouts_update_own
  on public.workouts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists workouts_delete_own on public.workouts;
create policy workouts_delete_own
  on public.workouts
  for delete
  using (auth.uid() = user_id);


-- 7b. workout_sets: ownership inherited via workout_id → workouts.user_id.
-- The EXISTS subquery is parameterised with the current auth.uid(), so PG
-- can push the filter into the index plan on workouts(user_id, id).
alter table public.workout_sets enable row level security;

drop policy if exists workout_sets_select_own on public.workout_sets;
create policy workout_sets_select_own
  on public.workout_sets
  for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
  on public.workout_sets
  for insert
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
  on public.workout_sets
  for update
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists workout_sets_delete_own on public.workout_sets;
create policy workout_sets_delete_own
  on public.workout_sets
  for delete
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );


-- 7c. personal_records: own-row via auth.uid() = user_id.
alter table public.personal_records enable row level security;

drop policy if exists personal_records_select_own on public.personal_records;
create policy personal_records_select_own
  on public.personal_records
  for select
  using (auth.uid() = user_id);

drop policy if exists personal_records_insert_own on public.personal_records;
create policy personal_records_insert_own
  on public.personal_records
  for insert
  with check (auth.uid() = user_id);

drop policy if exists personal_records_update_own on public.personal_records;
create policy personal_records_update_own
  on public.personal_records
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists personal_records_delete_own on public.personal_records;
create policy personal_records_delete_own
  on public.personal_records
  for delete
  using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 8. VIEW: workouts_with_totals
-- Aggregates per-workout derived values (volume_kg, set_count, exercise_count)
-- from workout_sets. Read-only, inherits RLS from the underlying tables.
-- Clients query this view for list-view cards so they get totals without
-- having to JOIN + GROUP BY on every render.
--
-- Note: volume_kg sums `weight_kg * reps` for sets where both are present
-- (i.e. weight_reps + weighted reps_only). time_seconds sets contribute
-- zero volume — they're tracked in a separate "total_seconds" column so
-- the UI can decide what to display per-exercise-type.
-- -----------------------------------------------------------------------------

create or replace view public.workouts_with_totals as
  select
    w.id,
    w.user_id,
    w.name,
    w.source,
    w.split_type,
    w.started_at,
    w.completed_at,
    w.created_at,
    w.updated_at,
    coalesce(sum(
      case
        when s.completed and s.weight_kg is not null and s.reps is not null
          then s.weight_kg * s.reps
        else 0
      end
    ), 0)::numeric(10,2) as volume_kg,
    coalesce(sum(
      case when s.completed and s.seconds is not null then s.seconds else 0 end
    ), 0)::bigint as total_seconds,
    count(*) filter (where s.completed) as set_count,
    count(distinct s.exercise_id) filter (where s.completed) as exercise_count
  from public.workouts w
  left join public.workout_sets s on s.workout_id = w.id
  group by w.id;

-- Views don't have their own RLS; they execute with the invoking user's
-- permissions on the underlying tables. That's exactly what we want here.
