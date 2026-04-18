# T-109 — Onboarding Screen 2: experience level (Mockup Proposal)

Status: proposal, awaiting Johnny's approval before implementation.
Author: Designer
Date: 2026-04-18
Predecessor: T-108 (`docs/mockups/t-108-name-sex-proposal.md`, now shipped as `app/(onboarding)/identity.tsx`).

---

## 1. Summary

Screen 2 of 5. The user has just told us their name + biological sex; now we want their training history. The DB stores a 4-value bucket enum (`<1y` / `1-3y` / `3-5y` / `5+y`), so **I'm shipping the bucket selector (Option B), not the free numeric input (Option A)**. The core reason: the only value we ever persist is the bucket — rendering a number input that silently collapses into a bucket is a two-layer UX (type a number → watch a label interpret it) for what is structurally a 4-choice question. Four bucket rows, one tap, Continue. Matches the "5 discrete steps" mental model the progress dots already promise. I'm proposing a **skip affordance** ("Zeg ik liever niet" / stored as `null`) as a subtle text link under the Continue button — not a 5th bucket row, so it doesn't compete for visual weight with the real choices. Back-nav re-enables on this screen per the T-108 _layout.tsx plan. Route filename: **`experience.tsx`** (literal, matches the field name, stays consistent with identity.tsx's "name the concept" pattern at one word).

---

## 2. Input variant decision — **B (bucket cards)**

Rationale (3 sentences):

1. The DB persists only the bucket — a numeric input that the screen immediately maps into a bucket is an extra cognitive layer ("I said 3, it says 1-3 JAAR, am I in the right range?") for zero data-quality gain.
2. Four buckets tap cleanly into the "pick your stage" framing that matches the onboarding's archetype-discovery arc (beginner → novice → intermediate → veteran) without us having to write the word "archetype".
3. Tap-to-progress keeps screen 2 structurally identical to screens 3-5 (usage type / plan / injuries are all selection-based), which means the user learns the interaction pattern once.

Rejected: **Option A (free int-input + live-mapping label).** It reads like a quiz. And the moment a user types `2.5` we have to decide whether to round, reject, or show a second helper message — every one of which is a worse UX than "pick a range".

Rejected: **Option C (hybrid).** Over-engineered for 4 buckets, as the task notes already flag.

---

## 3. Screen layout sketch

iPhone 15 Pro, 393×852, dark theme:

```
 +---------------------------------------+
 | SafeArea top                          |
 |                                       |
 | [‹]  [•][•][•][ ][ ]   STAP 2 VAN 5   |  <- back chevron (left),
 |                                       |     progress (center-ish),
 |                                       |     small-caps label (right)
 |                                       |
 |  Hoe lang train je al?                |  <- display-lg, mt-8
 |                                       |     (placeholder — Copy T-114)
 |  Geen exact aantal nodig.             |  <- small-caps-helper, mt-2
 |                                       |     (placeholder — Copy T-114)
 |                                       |
 |                                       |
 |  +---------------------------------+  |
 |  |  <1 JAAR                        |  |  <- bucket row, h-16, unselected
 |  +---------------------------------+  |
 |                                       |
 |  +---------------------------------+  |
 |  |  1-3 JAAR                       |  |  <- bucket row, h-16, unselected
 |  +---------------------------------+  |
 |                                       |
 |  +---------------------------------+  |
 |  |  3-5 JAAR                       |  |  <- bucket row, h-16, SELECTED
 |  |                                 |  |     border-primary 2px
 |  +---------------------------------+  |
 |                                       |
 |  +---------------------------------+  |
 |  |  5+ JAAR                        |  |  <- bucket row, h-16, unselected
 |  +---------------------------------+  |
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |  +---------------------------------+  |
 |  |          Verder                 |  |  <- primary CTA, thumb zone,
 |  +---------------------------------+  |     same animated enable as identity
 |                                       |
 |          Zeg ik liever niet           |  <- subtle skip link, small-caps,
 |                                       |     centered, mt-3
 | SafeArea bottom                       |
 +---------------------------------------+
```

