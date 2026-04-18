-- =============================================================================
-- Migration: exercises table + 6 taxonomy enums + RLS (public read-only)
-- Task: T-103
-- Source: temp-files/t-103-exercise-library-proposal.md (APPROVED 2026-04-18)
-- Idempotent: safe to re-run. Seeds live in T-104/T-105, not here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- Postgres does not support `create type if not exists`, so each enum is wrapped
-- in a do-block that swallows the duplicate_object exception. This matches the
-- pattern from 20260418000000_profiles.sql.
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.muscle_t as enum (
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.equipment_t as enum (
    'barbell',
    'dumbbell',
    'machine',
    'cable',
    'bodyweight',
    'kettlebell',
    'smith_machine',
    'bands'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pattern_t as enum (
    'push',
    'pull',
    'squat',
    'hinge',
    'lunge',
    'carry',
    'isolation',
    'core'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_t as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.leverage_t as enum ('none', 'partial', 'full');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.logging_t as enum (
    'weight_reps',
    'reps_only',
    'time_seconds',
    'distance_weight'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 2. EXERCISES TABLE
-- Slug-PK (human-readable, stable across envs, debuggable in Claude prompts).
-- All fields NOT NULL — every row in the canonical library is fully specified
-- at seed time (T-104/T-105). gender_bias_factor constrained to [1.00, 2.00]
-- as a defensive guard against accidental malformed seed data.
-- -----------------------------------------------------------------------------

create table if not exists public.exercises (
  id                   text primary key,
  name                 text not null,
  primary_muscle       public.muscle_t not null,
  secondary_muscles    public.muscle_t[] not null default '{}',
  equipment            public.equipment_t not null,
  movement_pattern     public.pattern_t not null,
  is_compound          boolean not null,
  is_unilateral        boolean not null,
  difficulty           public.difficulty_t not null,
  gender_bias_factor   numeric(3,2) not null check (
    gender_bias_factor >= 1.00 and gender_bias_factor <= 2.00
  ),
  bodyweight_leverage  public.leverage_t not null,
  logging_type         public.logging_t not null,
  challenge_suitable   boolean not null,
  created_at           timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 3. INDEXES
-- primary_muscle filter: drives focus-muscle workout generation and UI filters.
-- challenge_suitable partial index: challenge workouts always filter on TRUE
-- (see T-304 AI prompt, T-713 handicap calc, T-714 challenge flow).
-- -----------------------------------------------------------------------------

create index if not exists exercises_primary_muscle_idx
  on public.exercises (primary_muscle);

create index if not exists exercises_challenge_suitable_idx
  on public.exercises (challenge_suitable)
  where challenge_suitable = true;


-- -----------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY
-- Canonical library is read-only for end users. Authenticated role can SELECT
-- all rows. No INSERT/UPDATE/DELETE policies — seeds run via service_role
-- (which bypasses RLS) in T-105.
-- -----------------------------------------------------------------------------

alter table public.exercises enable row level security;

drop policy if exists exercises_select_all on public.exercises;
create policy exercises_select_all
  on public.exercises
  for select
  to authenticated
  using (true);
