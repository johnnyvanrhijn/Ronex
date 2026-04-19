-- =============================================================================
-- Verification queries for 20260419105008_workouts_schema.sql
-- Run these AFTER applying the migration to sanity-check the apply.
-- Expected output for each query is commented above the query.
-- =============================================================================

-- 1) All three tables exist in public.
-- Expected: 3 rows (workouts, workout_sets, personal_records)
select tablename
  from pg_tables
 where schemaname = 'public'
   and tablename in ('workouts', 'workout_sets', 'personal_records')
 order by tablename;

-- 2) Two new enums exist.
-- Expected: 2 rows (pr_metric_t, workout_source_t)
select typname
  from pg_type
 where typname in ('workout_source_t', 'pr_metric_t')
 order by typname;

-- 3) RLS is enabled on all three tables.
-- Expected: 3 rows, all relrowsecurity = t
select relname, relrowsecurity
  from pg_class
 where relname in ('workouts', 'workout_sets', 'personal_records')
 order by relname;

-- 4) Expected policies present.
-- Expected: 12 rows total
--   workouts            4 (select/insert/update/delete own)
--   workout_sets        4 (select/insert/update/delete own)
--   personal_records    4 (select/insert/update/delete own)
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('workouts', 'workout_sets', 'personal_records')
 order by tablename, cmd, policyname;

-- 5) Indexes present.
-- Expected: 4 rows (workouts_user_started_idx, workout_sets_workout_order_idx,
--                   workout_sets_exercise_completed_idx,
--                   personal_records_user_exercise_idx)
select indexname
  from pg_indexes
 where schemaname = 'public'
   and indexname in (
     'workouts_user_started_idx',
     'workout_sets_workout_order_idx',
     'workout_sets_exercise_completed_idx',
     'personal_records_user_exercise_idx'
   )
 order by indexname;

-- 6) Trigger for logging-type enforcement is wired up.
-- Expected: 1 row (workout_sets_enforce_logging_type)
select tgname
  from pg_trigger
 where tgrelid = 'public.workout_sets'::regclass
   and tgname = 'workout_sets_enforce_logging_type';

-- 7) updated_at triggers are wired up on all three tables.
-- Expected: 3 rows
select tgrelid::regclass::text as table_name, tgname
  from pg_trigger
 where tgname like '%_set_updated_at'
   and tgrelid::regclass::text in (
     'public.workouts',
     'public.workout_sets',
     'public.personal_records'
   )
 order by table_name;

-- 8) View `workouts_with_totals` exists.
-- Expected: 1 row
select viewname
  from pg_views
 where schemaname = 'public'
   and viewname = 'workouts_with_totals';

-- 9) Row counts should be zero (no seeds in this migration).
-- Expected: 0, 0, 0
select
  (select count(*) from public.workouts)          as workouts_count,
  (select count(*) from public.workout_sets)      as workout_sets_count,
  (select count(*) from public.personal_records)  as personal_records_count;