Notes on sketch:
- Back chevron returns (header slot that was empty on screen 1).
- Bucket rows are **full-width stacked cards**, not a 2×2 grid. Reasons: (a) single-column scales cleanly to longer NL strings, (b) the four buckets are ordinal (less → more experience), and a vertical list preserves that reading order, (c) tap targets get more width.
- Gap between bucket rows is `gap-3` (12px) — same rhythm as the sex-pill row on identity, just stacked.
- Skip link sits below the CTA, not above it. Anchored to the bottom of the screen, intentionally less prominent than Continue. Not hidden — discoverable, just quieter.

---

## 4. Per-element spec

| Element | Typography | Color token | Spacing / size |
|---|---|---|---|
| Screen background | — | `bg-background` | full screen |
| Back chevron (Pressable) | icon only (ionicons `chevron-back` or equivalent, 24pt) | icon `text-content-secondary`, no bg | `h-10 w-10 ml-2`, hit-slop to 44pt |
| Progress dots | — | filled: `bg-primary`, empty: `bg-surface-elevated` | reuse `<OnboardingProgress step={2} total={5} />` as-is |
| Step label "STAP 2 VAN 5" | `text-small-caps uppercase` | `text-content-muted` | delivered by OnboardingProgress component |
| Title | `text-display-lg` | `text-content` | `mt-8 px-6` |
| Subtitle | `text-small-caps` + `style={{ textTransform: 'none' }}` (small-caps-helper variant) | `text-content-muted` | `mt-2 px-6`, single line |
| Bucket row (unselected) | `text-small-caps uppercase` | bg `bg-surface`, border `border-surface-elevated` (1px), text `text-content-secondary` | `h-16 rounded-input px-5`, justify-start, full-width within `px-6`, `mt-3` between rows |
| Bucket row (selected) | `text-small-caps uppercase` | bg `bg-surface`, border `border-primary` (2px), text `text-content` | same dimensions, border-width 1→2 on select |
| Primary CTA "Verder" | `text-body font-inter-semibold`, animated color transition (reuse identity.tsx pattern) | enabled bg `bg-primary` + text `text-background`; disabled bg `bg-surface-elevated` + text `text-content-muted` | `h-14 rounded-button`, full-width, `px-6` |
| Skip link "Zeg ik liever niet" | `text-small-caps uppercase` | `text-content-muted` | `mt-3 pb-4`, self-center, hit-slop to 44pt, no border |

### Typography rule-5 check

Three levels only: `display-lg` (title), `body` (CTA label), `small-caps` (step label, subtitle helper, bucket labels, skip link).

**Note on bucket labels:** I'm using `small-caps uppercase` for the bucket labels, not `body`. Rationale: the buckets are labels/taxonomies ("<1 YEAR") not prose ("You've been training for under a year"). Small-caps sizing at 12/16 with 1.5px tracking inside a 64pt-tall card reads as confident and quiet — body size would feel chatty, and display-lg would be theatrical for a 4-option list. This matches the "labels, metadata, timestamps" purpose documented in `design-system.md`.

If Johnny prefers heavier presence on the bucket text, fallback is `text-body font-inter-semibold` at normal case. Flagging as open question 2.

---

## 5. Bucket label copy direction (for Copy T-114)

**Proposed direction: pure range labels (short, scannable).**

Placeholders to reserve keys for — Copy writes the real strings in T-114:

| Key | NL placeholder | EN placeholder |
|---|---|---|
| `onboarding.experienceBucketLt1y` | `<1 JAAR` | `<1 YEAR` |
| `onboarding.experienceBucket1to3y` | `1-3 JAAR` | `1-3 YEARS` |
| `onboarding.experienceBucket3to5y` | `3-5 JAAR` | `3-5 YEARS` |
| `onboarding.experienceBucketGte5y` | `5+ JAAR` | `5+ YEARS` |

Considered and rejected:

