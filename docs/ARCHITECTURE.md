# Ronex — Technical Architecture

> Skeleton architecture doc. Backend agent maintains this as the system evolves.

## Setup log

### 2026-04-19 — TimeSecondsRow redesign: stopwatch demoted to helper
- **Rationale.** The T-209 Fase 2 spec made the stopwatch dominate the time-column: a Start/Stop/Reset button-triplet + a readout-as-tappable-manual-entry trick + a side-pill for unilateral. Field feedback from Johnny: users mostly time with a wall clock, Apple Watch, or a remembered target (e.g. "plank 45 seconds") — they want to TYPE the number, not run a stopwatch. The stopwatch is secondary, not dominant.
- **New model.** Numeric seconds `TextInput` is the primary control (mirrors reps input in `RepsOnlyRow`). The ⏱ stopwatch is a tertiary helper-affordance — a compact icon-button to the right of the input (36pt min-width, muted `stopwatch-outline` Ionicon at rest). A `= m:ss` helper-label renders below the row as small-caps muted (72pt left-indent, same alignment math as RepsOnlyRow's `+ kg` hint) — automatic, no user action, so `75` typed reads as `= 1:15` for sanity. Removed: the Start/Stop/Reset context-swap button, the manual-entry overlay, the side-pill toggle.
- **Non-destructive merge on Stop (Johnny's decision, not silent overwrite).** When Stop fires the handler checks the typed buffer: if `manualValue !== null && manualValue > 0` → the manual value wins and the stopwatch elapsed is discarded silently. Otherwise the stopwatch value populates the input. No modal, no confirm, no toast. Manual intent > automated observation — the user may have timed with an Apple Watch and let the in-app stopwatch run in parallel as a backup. Asymmetric but correct.
- **Cancel gesture: long-press (not double-tap).** Running state: tap = Stop (writes merged value), long-press (500ms) = Cancel (discards run, store untouched). Rejected double-tap because during a plank/hold the user's hand is shaking and accidental cancels would lose timing data on a hard set. Long-press is deliberate by definition. Discoverability gap closed with a small-caps hint below the running button: `"tap = stop · lang ingedrukt = annuleer"` / `"tap = stop · hold = cancel"`. Hint auto-hides on Stop/Cancel (never clutters idle state). Cancel fires a `Warning` haptic so the abort is felt.
- **Running-state UX.** The input morphs into a live tabular-nums readout (read-only `View`, not a `TextInput`) — prevents sweaty-hand accidental keyboard pops mid-plank. Ticks at 100ms (up from 250ms in the previous impl) for a smoother digit refresh on short rep-tempo exercises; single-row render cost is trivial. The ⏱ button swaps to a red `STOP` pill while running. `accessibilityLiveRegion="polite"` on the live readout announces seconds to VoiceOver without barking every tick.
- **Unilateral = two inputs side-by-side.** Unlike the Fase 2 single-input + L/R pill model (rejected after review), bilateral inputs let the user see and edit both sides simultaneously. The shared ⏱ dispatches to the last-focused side (`lastFocusedSide` ref; defaults to L if neither focused yet). On Start the running-side is LOCKED for the duration of that run (swapping sides mid-run is a different mental model — the user stops + restarts for the other side). Store contract unchanged: raw `{l, r}` in `set.notes` JSON, aggregate `max(L, R)` in `set.seconds`. Helper label reads `= 0:45 · 0:42` with em-dash placeholder for unfilled sides (`= 0:45 · —`).
- **i18n deltas.** Removed: `workout.stopwatchReset` (no Reset anymore). Repurposed: `workout.stopwatchStart` (aria for the ⏱ idle icon) → `"Start stopwatch"`/`"Start stopwatch"`, `workout.stopwatchStop` (visible label while running) unchanged at `"Stop"`. Added: `workout.stopwatchCancel` (aria for the long-press), `workout.stopwatchCancelHint` (the small-caps hint text), `workout.secondsPlaceholder` (replaces `timeManualEntryHint` for the input placeholder/aria — old key retained in JSON for rollback-safety, no code references), `workout.secondsEquivalent` (templated VoiceOver text for the `= m:ss` label). `timeManualEntryHint` remains in both locale files but is unused by any component.
- **Scope guards honoured.** Did NOT touch WeightRepsRow, RepsOnlyRow, `stores/activeWorkout.ts`, or the sync layer. `ActiveSet`'s `seconds + notes` shape carried over verbatim. ExerciseGroup's variant dispatcher was inspected but needed no changes — the `time_seconds` column header (`tijd` / `time`) still aligns with the new primary-input flow. B-029's header-× work was left intact.

### 2026-04-19 — B-029: Bucket-level exercise delete on active-workout
- New zustand setter `removeExercise(exerciseId)` in `stores/activeWorkout.ts` — filters `state.sets` by the exerciseId and schedules a sync. **Server-orphan policy mirrors `removeSet`:** any already-synced `workout_sets` rows stay on the server as orphans until the Phase 3 cleanup pass; they're invisible to every UI (queries are keyed by `workout_id`, totals view re-aggregates on read). Tracking removed-serverIds in-store + issuing targeted DELETEs is the eventual Phase 3 fix.
- **New modal component** `components/workout/DeleteExerciseModal.tsx` rather than overloading `DiscardModal.tsx`. Two structural reasons: (a) the title is interpolated with `{{name}}` (DiscardModal's title is literal) and (b) the body is pluralized with `{{count}}` AND suppressed entirely when `setCount === 0` (DiscardModal's body is static). Both sheets share the bottom-scrim + 14pt-height button pair pattern; the component is a near-clone minus those two differences. Haptic on confirm: `Haptics.notificationAsync(Warning)`, same as DiscardModal.
- **Header × visual spec (future parity target for set-row ×):** 16pt Ionicon `close`, 25% opacity at rest, color `colors.content.muted`. Tap flow: `selectionAsync` haptic → scale-pulse 0.95→1.0 (reanimated `withSequence`) → parent opens confirm modal. `hitSlop={{ top:12, bottom:12, left:16, right:8 }}` — left-biased so iOS edge-swipe-back gestures don't eat the tap target. NO long-press handler on the header (deliberate: long-press is reserved for set-row edit-mode, reusing it at the header level would create collision risk).
- **i18n plural syntax:** i18next is configured `compatibilityJSON: 'v4'` (see `lib/i18n.ts`) so `{key}_one` / `{key}_other` suffixes Just Work. First pluralized string in the project — `workout.deleteExerciseBody_{one,other}`. TypeScript-check passes cleanly despite the base key (`workout.deleteExerciseBody`) not literally existing in `en.json`: react-i18next's type overloads handle the plural resolution implicitly. No `i18next.d.ts` tweak needed.
- **No rest-timer side-effect on confirm.** Deleting an exercise the user was never mid-set on is NOT a "back to work" signal. If the timer is running from the last completed set on a different exercise, it keeps counting through the delete. (Contrast: set-row delete also doesn't touch the rest timer — same principle.)

### 2026-04-19 — T-209 Fase 2: reps_only + time_seconds row variants
- Three set-row components now exist side-by-side, all sharing a near-identical prop contract so `ExerciseGroup` can dispatch on `exercise.logging_type` without branching inside the rows themselves:
  - `components/workout/WeightRepsRow.tsx` — T-208 Fase 1 (unchanged).
  - `components/workout/RepsOnlyRow.tsx` — reps input + subtle `+ kg` toggle. Completion gate = `reps > 0` only (weight always optional).
  - `components/workout/TimeSecondsRow.tsx` — mm:ss readout + Start/Stop/Reset + manual-entry overlay + L/R pill (unilateral only).
- **Shared prop contract:** `{ set, setNumber, active, isInEditMode, onActivate, onUpdate, onRequestDelete, onFocusWeight, onLongPress, registerRef }`. RepsOnlyRow adds `kgExpanded + onToggleKg + unilateral?`; TimeSecondsRow adds `unilateral?`. All three expose an imperative `{focusWeight, focusReps}` handle so `ExerciseGroup` can auto-focus after picker-return without caring which variant it just mounted (TimeSecondsRow aliases both to the manual-entry input).
- **Variant dispatcher lives in `ExerciseGroup.tsx`.** A switch on `exercise.logging_type` selects the row component; column headers are recomputed per-variant in the same memo (weight_reps → `# · kg · reps · ○`, reps_only → `# · reps · ○` or `# · kg · reps · ○` when expanded, time_seconds → `# · time · ○`). `distance_weight` falls back to WeightRepsRow (not seeded in MVP library — this is a safety net).
- **Unilateral aggregation policy (written into `set.seconds`/`set.reps`/`set.weightKg`, raw per-side values into `set.notes` JSON):**
  - time_seconds: `seconds = max(L, R)`, `notes = JSON.stringify({l,r})`. Per Johnny's decision 1, ONE stopwatch + L/R pill toggle — the user times each side sequentially (side-plank flow). Twin-stopwatch UI was rejected as physically incoherent with how unilateral-time exercises are performed.
  - reps_only (future twin-row): `reps = L + R`, `weightKg = (L+R)/2 rounded`, `notes = JSON.stringify({l:{weight,reps}, r:{weight,reps}})`. Fase 2 ships the single-row contract + the `unilateral?` prop so the twin-row can land without a breaking API change.
- **Manual seconds entry is PURE integer seconds** (decision 2). Tapping the mm:ss readout opens a numeric-pad-only TextInput; the value stored in `set.seconds` is always raw seconds. Display formatting lives in `formatSeconds(s)` inside `TimeSecondsRow.tsx` (also exported for re-use). Rationale: avoids every variant of the mm:ss parser bug class (`1:5`, `10:05`, `0:90`).
- **`+ kg` toggle for reps_only is ALWAYS subtly visible** (decision 3) — `text-small-caps uppercase text-content-muted` below the row, aligned with the reps column. Tapping it flips a per-group `kgExpanded` flag in `ExerciseGroup` (local React state, NOT zustand — ephemeral UI state that resets on app relaunch). Once flipped for one row, ALL remaining rows in the group render the kg input. Auto-seeded to `true` if any existing set in the group already has a non-null `weightKg` (covers re-opens with prior weighted data). Per-exercise persistence deferred post-MVP — Johnny's call, the 80/20 split between bodyweight-only and weighted-pullup users didn't warrant the complexity of a per-exercise preference write during logging.
- **TimeSecondsRow stopwatch state is component-local.** `isRunning`, `startEpochRef`, `elapsedSeconds` live in React state / refs. NOT written into the zustand store until Stop. Rationale: a running timer is UI-ephemeral (if you tab away and come back, you expect to see the last logged value, not a still-ticking counter). Persisting would require wall-clock anchor per row + cleanup on app-kill — a lot of machinery for a 30-second plank. The store-write happens on Stop (non-unilateral) or on per-side Stop with aggregate recompute (unilateral).
- **Reset is post-Stop only** (decision 4) — no mid-run Reset. Post-stop: `[Start]` + `[Reset]` sit side-by-side. Start from the stopped state begins a FRESH attempt (elapsed resets to 0), so users don't accidentally log a 30-second rest-break as a second set. **Copy flag for T-217/Copy agent:** Johnny wants to consider "Nieuwe poging" instead of "Reset" as the label — inline comment in `TimeSecondsRow.tsx` flags this; shipping `stopwatchReset` i18n-key with "Reset" as NL default (loanword rule), EN also "Reset".
- **Scope deferred to T-211:** KeyboardAccessory is NOT mounted on the workout screen in this phase. Trend computation and `useLastSetForExercise` wiring are T-211's designer-scope. Both new row components accept an optional `lastTime?: LastTimeData | null` prop (unused in Fase 2) as a drop-in for T-211.
- **Fase-1 guard removed from `app/workout/active.tsx`.** The `logging_type !== 'weight_reps'` branch + `unsupportedLoggingType` toast trigger are gone. The i18n key is retained (unused) in case of future rollback-gating needs — cheaper than re-adding later.
- **New i18n keys** (NL + EN, per Johnny's NL loanword rule — Start/Stop/Reset stay English in NL): `setsHeaderTime`, `addWeightToggle`, `removeWeightToggle`, `stopwatchStart`, `stopwatchStop`, `stopwatchReset`, `unilateralLeft`, `unilateralRight`, `timeManualEntryHint`.

### 2026-04-19 — T-210: Historical "last time X kg × Y reps" data hook
- New file `lib/queries/useLastSetForExercise.ts` exports `useLastSetForExercise(exerciseId)` and a `lastSetQueryKey(exerciseId)` helper. TanStack Query hook, keyed `['lastSetForExercise', exerciseId]`.
- Query: single-row `workout_sets` lookup via `select('weight_kg, reps, seconds, created_at, workouts!inner(user_id)')` filtered on `exercise_id = ?`, `completed = true`, `workouts.user_id = auth.uid()`, ordered `created_at desc`, `limit(1).maybeSingle()`. Backed by the partial index `workout_sets_exercise_completed_idx` from T-201.
- **Returns all three value columns (weight_kg, reps, seconds)** rather than the logging_type-specific subset, so T-209 Fase 2 row variants (reps_only, time_seconds) can format whichever applies without a second round-trip to `exercises.logging_type`.
- **Explicit `user_id` `.eq` alongside RLS.** Not redundant: the `.eq('workouts.user_id', userId)` lets PostgREST's planner drop rows earlier (the embedded join is INNER, and the filter is pushed into the join predicate) and documents intent for reviewers. RLS is still the source of truth for security.
- **Returns `null` on no-session and no-history.** KeyboardAccessory already handles `null` with an em-dash placeholder; throwing would just force the caller to unwrap an error.
- **Cache invalidation on sync-success.** `lib/sync/syncActiveWorkout.ts` now calls `invalidateLastSetCaches()` after `markSynced()`, which dedups exerciseIds that have any completed set in the just-flushed workout and calls `queryClient.invalidateQueries({ queryKey: lastSetQueryKey(id) })` for each. Placeholder (completed=false) sets are ignored — they're not historical data.
- **`staleTime: 5 min`.** Covers the common "re-focus the app mid-workout" case without stale-data bleed through multi-day gym trips. Explicit invalidation on new-set flush means the 5-min window is a safety net, not the primary freshness mechanism.
- **Render wiring deferred to T-211.** `KeyboardAccessory` is not yet mounted in `app/workout/active.tsx`; a `TODO(T-211)` comment points to the hook + invalidation path so the designer can thread the data through (likely by calling the hook in `ExerciseGroup.tsx` keyed by `exercise.id` and passing `lastTime` into the currently-active row). Trend direction computation (up/same/down vs typed-in-progress values) is also T-211 — it's row-scoped + reactive and lives next to the numpad, not in the data layer.

### 2026-04-19 — T-212: Offline-first sync layer for active workout
- New modules:
  - `lib/network/useIsOnline.ts` — `expo-network`-backed connectivity singleton. Exposes `useIsOnline()` hook, `subscribeOnline()` non-React subscription, and `getIsOnline()` sync reader. Optimistic default (unknown reachability = online) so first-mount attempts aren't blocked on a probe.
  - `stores/syncStatus.ts` — zustand store holding `{ status, lastSyncedAt, errorMessage, pendingOps }`. Status enum: `idle | syncing | synced | error | offline`. Separate from activeWorkout so sync state is NOT persisted to AsyncStorage (transient; resets on app relaunch).
  - `lib/sync/syncActiveWorkout.ts` — the engine. `scheduleSync()` (500ms debounce), `scheduleImmediate()` (no debounce — used by completeWorkout), `retrySync()` (manual), `initSync()` (wires reconnect → re-attempt). Single in-flight attempt with coalescing; 3-retry exponential backoff (1s→2s→4s, cap 10s); bails on offline or auth errors.
  - `hooks/useSyncStatus.ts` — consumer hook. Returns rich object `{ status, uiStatus, pendingOps, lastSyncedAt, errorMessage, retry }` where `uiStatus` is the tri-state ('synced'|'pending'|'error') the T-204 WorkoutHeader cares about.
- **Dirty-tracking strategy: always re-upsert all sets.** Deliberately simpler than per-field hashes or dirty-bits. Max payload ~8KB per sync (40 sets × 200 bytes) — trivial even on 3G. Eliminates a whole class of "I updated the set but didn't mark it dirty" bugs. Flagged for Phase 3 optimization when/if traffic warrants; in practice it won't.
- **Remove-set DOES NOT delete server-side.** Set removal in-store doesn't issue a DELETE. Orphans accumulate on the server row of a workout whose sets were removed mid-session. Acceptable for MVP because (a) the parent workout still shows the correct state via upserts, (b) orphans are invisible to any UI (we query by workout_id, and workouts_with_totals re-aggregates on every read). Phase 3 can add a removed-serverIds queue in the store and a DELETE step in the sync engine.
- **Discard-after-24h is client-side only.** T-204's auto-cleanup of abandoned workouts does NOT cascade to the server. If a user discards a partially-synced workout, the workouts row remains on the server as an orphan (completed_at IS NULL). Acceptable: orphans never surface in any UI, and a periodic Edge-Function sweeper can clean them up post-launch.
- **Concurrent multi-device edits: last-write-wins.** No merge logic. Two devices editing the same active workout simultaneously overwrite each other. Non-issue for MVP (single-device users).
- **Reconnect semantics.** `initSync()` (called once from `app/_layout.tsx`) subscribes to `subscribeOnline` events. Offline→online flip with a non-empty activeWorkout triggers `scheduleImmediate()`. Online→offline cancels any pending retry-backoff timer (don't burn battery on doomed attempts) and flips status to 'offline' (unless already mid-attempt — let that attempt naturally fail and set the right status).
- **Setter integration in `stores/activeWorkout.ts`.** `startWorkout`, `addSet`, `updateSet`, `removeSet`, `reorderSets` all call `scheduleSync()` AFTER the in-memory set. `completeWorkout` calls `scheduleImmediate()`. `reset`, `setWorkoutId`, `setServerIdForLocal` deliberately DO NOT trigger sync (reset is post-flush cleanup; the other two are called BY the sync engine and would cause an infinite loop).
- **Auth handling.** Sync engine gates every attempt on `supabase.auth.getUser()`. No session = status flips to 'offline' (effectively the same UX — nothing to do until auth resolves). RLS policies from T-201 guard the actual writes server-side.

### 2026-04-19 — T-201: workouts + workout_sets + personal_records schema
- Migration `20260419105008_workouts_schema.sql` adds the three Phase-2 tables, two new enums (`workout_source_t`, `pr_metric_t`), a logging-type enforcement trigger, and a totals view.
- **No copy of `logging_type` into `workout_sets`.** Single source of truth remains `exercises.logging_type`. The enforcement trigger joins on `exercises.id` (PK lookup, O(1)). Copying would create a drift risk during exercise-library updates and doubles the offline-sync write path.
- **Cross-table invariant via trigger, not CHECK.** Postgres CHECK constraints can't reference other tables. `enforce_workout_set_logging_type` runs BEFORE INSERT/UPDATE and raises descriptive exceptions when the client sends the wrong field set for an exercise's `logging_type`. Normal UX paths never hit this — it's a defence-in-depth dev-time signal.
- **No cached aggregates on `workouts`.** Volume, set count, exercise count are exposed via the view `workouts_with_totals`. Rejected alternatives: (a) materialized columns updated via triggers (offline-sync reorders writes, complexity to stay consistent), (b) MATERIALIZED VIEW with refresh schedule (over-engineered for MVP). If performance ever demands it we can promote the view to MATERIALIZED without breaking callers.
- **PR metrics shipped (4, not 5+):** `max_weight`, `max_1rm_estimated`, `max_reps` (reps_only exercises), `max_time_seconds` (time_seconds exercises). Deferred YAGNI: `max_volume` (redundant with max_weight for most users), `max_reps_at_weight` (requires fuzzy weight-bucket UX). Enum is extensible — adding a value later is a standard ALTER TYPE.
- **RLS for `workout_sets` uses workout-ownership, not a direct user_id column.** `workout_sets` has no `user_id` field; policies use `EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())`. Prevents the class of sync bug where a client could drift `user_id` away from the parent workout's owner.
- **Indexes:** `workouts(user_id, started_at desc)` for list view, `workout_sets(workout_id, set_order)` for in-workout render, `workout_sets(exercise_id, created_at desc) WHERE completed` for "last time X kg" lookups (T-210) + PR detection (T-214), `personal_records(user_id, exercise_id)` for PR lookup during logging.
- **PR auto-detection triggers are NOT in this migration** — that's T-214 scope. T-201 delivers storage + RLS + indexes only.
- Re-uses `public.handle_updated_at()` function from `20260418000000_profiles.sql` for all three tables' `updated_at` maintenance.

### 2026-04-19 — T-113-A: preferred_split promoted from text → enum
- Migration `20260419000000_preferred_split_enum.sql` creates `public.split_type_t` enum with 4 values: `'ppl', 'upper_lower', 'full_body', 'custom'`
- `profiles.preferred_split` column type promoted via `alter column … type … using (case when in (…) then ::enum else null end)` — defensive cast drops stale text rather than failing the migration
- Gated behind `information_schema.columns.data_type = 'text'` so re-running is a no-op
- RLS untouched: `profiles_update_own` is column-agnostic (`auth.uid() = id`)
- When the future `plans` table lands, `plans.split_type` re-uses this same enum — no second type needed
- Cross-field invariant `(usage_type='loose' ⇒ preferred_split IS NULL)` is enforced CLIENT-SIDE in `stores/onboardingDraft.ts#setUsageType`. Chose not to add a DB CHECK: it would harden the contract here but lock the future edit-profile flow into atomic multi-field writes, which is brittle for limited UX gain.

### 2026-04-19 — T-113: onboarding flush helper finalised
- `lib/onboarding.ts` now writes the full 5-step payload in a single atomic UPDATE
- `onboarding_completed_at` doubles as the gate signal; because UPDATE is atomic, network failure or crash leaves the gate closed — no half-flushed state
- `mapError()` covers display_name blocklist, display_name length CHECK, network/timeout/offline, and falls through to `'generic'` for enum mismatches and anything unclassified (never leaks server messages to the UI)
- `AuthProvider.refreshProfile()` is the gate revalidation hook — called after a successful flush to reopen the onboarding gate without an app reload

### 2026-04-17 — T-010: Authentication flow (magic link / email OTP)
- Created `lib/auth.ts`: signInWithEmail, verifyOtp, signOut, getCurrentSession
- Uses Supabase `signInWithOtp` (email) — sends 6-digit code, no clickable link
- Created `providers/AuthProvider.tsx`: React context with session/user/isLoading state
  - Restores session from AsyncStorage on mount
  - Listens to `onAuthStateChange` for live updates (sign in, sign out, token refresh)
  - Exposes `useAuth()` hook
- Route protection in `app/_layout.tsx` via `useProtectedRoute()` hook:
  - No session + outside `(auth)` group -> redirect to `/(auth)/login`
  - Has session + inside `(auth)` group -> redirect to `/(tabs)`
  - While `isLoading`, renders nothing (splash screen stays visible)
- Created `app/(auth)/_layout.tsx` (Stack) and `app/(auth)/login.tsx` (placeholder UI)
- Login flow: enter email -> receive OTP -> enter 6-digit code -> session established -> auto-redirect
- Added auth i18n keys to `i18n/en.json` and `i18n/nl.json`
- Deep link handling: app scheme `ronex` is configured in app.json; magic link callback will work via Supabase redirect URL config on the dashboard side

### 2026-04-17 — T-013: EAS Build configuration
- Created `eas.json` with three build profiles: development, preview, production
- `development`: dev client with iOS simulator support, `distribution: internal`
- `preview`: internal distribution for TestFlight beta testing, channel `preview`
- `production`: store distribution with auto-increment build number, channel `production`
- `cli.appVersionSource: remote` so EAS manages version numbers
- Updated `app.json`: added `owner`, `extra.eas.projectId` placeholder, `runtimeVersion` (appVersion policy), and `updates.url` for EAS Update OTA support
- Created `.easignore` to exclude `docs/`, `dashboard/`, `.claude/`, `.git/`, env files, IDE config, test artifacts from build uploads
- Submit config for iOS includes Apple ID placeholder fields (team ID and ASC app ID need to be filled in)

### 2026-04-17 — T-008: i18next with expo-localization
- Installed `i18next` 26.x, `react-i18next` 17.x, `expo-localization` 17.x
- Config in `lib/i18n.ts`: auto-detects device locale via `getLocales()`, supports `en` and `nl`, falls back to `en`
- Translation files: `i18n/en.json`, `i18n/nl.json` (minimal common keys)
- Type-safe translations via `i18n/i18next.d.ts` (autocomplete on `t('common.loading')` etc.)
- Initialized in `app/_layout.tsx` via side-effect import before any component renders
- Dutch copy is native Dutch, not literal translation

### 2026-04-17 — T-004: Supabase JS client installed and configured
- Installed `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`
- Client configured in `lib/supabase.ts` with AsyncStorage as auth storage adapter
- Auth config: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`
- Runtime validation: throws if env vars are missing (fail-fast)
- `.env.example` created for onboarding other devs

### 2026-04-17 — T-001: Expo project initialized
- Expo SDK 54 (latest stable) with tabs template
- React Native 0.81.5, React 19.1.0
- TypeScript 5.9.2, strict mode enabled
- Expo Router v6 with typed routes (`experiments.typedRoutes: true`)
- New Architecture enabled (`newArchEnabled: true`)
- iOS-first: `supportsTablet: false`, bundleIdentifier `app.ronex.ios`
- Android config preserved for later: package `app.ronex.android`
- Deep link scheme: `ronex`
- Path alias `@/*` configured in tsconfig.json

## Stack overview

```
┌─────────────────────────────────────┐
│   iPhone (React Native + Expo)     │
│   - Expo Router (navigation)        │
│   - NativeWind (Tailwind)           │
│   - i18next (NL + EN)               │
│   - Zustand (state)                 │
│   - TanStack Query (data)           │
│   - AsyncStorage (offline cache)    │
└─────────────────────────────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────────────┐
│  Supabase (Backend-as-a-Service)   │
│  - Postgres (data)                  │
│  - Auth (magic link)                │
│  - Storage (images)                 │
│  - Edge Functions (Deno):           │
│    - generate-workout               │
│    - generate-plan                  │
│    - revenuecat-webhook             │
│    - weekly-league-rollover (cron)  │
│  - RLS policies (security)          │
└─────────────────────────────────────┘
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌─────────────┐
│Claude│  │Rev.  │  │Vercel        │
│ API  │  │Cat   │  │(landing page │
│      │  │      │  │ for challenge│
│      │  │      │  │ codes)       │
└──────┘  └──────┘  └─────────────┘
```

## Key decisions

### Why Supabase?
- Postgres (real database, not key-value)
- Auth built-in
- Edge Functions without separate server
- RLS for security
- Free tier generous enough for MVP
- Scales to paid when needed

### Why React Native + Expo (not Swift)?
- Solo builder, faster iteration
- Android later for free (same codebase)
- TypeScript = familiar
- EAS Build handles iOS complexity
- Hot reload during development

### Why RevenueCat (not direct StoreKit)?
- iOS IAP is complex (receipts, webhooks, sandbox)
- RevenueCat free until $2.5k MTR
- One API across iOS + Android
- Dashboard for debugging

### Why canonical exercise DB (not free AI generation)?
- Reliable PR tracking (stable exercise_id)
- Consistent AI outputs
- Smaller prompts = cheaper AI calls
- Easier to ship

### Why offline-first logging?
- Gym reception is terrible
- Non-negotiable for core flow
- Data integrity > syncing convenience

## Data model (initial)

Core tables:

### `profiles`
User metadata, linked to auth.users
```
id (uuid, PK, = auth.users.id)
name (text)
gender (enum: male, female, other)
experience_level (enum: beginner, intermediate, advanced)
usage_type (enum: loose, plan)
bodyweight_kg (numeric, nullable)
locale (text, default 'en')
is_pro (bool, default false)
created_at (timestamp)
```

### `exercises` (canonical, seeded)
```
id (uuid, PK)
slug (text, unique)
name_en (text)
name_nl (text)
primary_muscle (enum)
secondary_muscles (enum[])
equipment (enum: barbell, dumbbell, machine, bodyweight, cable)
is_compound (bool)
```

### `workouts` (T-201, shipped)
```
id                uuid PK (default gen_random_uuid)
user_id           uuid NOT NULL → profiles(id) ON DELETE CASCADE
name              text nullable (1-80 chars)
source            workout_source_t NOT NULL default 'manual'
                    values: ai_generated | plan | manual | challenge
split_type        split_type_t nullable (re-uses T-113-A enum)
started_at        timestamptz NOT NULL default now()
completed_at      timestamptz nullable  -- null = in-progress
created_at        timestamptz NOT NULL default now()
updated_at        timestamptz NOT NULL default now()
-- plan_id / challenge_id columns deferred to Phase 5 / 7 when those tables land.
```

### `workout_sets` (T-201, shipped)
```
id               uuid PK (default gen_random_uuid)
workout_id       uuid NOT NULL → workouts(id) ON DELETE CASCADE
exercise_id      text NOT NULL → exercises(id)     -- no ON DELETE (canonical)
set_order        smallint NOT NULL (1-999)
weight_kg        numeric(6,2) nullable (0-9999)    -- enforced per logging_type
reps             smallint     nullable (1-999)     -- enforced per logging_type
seconds          smallint     nullable (1-32000)   -- enforced per logging_type
rpe              smallint     nullable (1-10)
notes            text         nullable (≤280)
completed        boolean NOT NULL default false
created_at       timestamptz NOT NULL default now()
updated_at       timestamptz NOT NULL default now()
-- NO user_id column; ownership inherited via workout_id → workouts.user_id.
-- Trigger `enforce_workout_set_logging_type` validates field-set against
-- exercises.logging_type on every INSERT/UPDATE.
```

### `personal_records` (T-201, shipped)
```
id              uuid PK (default gen_random_uuid)
user_id         uuid NOT NULL → profiles(id) ON DELETE CASCADE
exercise_id     text NOT NULL → exercises(id)
metric          pr_metric_t NOT NULL
                  values: max_weight | max_1rm_estimated | max_reps | max_time_seconds
value           numeric(8,2) NOT NULL (> 0)
workout_set_id  uuid nullable → workout_sets(id) ON DELETE SET NULL
achieved_at     timestamptz NOT NULL default now()
created_at      timestamptz NOT NULL default now()
updated_at      timestamptz NOT NULL default now()
UNIQUE (user_id, exercise_id, metric)
-- PR auto-detection lives in T-214, NOT this migration.
```

### View: `workouts_with_totals` (T-201, shipped)
Read-only aggregation view. Exposes per-workout `volume_kg`, `total_seconds`,
`set_count`, `exercise_count` computed from `workout_sets`. Inherits RLS from
underlying tables (views execute with invoker permissions).

### `plans`
```
id (uuid, PK)
user_id (uuid, FK)
frequency_per_week (int)
split_type (enum: ppl, upper_lower, full_body, custom)
focus_muscles (enum[])
injuries (text[])
weekly_schedule (jsonb) -- array of workout templates
created_at (timestamp)
```

### `challenges`
```
id (uuid, PK)
code (text, unique, 6 chars) -- ABC-123
sender_id (uuid, FK)
recipient_id (uuid, FK, nullable) -- filled on acceptance
workout_template (jsonb) -- exercises, sets, weights
sender_workout_id (uuid, FK, nullable)
recipient_workout_id (uuid, FK, nullable)
handicap_multiplier (numeric, nullable) -- applied to recipient
status (enum: pending, in_progress, completed, expired)
created_at (timestamp)
expires_at (timestamp) -- created + 7 days
completed_at (timestamp, nullable)
```

### `friendships`
```
user_id (uuid, FK)
friend_id (uuid, FK)
status (enum: pending, accepted)
created_at (timestamp)
-- composite PK (user_id, friend_id)
-- max 100 per user enforced in app logic
```

### `leagues`
```
id (uuid, PK)
tier (enum: bronze, silver, gold, platinum, diamond)
members (uuid[], max 20)
week_start (date) -- Monday
```

### `league_daily_volume`
```
user_id (uuid, FK)
league_id (uuid, FK)
date (date)
total_volume_kg (numeric)
-- composite PK (user_id, date)
```

### `league_weekly_totals`
Materialized from daily, used for promotion/degradation.

## RLS policies (critical)

Every table gets RLS enabled. Default DENY. Explicit policies per access pattern.

Example for `workouts`:
```sql
-- User can read own workouts
CREATE POLICY "users_read_own_workouts" ON workouts
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert own workouts
CREATE POLICY "users_insert_own_workouts" ON workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User can update own unfinished workouts
CREATE POLICY "users_update_own_workouts" ON workouts
  FOR UPDATE USING (auth.uid() = user_id AND completed_at IS NULL);
```

Challenge visibility is more nuanced: both sender and recipient need access post-acceptance. Landing page (public) uses a separate read-only view with limited fields.

## Edge Functions

### `generate-workout`
Input: user_id, muscle_groups[], duration_min, onboarding_context
→ Calls Claude API with structured prompt
→ Returns JSON: exercises[] with sets/reps
→ Rate-limited per user (e.g., 5 per hour for free, unlimited pro)

### `generate-plan`
Input: user_id, preferences
→ Calls Claude API with larger prompt
→ Returns JSON: weekly schedule with workout templates
→ Gated to 1 free, then pro-only

### `revenuecat-webhook`
Input: RevenueCat webhook payload (signed)
→ Verifies signature
→ Updates `profiles.is_pro` accordingly
→ Logs event

### `weekly-league-rollover` (cron)
- Runs Monday 00:00 UTC (adjust per timezone later)
- Calculates weekly totals per league
- Top 3 promote, Bottom 3 degrade
- Redistributes leagues to keep ~20/league
- Emits events for user notifications

## Frontend architecture

### State management
- **Zustand** for client state (current workout in progress, UI state)
- **TanStack Query** for server state (cached queries, optimistic updates)
- **AsyncStorage** for offline persistence

### Offline workout flow
1. User starts workout → local Zustand store
2. Every set logged → also persisted to AsyncStorage
3. Workout complete → queued for sync
4. Network available → sync to Supabase, clear queue
5. On app start → check queue, retry pending syncs

### Navigation structure
```
/app
  /(auth)
    /welcome
    /login
    /onboarding
  /(tabs)
    /home
    /workout
    /challenges
    /leaderboard
    /profile
  /workout/[id]  -- active workout
  /challenge/[code]  -- direct link handling
```

## Deployment

- **Development**: `expo start` with Expo Go on physical device
- **Internal testing**: EAS Build dev profile, install via link
- **Beta**: EAS Build preview profile → TestFlight
- **Production**: EAS Build production profile → App Store
- **OTA updates**: EAS Update for JS-only changes (no native deps)

## Environment variables

```
# .env.local (gitignored)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=

# Edge Function secrets (set via Supabase CLI)
ANTHROPIC_API_KEY=
REVENUECAT_WEBHOOK_SECRET=
```

## Security notes

- API keys never in client code (only public keys like Supabase anon)
- All Claude API calls go through Edge Functions
- RLS on every table, no exceptions
- Challenge codes expire, one-time use
- RevenueCat webhooks verified via signature
- User bodyweight is optional and private (not shown to others)

## Monitoring (later)

Not MVP, but candidates for later:
- Sentry for crash reporting
- PostHog for product analytics
- Supabase built-in query analytics

## Open architectural questions

Things to decide during building:
- [ ] Local DB: plain AsyncStorage vs WatermelonDB vs MMKV?
- [ ] Image generation for Story reveal: client-side (Skia) vs server-side (Edge Function with satori)?
- [ ] Push notifications: Expo Push vs OneSignal?
- [ ] Analytics: now vs post-launch?
