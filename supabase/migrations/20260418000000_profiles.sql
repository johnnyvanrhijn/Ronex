-- =============================================================================
-- Migration: profiles table + RLS + display_name blocklist + auto-create trigger
-- Task: T-101
-- Source: temp-files/t-101-profiles-schema-proposal.md (APPROVED 2026-04-18)
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- Postgres does not support `create type if not exists`, so we wrap each in a
-- do-block that swallows the duplicate_object exception.
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.biological_sex_t as enum ('male', 'female');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.level_t as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.language_t as enum ('nl', 'en');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.usage_type_t as enum ('loose', 'plan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.onboarding_type_t as enum ('full', 'minimal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.experience_bucket_t as enum ('<1y', '1-3y', '3-5y', '5+y');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.injury_t as enum (
    'lower_back', 'upper_back', 'neck',
    'shoulder_left', 'shoulder_right',
    'elbow', 'wrist',
    'knee_left', 'knee_right',
    'hip', 'ankle', 'hamstring', 'groin', 'achilles',
    'other'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 2. BANNED DISPLAY NAMES (seed lookup)
-- 41 words: 11 impersonation + 15 NL profanity + 15 EN profanity.
-- -----------------------------------------------------------------------------

create table if not exists public.banned_display_names (
  word text primary key
);

insert into public.banned_display_names (word) values
  -- Impersonation (11)
  ('admin'), ('administrator'), ('support'), ('moderator'), ('mod'),
  ('root'), ('system'), ('bot'), ('official'), ('ronex'), ('claude'),
  -- NL profanity (15)
  ('kut'), ('kanker'), ('kutwijf'), ('klootzak'), ('hoer'),
  ('hoerenzoon'), ('tyfus'), ('tering'), ('lul'), ('mongool'),
  ('kankerhoer'), ('neuken'), ('neuker'), ('kutkind'), ('flikker'),
  -- EN profanity (15)
  ('fuck'), ('shit'), ('bitch'), ('asshole'), ('cunt'),
  ('dick'), ('pussy'), ('whore'), ('slut'), ('fag'),
  ('faggot'), ('nigger'), ('nigga'), ('retard'), ('motherfucker')
on conflict (word) do nothing;


-- -----------------------------------------------------------------------------
-- 3. TRIGGER FUNCTION: display_name blocklist check
-- Uses PostgreSQL word-boundary regex markers \m and \M so "Kanker" as a whole
-- word is blocked but "kan" inside another word is not.
-- -----------------------------------------------------------------------------

create or replace function public.check_display_name_allowed()
returns trigger as $$
begin
  if new.display_name is null then
    return new;
  end if;
  if exists (
    select 1 from public.banned_display_names
    where lower(new.display_name) ~ ('\m' || word || '\M')
  ) then
    raise exception 'display_name contains prohibited word';
  end if;
  return new;
end;
$$ language plpgsql;


-- -----------------------------------------------------------------------------
-- 4. TRIGGER FUNCTION: updated_at auto-maintained
-- -----------------------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- -----------------------------------------------------------------------------
-- 5. PROFILES TABLE
-- NOT NULL is NOT enforced on identity fields (biological_sex, level, etc.)
-- because the row is created at signup with only `id` set. onboarding_completed_at
-- being non-null is the app-level signal that required fields have been filled.
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id                           uuid primary key references auth.users(id) on delete cascade,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  -- Identity (populated during onboarding)
  display_name                 text check (display_name is null or char_length(display_name) between 1 and 40),
  biological_sex               public.biological_sex_t,
  level                        public.level_t,
  language                     public.language_t not null default 'nl',

  -- Full onboarding extras (Path A only)
  experience_bucket            public.experience_bucket_t,
  usage_type                   public.usage_type_t,
  training_frequency_per_week  smallint check (
    training_frequency_per_week is null
    or training_frequency_per_week between 1 and 7
  ),
  preferred_split              text,
  focus_muscle_groups          text[] not null default '{}',
  injuries                     public.injury_t[] not null default '{}',

  -- Handicap (deferred prompt per SPEC 7.4, never exposed to other users)
  bodyweight_kg                numeric(5,2),

  -- Onboarding state
  onboarding_type              public.onboarding_type_t,
  onboarding_completed_at      timestamptz,

  -- Timezone (IANA, seeded via Intl.DateTimeFormat in T-113)
  timezone                     text not null default 'Europe/Amsterdam'
);


-- -----------------------------------------------------------------------------
-- 6. TRIGGERS on profiles
-- -----------------------------------------------------------------------------

-- Display name blocklist check (before insert/update of display_name)
drop trigger if exists profiles_display_name_check on public.profiles;
create trigger profiles_display_name_check
  before insert or update of display_name on public.profiles
  for each row execute function public.check_display_name_allowed();

-- updated_at maintenance (before update)
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();


-- -----------------------------------------------------------------------------
-- 7. AUTO-CREATE PROFILE ON SIGNUP
-- Fires after insert on auth.users. SECURITY DEFINER so it can write into
-- public.profiles regardless of the invoking role.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 8. ROW-LEVEL SECURITY: profiles
-- Default DENY + explicit own-row policies. No DELETE policy: profile lifecycle
-- is tied to auth.users via ON DELETE CASCADE.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  with check (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY: banned_display_names
-- Deny everything. The trigger function runs and reads this table via the
-- normal Postgres permission model, not via RLS (RLS only applies to direct
-- table access from authenticated/anon roles).
-- -----------------------------------------------------------------------------

alter table public.banned_display_names enable row level security;

drop policy if exists banned_display_names_deny_all on public.banned_display_names;
create policy banned_display_names_deny_all
  on public.banned_display_names
  for all
  using (false);
