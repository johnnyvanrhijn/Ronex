-- =============================================================================
-- Migration: promote profiles.preferred_split from text → split_type_t enum
-- Task: T-113-A
-- Source: Johnny + Backend review 2026-04-19
-- Idempotent: safe to re-run.
--
-- Why
-- ---
-- T-111 (onboarding plan-preferences screen) writes exactly 4 literal values
-- into profiles.preferred_split ('ppl' | 'upper_lower' | 'full_body' |
-- 'custom'). The column was seeded as plain `text` in the initial profiles
-- migration (20260418000000). Promoting to an enum now (a) enforces the
-- contract at the DB level before any other table references split names
-- (e.g. the future `plans` table), (b) gives us a single authoritative list
-- to reference from Edge Functions / AI prompts, and (c) matches the pattern
-- used for every other categorical column on profiles (biological_sex_t,
-- level_t, usage_type_t, experience_bucket_t, …).
--
-- Safety notes
-- ------------
-- 1. The `plans` table doesn't exist yet, so there's no risk of collision
--    with another column named `split_type` — this migration creates the
--    enum from scratch. When `plans.split_type` lands later, it re-uses
--    this same enum.
-- 2. The USING cast is DEFENSIVE: any existing text value not in the 4
--    allowed values is coerced to NULL rather than failing the migration.
--    As of 2026-04-19 the column is NULL on every live row (onboarding
--    hasn't shipped yet), so this is a no-op in practice, but we keep the
--    guard so re-running against a non-pristine DB won't error.
-- 3. RLS is untouched: `profiles_update_own` uses `auth.uid() = id` with
--    no column-level predicate, so the type change is transparent to all
--    existing policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUM
-- Wrapped in a do-block so re-applying the migration (or running against a
-- DB where `plans` already created the type) is idempotent.
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.split_type_t as enum (
    'ppl',
    'upper_lower',
    'full_body',
    'custom'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 2. COLUMN TYPE PROMOTION
-- Postgres refuses to re-run an `alter column … type …` when the target type
-- already matches, so we gate the ALTER behind a metadata check. The
-- information_schema answer is 'USER-DEFINED' for enum columns and 'text' for
-- the pre-migration state, which lets us make this block safely re-runnable.
-- -----------------------------------------------------------------------------

do $$
declare
  current_type text;
begin
  select data_type
    into current_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'preferred_split';

  if current_type = 'text' then
    alter table public.profiles
      alter column preferred_split type public.split_type_t
      using (
        case
          when preferred_split in ('ppl', 'upper_lower', 'full_body', 'custom')
            then preferred_split::public.split_type_t
          else null
        end
      );
  end if;
end $$;