- **Range + archetype tag** (`<1 JAAR • BEGINNER`, `5+ JAAR • VETERAAN`): flattering-or-judgemental labels are exactly the tone trap Ronex avoids. "Beginner" reads condescending, "Veteran" reads grandiose. Skip.
- **Full sentences** (`Je bent nieuw`, `Je coacht anderen`): projects an identity the user hasn't claimed. "Je coacht anderen" is factually wrong for a 5+ year solo lifter. Skip.

Copy T-114 may refine — the keys and structure are what matters at mockup stage.

---

## 6. Skip-option decision — **yes, include it**

Rendered as a subtle text link below the Continue button, centered, `text-small-caps uppercase text-content-muted`. Placeholder copy `Zeg ik liever niet` / `Prefer not to say`.

Rationale:
- Task notes explicitly allow `null` as a valid bucket value (`0 or null → null`). The data model supports skip; the UI should too.
- Not rendering skip would force a user who genuinely doesn't want to disclose their experience to lie (pick any bucket to proceed). Lying corrupts the data more than `null` does.
- Skip is placed **below** Continue, not above and not as a 5th bucket row. That hierarchy signals: "picking is the expected path; skip exists for when you need it".
- Tap on skip → set `experienceBucket: null` in the draft store → navigate to screen 3.

Rejected alternative: treating skip as a 5th row (`ZEG IK LIEVER NIET`) in the bucket list. This gives skip equal visual weight to the real answers and nudges users toward the easy-out. Bad for data quality.

---

## 7. Validation + Continue flow

### Selection logic

- Bucket row tap toggles into the selected state. Tapping the currently-selected row is a no-op (no deselect-into-null — skip link handles null).
- Haptic on bucket tap: `Haptics.selectionAsync()` — matches identity.tsx's sex-pill pattern.
- Selection state held in local `useState<ExperienceBucket>(stored)` mirroring the draft store, committed to the store on Continue (same write-on-continue pattern identity.tsx established).

### Continue button enabled when

```
experienceBucket !== null
  AND !submitting
```

