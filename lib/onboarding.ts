/**
 * lib/onboarding.ts
 *
 * Flush helper that commits the zustand onboarding draft to the `profiles`
 * row for the currently signed-in user.
 *
 * Task
 * ----
 * T-113 (PARTIAL SCOPE). Covers only the fields filled by T-108 (displayName,
 * biologicalSex) and T-109 (experienceBucket — nullable). The remaining
 * fields (usage_type, training_frequency_per_week, preferred_split,
 * focus_muscle_groups, injuries) stay at their table defaults until
 * T-110/T-111/T-112 screens ship and this helper is extended.
 *
 * Usage
 * -----
 * Called from terminal onboarding screens (currently the stub at
 * `/(onboarding)/usage-type`). Runs OUTSIDE React — reads zustand via
 * `getState()`, not via the hook. Returns a discriminated union so callers
 * can handle success vs. error without throwing.
 *
 * Server-side safety
 * ------------------
 * - The `profiles_update_own` RLS policy requires `auth.uid() = id`, so the
 *   client simply updates its own row under the authenticated session — no
 *   service-role key, no escalation.
 * - The `check_display_name_allowed` trigger rejects profanity / impersonation
 *   with `display_name contains prohibited word`. We surface a generic toast
 *   message and DO NOT echo the word back (avoids leaking the blocklist).
 */

import { supabase } from '@/lib/supabase';
import { useOnboardingDraft } from '@/stores/onboardingDraft';

export type FlushResult =
  | { success: true }
  | { success: false; error: string };

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
 * Map a Supabase error into a user-facing string. The server-side display-name
 * trigger raises a custom message; we collapse that (and any length-check
 * violation) into a single generic "name not available" message so we never
 * leak which word tripped the blocklist.
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
    lowered.includes('timeout')
  ) {
    return 'network';
  }

  // Fall through to a generic error key — callers translate via i18n.
  return 'generic';
}

/**
 * Flush the current zustand onboarding draft to Supabase.
 *
 * Fields written this turn (T-113 partial scope):
 *   - display_name            (from draft.displayName, trimmed)
 *   - biological_sex          (from draft.biologicalSex)
 *   - experience_bucket       (from draft.experienceBucket; nullable)
 *   - timezone                (resolved via Intl)
 *   - onboarding_completed_at (server clock via new Date().toISOString())
 *
 * On success: clears the zustand draft so a re-entry starts clean.
 * On error: leaves the draft intact, returns the error key.
 */
export async function flushOnboardingDraft(): Promise<FlushResult> {
  // Pull the current draft outside React. `getState()` is the escape hatch
  // zustand exposes for non-component code.
  const draft = useOnboardingDraft.getState();

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

  // Build the update payload. We write `experience_bucket` as the exact
  // value the draft holds — `null` is a legitimate choice (skip link on
  // T-109) and the column is nullable.
  const payload = {
    display_name: draft.displayName.trim(),
    biological_sex: draft.biologicalSex,
    experience_bucket: draft.experienceBucket,
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
