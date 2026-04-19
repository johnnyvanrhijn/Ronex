/**
 * lib/onboarding.ts
 *
 * Flush helper that commits the zustand onboarding draft to the `profiles`
 * row for the currently signed-in user.
 *
 * Task
 * ----
 * T-113 (final scope). Covers every field filled by the 5-step funnel:
 *   - T-108: displayName, biologicalSex
 *   - T-109: experienceBucket (nullable — skip link allowed)
 *   - T-110: usageType        (nullable — see below)
 *   - T-111: trainingFrequencyPerWeek, preferredSplit (both nullable, written
 *            only on the plan branch)
 *   - T-112: injuries         (array; '{}' is a legitimate "no injuries" state)
 * Plus the terminal metadata: timezone, onboarding_completed_at.
 *
 * focus_muscle_groups is explicitly out-of-scope (post-MVP); the column keeps
 * its `'{}'` table default.
 *
 * Atomicity
 * ---------
 * One `UPDATE … WHERE id = auth.uid()` = one row, one statement. Postgres
 * commits-or-rolls-back the whole payload atomically, so partial flushes are
 * not possible — either every field lands AND onboarding_completed_at is set,
 * or nothing lands and the gate stays closed. This keeps the
 * "onboarding_completed_at is null" signal trustworthy across crashes,
 * network drops, and mid-request cancellations.
 *
 * Usage
 * -----
 * Called from the terminal onboarding screen (`/(onboarding)/injuries.tsx`).
 * Runs OUTSIDE React — reads zustand via `getState()`, not via the hook.
 * Returns a discriminated union so callers can handle success vs. error
 * without throwing.
 *
 * Server-side safety
 * ------------------
 * - The `profiles_update_own` RLS policy requires `auth.uid() = id`, so the
 *   client simply updates its own row under the authenticated session — no
 *   service-role key, no escalation.
 * - The `check_display_name_allowed` trigger rejects profanity / impersonation
 *   with `display_name contains prohibited word`. We surface a generic toast
 *   message and DO NOT echo the word back (avoids leaking the blocklist).
 * - `preferred_split` is a `split_type_t` enum on the DB side
 *   (migration 20260419000000). Invalid values are rejected by Postgres with
 *   "invalid input value for enum". The store's type already constrains us
 *   to the 4 legal literals, so this is a defence-in-depth check.
 */

import { supabase } from '@/lib/supabase';
import {
  useOnboardingDraft,
  type BiologicalSex,
  type ExperienceBucket,
  type Injury,
  type UsageType,
} from '@/stores/onboardingDraft';

export type FlushResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Overrides for `flushOnboardingDraft`. Any field passed here takes precedence
 * over the zustand store's current value at read time. Primary use case:
 * callers that have just computed a new value in local state and need to
 * guarantee it lands in the payload WITHOUT relying on zustand's set-then-
 * read ordering (which, though synchronous in practice today, is fragile if
 * a setter is ever refactored to be async — see B-016).
 *
 * Pass only the fields you want to override; everything else is still read
 * from the live store. This keeps the ergonomics of the single-arg call
 * (`flushOnboardingDraft()`) intact while giving screens a safe escape hatch
 * when they care about a specific field's exact value.
 */
export type FlushOverrides = {
  displayName?: string;
  biologicalSex?: BiologicalSex;
  experienceBucket?: ExperienceBucket;
  usageType?: UsageType;
  trainingFrequencyPerWeek?: number | null;
  preferredSplit?: string | null;
  injuries?: Injury[];
};

/**
 * Resolve the user's IANA timezone (e.g. "Europe/Amsterdam"). Falls back to
 * the profiles table default if the platform doesn't expose it.
 *
 * SPEC §7.7 requires per-user local time for weekly league rollover, which
 * is why we seed this at onboarding completion instead of leaving it at the
 * DB default forever.
 */
function resolveTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === 'string') return tz;
  } catch {
    // Intl API can throw on older JS runtimes / Hermes configurations.
  }
  return 'Europe/Amsterdam';
}

/**
 * Map a Supabase error into a user-facing string key. The server-side
 * display-name trigger raises a custom message; we collapse that (and any
 * length-check violation) into a single generic "name not available" key so
 * we never leak which word tripped the blocklist.
 *
 * Covered cases:
 *   - display_name blocklist trigger    → 'nameNotAvailable'
 *   - display_name length CHECK (1..40) → 'nameNotAvailable'
 *   - offline / timeout / fetch failure → 'network'
 *   - enum mismatch (preferred_split,
 *     biological_sex, usage_type, …)    → 'generic'  (should never happen
 *                                          because the store is typed; kept
 *                                          as a defence-in-depth fallback)
 *   - anything else                     → 'generic'
 */
function mapError(message: string | undefined): string {
  const raw = message ?? '';
  const lowered = raw.toLowerCase();

  if (
    lowered.includes('display_name contains prohibited word') ||
    lowered.includes('display_name') // CHECK constraint on length etc.
  ) {
    return 'nameNotAvailable';
  }

  if (
    lowered.includes('network') ||
    lowered.includes('fetch') ||
    lowered.includes('timeout') ||
    lowered.includes('offline')
  ) {
    return 'network';
  }

  // Fall through to a generic error key — callers translate via i18n.
  // Enum mismatches (e.g. "invalid input value for enum split_type_t") land
  // here. We intentionally don't surface the specific enum to the user:
  // those errors indicate a client-side bug, not something a user can fix.
  return 'generic';
}