(The skip link has its own tap handler and is always enabled — it doesn't go through the Continue-enabled gate.)

### Animated enable transition

Reuse identity.tsx's `interpolateColor` shared-value pattern (200ms ease-out, surface-elevated → primary fill; content-muted → background text). Same constants, same easing. **Extract this into a small hook if T-110 confirms it'll repeat a 3rd time** — for T-109 I'll inline-copy and flag the refactor, not build infra speculatively.

### Submit flow

1. User taps Continue → `Haptics.selectionAsync()`.
2. `setExperienceBucket(selectedBucket)` writes to the draft store.
3. `router.push('/(onboarding)/usage-type')` (T-110's route — placeholder; if T-110 picks a different filename, update at T-110 time).

### Skip flow

1. User taps "Zeg ik liever niet" → `Haptics.selectionAsync()`.
2. `setExperienceBucket(null)` writes to the draft store.
3. Same `router.push` to screen 3.

No Toasts, no error states. Client-side bucket selection cannot fail.

---

## 8. Back-nav behavior

- **Back chevron top-left** in the header area, left of the progress dots. Tap → `router.back()` → returns to `identity.tsx`.
- **Swipe-back gesture enabled.** In `app/(onboarding)/_layout.tsx`, add a `Stack.Screen name="experience"` entry with default `gestureEnabled: true` (no explicit override needed since `gestureEnabled: false` was a per-screen override on `identity`).
- The identity.tsx screen already reads stored values from the draft store on mount, so returning to it shows the user's prior name + sex intact. No extra work on their end.
- Returning forward (user goes back to screen 1, then Continue again) re-mounts experience.tsx with the previously-selected bucket still in local state via `useOnboardingDraft((s) => s.experienceBucket)` on init — same pattern identity.tsx uses for name/sex. User's partial progress survives round-trips.

Header slot layout with back chevron added:

```
 [‹]  [•][•][•][ ][ ]              STAP 2 VAN 5
  ^back chevron, h-10 w-10, ml-2
      ^progress dots moved from ml-6 to reduce space
                                   ^step label unchanged
```

**Component change required:** `OnboardingProgress` currently assumes it owns the full header row. On screens 2-5 the back chevron needs to coexist. Cleanest fix: wrap the back chevron + `<OnboardingProgress>` in a parent flex-row in the screen file, and adjust `OnboardingProgress`'s root margin from `ml-6` to `ml-2` when a leading element is present. Two options here:

- **Option H1**: Keep `OnboardingProgress` simple, render back chevron as a sibling in each of screens 2-5 (small repetition).
- **Option H2**: Add an optional `leading?: ReactNode` prop to `OnboardingProgress` that renders it inside the header row and handles the spacing.

I'd lean **H2** (DRY, single header-slot component), but it's a minor refactor of a T-108 component. **Flagging as open question 1.**

---

## 9. Route filename + path

**Proposed: `app/(onboarding)/experience.tsx`**

Considered:

| Filename | For | Against |
|---|---|---|
| **`experience.tsx`** ✅ | Literal, matches the DB column name (`experience_bucket` → `experience`), one word like `identity.tsx`. | Slightly generic in isolation, but the `(onboarding)` group prefix disambiguates it. |
| **`training-history.tsx`** | Descriptive. | Two words, kebab-case in file, breaks the one-word rhythm identity.tsx set. |
| **`level.tsx`** | Shortest. | "Level" evokes game mechanics (beginner/intermediate/expert). We explicitly rejected that framing in §5 — shouldn't encode it in the filename. |
| **`years.tsx`** | Shortest + literal. | Encodes "we measure in years", but actual DB field is `experience_bucket` — filename drifts from schema. |

Verdict: **`experience.tsx`**. Matches schema, one word, stays consistent with `identity.tsx`.

---

## 10. i18n keys needed (Copy T-114 writes strings)

Under `onboarding` namespace:

- `onboarding.experienceTitle` — screen title (placeholder: "Hoe lang train je al?" / "How long have you been training?").
- `onboarding.experienceSubtitle` — small-caps-helper subtitle (placeholder: "Geen exact aantal nodig." / "No exact count needed.").
- `onboarding.experienceBucketLt1y` — bucket label (placeholder: `<1 JAAR` / `<1 YEAR`).
- `onboarding.experienceBucket1to3y` — bucket label (placeholder: `1-3 JAAR` / `1-3 YEARS`).
- `onboarding.experienceBucket3to5y` — bucket label (placeholder: `3-5 JAAR` / `3-5 YEARS`).
- `onboarding.experienceBucketGte5y` — bucket label (placeholder: `5+ JAAR` / `5+ YEARS`).
- `onboarding.experienceSkip` — skip link label (placeholder: "Zeg ik liever niet" / "Prefer not to say").

Existing keys reused (no new work):

- `onboarding.progressLabel` (already exists from T-108, interpolates `current` / `total`).
- `common.continue`.
- `common.back` (accessibility label for the chevron).

No stale keys identified.

---

## 11. `onboardingDraft` store changes

**Good news: nothing new required.** T-108 already wired the full store per §2 of the identity proposal. Current state (verified via `stores/onboardingDraft.ts` read):

- `ExperienceBucket` type alias exported: `'<1y' | '1-3y' | '3-5y' | '5+y' | null` ✅
- `experienceBucket` field in state, initialized to `null` via `EMPTY_DRAFT` ✅
- `setExperienceBucket: (bucket: ExperienceBucket) => void` setter defined ✅
- Persistence via zustand `persist` middleware + AsyncStorage ✅

This screen just consumes the existing setter. Zero store changes.

---

## 12. Files I'll touch when implementing (exact absolute paths)

### Create

- `C:\Projects\ronex\app\(onboarding)\experience.tsx` — the screen. Structure mirrors `identity.tsx`: SafeArea + KeyboardAvoidingView (no keyboard needed here, but kept for consistency and future-proofing against toast overlays) + header slot (back chevron + progress) + bucket list + bottom CTA + skip link.
- `C:\Projects\ronex\components\onboarding\ExperienceBucketRow.tsx` — small presentational component for a single bucket row. Props: `bucket: Exclude<ExperienceBucket, null>`, `label: string`, `selected: boolean`, `onSelect: (b) => void`. Kept out of the screen file for readability; same pattern as the inline `SexPill` in identity.tsx but extracted because 4 instances vs 2 and it may be referenced by T-115 (minimal onboarding) later.

### Edit

- `C:\Projects\ronex\app\(onboarding)\_layout.tsx` — add `<Stack.Screen name="experience" />` entry (inherits default `gestureEnabled: true`). Update the JSDoc block to mention screens 2+ opt back into gestures, which is already described but not yet configured.
- `C:\Projects\ronex\components\onboarding\OnboardingProgress.tsx` — **if open question 1 resolves to H2**: add optional `leading?: ReactNode` prop for back-chevron slotting. If H1: untouched.
- `C:\Projects\ronex\i18n\nl.json` — add 7 new keys from §10 with Dutch placeholders. Copy T-114 rewrites them.
- `C:\Projects\ronex\i18n\en.json` — same, English placeholders.
- `C:\Projects\ronex\app\(onboarding)\identity.tsx` — change the temporary `router.replace('/(tabs)')` (currently a TODO placeholder from T-108 per code comment line 173-176) to `router.push('/(onboarding)/experience')`. This is a direct unblock — identity.tsx currently exits onboarding early, which is the right call when screen 2 doesn't exist but the wrong call once it does.

### Not touched (explicit exclusions)

- `stores/onboardingDraft.ts` — already complete from T-108.
- `lib/theme.ts` — no new tokens.
- `tailwind.config.js` — no new classes.
- `package.json` — no new deps.
- `docs/design-system.md` — no new token/variant precedents. `small-caps-helper` (used for the subtitle here) was already documented in T-108.
- `app/(auth)/*` — untouched.
- `providers/AuthProvider.tsx` — routing gate is T-113 scope.

---

## 13. Open questions for Johnny (max 3)

1. **Header layout for screens 2-5: extend `OnboardingProgress` or compose at call-site?** Currently `OnboardingProgress` is a single full-width header row. Screens 2-5 need a back chevron to its left. **Option H1**: leave the component alone, place the chevron as a sibling in each screen and manually tune spacing — more repetition across 4 screens but keeps the component single-purpose. **Option H2**: add a `leading?: ReactNode` prop so the component owns the whole header row — DRY but slightly widens the component's contract. My preference is H2. Your call.

2. **Bucket label typography: small-caps or body?** Proposing `text-small-caps uppercase` (§4) because the buckets are labels/ranges, not prose, and small-caps-in-a-card reads quiet and confident. Alternative is `text-body font-inter-semibold` at normal case, which would feel closer to the sex-pill treatment on screen 1 and project more "these are answers, not tags". Either is defensible — your taste call. (Screen 1's sex pills used body+semibold, so body would be visually consistent across the two screens; small-caps differentiates the "pick a bucket" moment from the "pick a choice" moment.)

3. **Skip-link copy tone: neutral vs opt-out vs suppressed.** I'm proposing `Zeg ik liever niet` / `Prefer not to say` (placeholder — Copy T-114 refines). Two alternatives worth weighing now since they change information architecture, not just words: **(a)** a softer "Weet ik niet precies" / "Not sure" framing that signals "I don't know" rather than "I'm refusing to tell you" (more honest for users who genuinely don't remember when they started); **(b)** no skip link at all — force a bucket pick, trusting that "<1 JAAR" is a legitimate catch-all for "new or unsure". Your call on tone direction so Copy doesn't have to guess.

Everything else is treated as approved-by-default:

- Bucket list over numeric input (Option B).
- 4 full-width stacked rows, no grid.
- Route filename `experience.tsx`.
- Skip exists, placed below CTA, subtle.
- Back chevron + swipe-back enabled.
- No new store setters, no new typography tokens, no new deps.

---

## Appendix — what this proposal does NOT cover

- Actual NL/EN strings — Copy T-114.
- T-110 screen (usage-type) — separate mockup.
- Final submit / flush to Supabase — T-113.
- Minimal onboarding for challenge invitees — T-115 (may reuse `ExperienceBucketRow` component — flagged above).
- Back-nav gesture config on T-111/T-112 — those tasks' mockups.