/**
 * Flush the current zustand onboarding draft to Supabase.
 *
 * Fields written:
 *   - display_name                 (draft.displayName, trimmed)
 *   - biological_sex               (draft.biologicalSex)
 *   - experience_bucket            (nullable — skip link on T-109)
 *   - usage_type                   ('loose' | 'plan' | null)
 *   - training_frequency_per_week  (1-7 or null; null on loose path)
 *   - preferred_split              (enum; null on loose path)
 *   - injuries                     (empty array = "no injuries")
 *   - timezone                     (resolved via Intl, fallback Europe/Amsterdam)
 *   - onboarding_completed_at      (client clock — atomic marker for the gate)
 *
 * Cross-field invariant: when usage_type === 'loose', training_frequency_per_week,
 * preferred_split, and focus_muscle_groups must all be null/empty. This is
 * enforced client-side in stores/onboardingDraft.ts (setUsageType clears
 * plan fields on a plan→loose switch). Not enforced as a DB CHECK — see
 * docs for the reasoning (keeps future edit-profile flows flexible).
 *
 * On success: clears the zustand draft so a re-entry starts clean.
 * On error:   leaves the draft intact, returns the error key.
 *
 * @param overrides  Optional per-field overrides that take precedence over the
 *                   live zustand store. Use this when a caller has a just-
 *                   computed local value that hasn't round-tripped through a
 *                   store setter yet (see B-016). Pass only the fields you
 *                   want to override.
 */
export async function flushOnboardingDraft(
  overrides?: FlushOverrides,
): Promise<FlushResult> {
  // Pull the current draft outside React. `getState()` is the escape hatch
  // zustand exposes for non-component code. Overrides are layered on top so
  // callers can guarantee a specific field's value without depending on
  // zustand's set-then-read synchronicity.
  const draft = useOnboardingDraft.getState();

  const displayName = (overrides?.displayName ?? draft.displayName).trim();
  const biologicalSex = overrides?.biologicalSex ?? draft.biologicalSex;
  const experienceBucket =
    overrides?.experienceBucket ?? draft.experienceBucket;
  const usageType = overrides?.usageType ?? draft.usageType;
  const trainingFrequencyPerWeek =
    overrides?.trainingFrequencyPerWeek !== undefined
      ? overrides.trainingFrequencyPerWeek
      : draft.trainingFrequencyPerWeek;
  const preferredSplit =
    overrides?.preferredSplit !== undefined
      ? overrides.preferredSplit
      : draft.preferredSplit;
  const injuries = overrides?.injuries ?? draft.injuries ?? [];

  // B-025 guard: reject empty display_name client-side before we hit the DB.
  // The `profiles.display_name` CHECK constraint (char_length between 1 and 40)
  // would reject this anyway, but the resulting Postgres error message
  // includes the word "display_name" which then gets mis-mapped into a
  // "name not available" toast — confusing for the user because it reads as
  // "your name choice was rejected by a blocklist" when the real cause is a
  // corrupt draft. Fail fast, return `generic` so the caller surfaces the
  // neutral error toast instead.
  if (displayName.length < 1) {
    return { success: false, error: 'generic' };
  }

  // Resolve the current user from the live Supabase session. Going through
  // auth.getUser() (rather than trusting a stale prop) ensures we write
  // against the user whose session will RLS-authorize the update.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: userError?.message ?? 'unauthorized',
    };
  }

  const timezone = resolveTimezone();

  // Build the update payload. Null is a legitimate value for every nullable
  // field below — we let the store's types (and the screens that write them)
  // be the source of truth for whether each field is optional.
  //
  // NOTE: onboarding_completed_at is set LAST in this object but Postgres
  // applies the whole UPDATE atomically, so there's no ordering risk — the
  // gate flips true only if every other field in this payload also lands.
  const payload = {
    display_name: displayName,
    biological_sex: biologicalSex,
    experience_bucket: experienceBucket,
    usage_type: usageType,
    // Both nullable — loose-path users legitimately write null here. The
    // store clears these when usage_type flips plan→loose (see
    // stores/onboardingDraft.ts → setUsageType), so we never send a stale
    // plan selection after a path switch.
    training_frequency_per_week: trainingFrequencyPerWeek,
    preferred_split: preferredSplit,
    // Column is `not null default '{}'`. Empty array = "Geen blessures" path.
    injuries,
    timezone,
    onboarding_completed_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id);

  if (updateError) {
    return {
      success: false,
      error: mapError(updateError.message),
    };
  }

  // Wipe the draft so the store (and its persisted AsyncStorage mirror)
  // reset to EMPTY_DRAFT. Re-entering onboarding from a fresh account will
  // start with empty fields.
  useOnboardingDraft.getState().clear();

  return { success: true };
}
