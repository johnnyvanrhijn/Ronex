# T-108 — Onboarding Screen 1: display_name + biological_sex (Mockup Proposal)

Status: proposal, awaiting Johnny's approval before implementation.
Author: Designer
Date: 2026-04-18

---

## 1. Summary

First onboarding screen after `verify` for new users. Two fields: `display_name` (text, 1-40 chars) and `biological_sex` (male/female enum). My proposal keeps them **on one screen** — they're both "who you are" identity fields, they're low-friction, splitting them into two screens creates fake progress and burns one of our 5 precious slots. The `biological_sex` selector is a **two-up segmented pill row** (Man / Vrouw), not a native picker — the value set is closed and binary-enum at the DB level, a wheel picker would be overkill for two options. The privacy framing ("for challenge fairness, never shared") lives as a **persistent small-caps helper line directly under the sex selector label** — inline, calm, not a tooltip the user has to discover. Progress indicator: **yes, a 5-dot pill-bar** at the top. I want the user to feel the road is short. Back navigation during onboarding is **disabled from screen 1** (you can't go back to verify after magic-link success — that's a dead session). Route structure: new `app/(onboarding)/` group with a per-step file, matching the `(auth)` / `(tabs)` pattern already in the tree.

---

## 2. Screen layout sketch

iPhone 15 Pro, 393×852, dark theme:

```
 +---------------------------------------+
 | SafeArea top                          |
 |                                       |
 |  [•][•][ ][ ][ ]    STAP 1 VAN 5      |  <- progress dots (left) +
 |                                       |     small-caps label (right),
 |                                       |     px-6, mt-2
 |                                       |
 |  Wie ben je?                          |  <- display-lg, mt-8
 |                                       |     (placeholder — Copy T-114)
 |  Twee dingen, dan door.               |  <- body/secondary, mt-2
 |                                       |     (placeholder — Copy T-114)
 |                                       |
 |                                       |
 |  NAAM                                 |  <- small-caps label
 |  +---------------------------------+  |
 |  |  Johnny                         |  |  <- TextInput h-14
 |  +---------------------------------+  |     body/semibold, border
 |  3/40                                 |  <- small-caps counter, muted,
 |                                       |     right-aligned under input
 |                                       |
 |  BIOLOGISCH GESLACHT                  |  <- small-caps label
 |  +---------------+  +---------------+ |
 |  |     Man       |  |     Vrouw     | |  <- segmented pills
 |  | (unselected)  |  | (selected)    | |     h-14 each, 50/50 split
 |  +---------------+  +---------------+ |
 |                                       |
 |  Gebruikt voor eerlijke challenges.   |  <- small-caps, content-muted,
 |  Nooit zichtbaar voor anderen.        |     2 lines, mt-2
 |                                       |     (placeholder — Copy T-114)
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |  +---------------------------------+  |
 |  |          Verder                 |  |  <- primary CTA, thumb zone,
 |  +---------------------------------+  |     animated enable like
 |                                       |     enter-code.tsx
 | SafeArea bottom                       |
 +---------------------------------------+
```

Notes on sketch:
- No back chevron in the header. Deliberate.
- Progress dots sit in the space the back-chevron would normally occupy. They claim the header as "you are making progress", not "you can retreat".
- Spacing between the two field groups is larger than standard (mt-8 vs mt-6) so the eye groups NAME with NAME-input-and-counter, and BIOLOGICAL SEX with selector-and-privacy-line.

---

## 3. Per-element spec

| Element | Typography | Color token | Spacing / size |
|---|---|---|---|
| Screen background | — | `bg-background` (#0A0A0A) | full screen |
| Progress dots (5) | — | active: `bg-primary`, inactive: `bg-surface-elevated` | each `h-1.5 w-1.5` rounded-full, gap-1, `mt-2 ml-6` |
| Step label "STAP 1 VAN 5" | `text-small-caps uppercase` | `text-content-muted` | right-aligned, `mr-6`, vertically centered with dots |
| Title | `text-display-lg` | `text-content` | `mt-8 px-6` |
| Subtitle | `text-body` | `text-content-secondary` | `mt-2 px-6`, max-width natural |
| Field label "NAAM" | `text-small-caps uppercase` | `text-content-secondary` | `mt-10 px-6 mb-2` |
| Name input | `text-body font-inter-semibold` | bg `bg-surface`, border `border-surface-elevated`, focused `border-primary` | `h-14 rounded-input px-4`, full-width within `px-6` |
| Character counter `{n}/40` | `text-small-caps` (no uppercase — digits are neutral) | `text-content-muted`; turns `text-danger` when n > 40 or on blocklist error | `mt-1 px-6`, self-end (right) |
| Field label "BIOLOGISCH GESLACHT" | `text-small-caps uppercase` | `text-content-secondary` | `mt-8 px-6 mb-2` |
| Sex pill (unselected) | `text-body font-inter-semibold` | bg `bg-surface`, border `border-surface-elevated`, text `text-content-secondary` | `h-14 rounded-input`, flex-1, gap-3 between pills, within `px-6` container |
| Sex pill (selected) | `text-body font-inter-semibold` | bg `bg-surface`, border `border-primary` (2px), text `text-content` | same dimensions, border-width shifts 1→2 on select |
| Privacy helper line | `text-small-caps` (no uppercase — this is explanatory body-as-small-caps for calm density) | `text-content-muted` | `mt-2 px-6`, two lines, `leading-4` |
| Primary CTA "Verder" | `text-body font-inter-semibold`, animated color transition (mirror `enter-code.tsx`) | enabled bg `bg-primary` + text `text-background`; disabled bg `bg-surface-elevated` + text `text-content-muted` | `h-14 rounded-button`, full-width, `px-6 pb-4` |

### Typography rule-5 check

Three levels only: `display-lg` (title), `body` (subtitle, input value, pill labels, CTA label), `small-caps` (step label, field labels, counter, privacy helper). Clean. No new tokens.

**Note on using small-caps for the privacy helper WITHOUT uppercase:** this is new territory. The existing small-caps spec mandates `uppercase`. I'm proposing a non-uppercased small-caps usage here — same size/weight/tracking, just sentence-case — because uppercasing a 2-line explanatory sentence reads as SHOUTING (tone violation). **Flagging as open question 3.** If rejected, fallback is `text-body text-content-muted` with reduced opacity, which still reads calm but costs more vertical space.

---

## 4. biological_sex input variant — justification

Considered four patterns; shipping with segmented pills.

| Variant | Pros | Cons | Verdict |
|---|---|---|---|
| **iOS native picker (wheel)** | Platform-native, familiar | Overkill for 2 options. Wheel feels like many-item selection. Hidden until tap. Adds a modal step. | ❌ |
| **Radio buttons vertical** | Clear semantics | Web-form look. Small tap targets. Consumes vertical space we need for the privacy line. | ❌ |
| **Icon tiles (♂ / ♀ glyphs)** | Visually distinctive | Gendered symbol icons skew clinical; on a privacy-sensitive field they feel like a medical form. Mars/Venus also carry social/political connotations I don't want on screen 1. | ❌ |
| **Segmented pills (text only)** | Mutually exclusive signalling clear, thumb-sized tap targets (h-14, ~186pt wide each), matches Ronex's minimalist language, localizes cleanly (NL "Man"/"Vrouw" vs EN "Male"/"Female" — both fit on one line) | Slightly less "native iOS" than a segmented control, but we're already not using UIKit segmented controls anywhere | ✅ |

**Why not iOS `SegmentedControl` component?** It's not in the current stack (we're on NativeWind primitives, no UIKit wrapping) and its default look ties us to Apple's visual language at a moment we want to feel like Ronex, not iOS-default. The pill treatment we already use elsewhere (enter-code active state, primary CTA) carries the brand.

**Selected-state signalling:** the selected pill gets a 2px `border-primary` (lime). I explicitly reject "fill the selected pill with lime and put black text on it" — lime is reserved for **action** (PR moments, primary CTA, success). Using it as a fill for "I am a man" would overclaim the emotional weight of the choice. Lime border says "selected", lime fill would say "victory".

**Haptic:** `Haptics.selectionAsync()` on each tap. Same pattern as enter-code.

**Default state:** neither selected. Continue disabled until both name (len ≥ 1 post-trim) and sex are set.

---

## 5. Privacy framing — placement + placeholder copy

**Placement:** directly below the biological_sex pill row, as a persistent `text-small-caps text-content-muted` two-line helper. NOT a tooltip, NOT a `?`-icon-modal, NOT a collapsible accordion.

**Rationale:**
- **Tooltip/icon** = user has to discover it. If the product spec says "must explicitly explain", it has to be visible by default.
- **Modal** = interrupts flow, overweights the message.
- **Accordion** = same discovery problem as tooltip.
- **Inline persistent text** = always readable, no interaction required, tone-appropriate (we don't shout "PRIVACY!!" we calmly state the fact).

**Why below the selector, not under the screen title:** the justification must sit next to the thing being justified. Under the title it would read as "we care about privacy (generally)"; under the selector it reads as "we need this specifically, here's why".

**Placeholder copy (for Copy T-114, do not ship these literally):**

Line 1 (purpose): *Gebruikt voor eerlijke challenges.* / *Used to keep challenges fair.*
Line 2 (privacy guarantee): *Nooit zichtbaar voor anderen.* / *Never shown to other users.*

Two short lines, not one long sentence. Reason: the purpose (fairness) and the guarantee (privacy) are two claims that deserve independent visual weight. Copy will refine actual text in T-114; i18n keys to reserve below.

---

## 6. Progress indicator — decision + sketch

**Decision: yes, show it. 5 dots, left-aligned, with a small-caps "STAP 1 VAN 5" label on the right.**

### Options I weighed

| Option | For | Against |
|---|---|---|
| **No indicator, momentum only** | Cleanest. Matches welcome/enter-code minimal header. | Onboarding is 5 screens. Without a forecast the user thinks "how many of these are there" at screen 2 and bails. |
| **"1/5" text only** | Minimal. | Text-only undersells progress emotionally — no visual fill. |
| **Thin progress bar** | Shows fractional progress if screens had sub-steps. | We don't have sub-steps. 5 discrete screens = 5 discrete dots map 1:1 to mental model. A bar implies "continuous completion" which it isn't. |
| **5 dots (filled = done, empty = remaining)** ✅ | Countable, visible, small footprint, matches screen-1-of-N mental model, feels designed not templated. | Slightly more build cost than text. Worth it. |
| **5 dots + small-caps "STAP 1 VAN 5"** ✅ | Dots carry the visual; label carries the exact count for accessibility and low-vision users. Belt-and-suspenders. | None meaningful. |

### Sketch

```
  •  •  ○  ○  ○                  STAP 1 VAN 5
 ^primary  ^surface-elevated     ^small-caps, right-aligned
```

- Dots: 6px diameter, gap 4px, 2 filled + 3 hollow at screen 1.
- Filled = `bg-primary` (active + done).
- Empty = `bg-surface-elevated`.
- Yes, I'm deliberately filling BOTH dot 1 (current) AND the "done" dots — on screen 1 only dot 1 is filled. Each subsequent screen fills one more dot. By screen 5 all 5 are lime.
- Label lives on the same horizontal baseline as the dots, right-aligned at `mr-6`. It is the ONLY small-caps element in the header, it quietly claims that slot.

### Accessibility

- Dots are decorative (`accessibilityElementsHidden` on the dot row).
- Label `STAP 1 VAN 5` is `accessibilityLabel` via i18n with `{current}` / `{total}` interpolation, readable by VoiceOver.

### Downstream (T-109..T-112)

Designer on T-109/110/111/112 imports a shared `<OnboardingProgress step={n} total={5} />` component instead of re-laying out. **I'll build this component as part of T-108 implementation** so later screens just consume it. Lives at `components/onboarding/OnboardingProgress.tsx`.

---

## 7. Validation flow

### display_name (client-side)

```
user types
  |
  v
trim leading/trailing whitespace (on blur, not on keystroke — blur avoids thrash)
  |
  v
length check
  /          \
len == 0      len >= 1 AND len <= 40     len > 40
  |              |                           |
  v              v                           v
Continue       Continue enabled       maxLength prop on TextInput
disabled       + character counter     caps at 40; user physically
(neutral       normal color            cannot exceed. Counter shows
state, no                              "40/40" in content-secondary.
error shown)                           No error state for this — it's
                                        hard-capped.
```

- **Whitespace handling:** trim on blur and on submit. Don't strip while typing (breaks "John  Smith" typed with a pause).
- **maxLength** on `TextInput` = 40. Hard ceiling.
- **Character counter** `{n}/40` always visible, `text-content-muted` default, flips to `text-danger` only on server rejection (see blocklist below).
- **No inline error text** for length. The counter IS the feedback.

### biological_sex

- Pill-tap toggles between male and female (cannot deselect into null — once picked, one is always active; user can switch).
- State stored as `'male' | 'female' | null` in local state; starts null; remains null until first tap.

### Continue button enabled when

```
displayName.trim().length >= 1
  AND displayName.trim().length <= 40
  AND biologicalSex !== null
  AND !submitting
```

Same animated enable transition as `enter-code.tsx` (200ms ease-out, lime fill fade).

### Submit flow

1. User taps Continue → `Haptics.selectionAsync()`.
2. Optimistic local-state save (route to next onboarding screen). **Wait** — actually, T-113 is the backend save task. For T-108 scope, the next-screen navigation belongs to the designer too. I'll write it to save to a local onboarding-draft store (zustand) which T-113 will later read + flush to Supabase at the final screen. **Flagging in open questions.**
3. On save failure (T-113 scope, but designer has to handle the response):
   - **Blocklist error** (server-side trigger rejects profane display_name): generic message `t('onboarding.nameNotAvailable')` shown as a Toast (reuse `components/Toast.tsx` from T-106). Counter turns `text-danger`. Input stays filled so user can edit. Continue re-enables as soon as user types again.
   - **Length error** (defensive — shouldn't happen given client-side cap): same Toast, same color flip.
   - **Network error:** generic `t('errors.networkError')` Toast. Form state preserved.
4. On success → `router.push('/(onboarding)/experience')` (or whatever T-109 names it).

### Error copy placeholders (for Copy T-114)

- Blocklist: `onboarding.nameNotAvailable` — neutral, no detail ("Deze naam kan niet gebruikt worden. Kies een andere." / "That name isn't available. Try another.").
- Per T-114 notes, the DB returns a generic error — we already don't know why it was blocked. Client must not leak `banned_display_names` existence.

---

## 8. Back navigation — decision + routing structure

### Back-nav decision

**No back button on screen 1.** Reasons:

- Verify OTP is a one-shot consumed token. Going back to `verify` after a successful magic-link-OTP exchange leads to a broken state (the OTP is burned, re-entering it fails). Per `verify.tsx` line 108 the user gets kicked if the code is wrong — if we send them back there the only option is "resend" which re-triggers the whole email flow.
- The user has already **authenticated**. Sending them to `welcome` is even worse — they'd see "I want to train" / "I have a code" as if they hadn't just logged in.
- Verify's existing "Try different email" link already covers the "I want to start over" escape hatch, at the step where it's meaningful.

**On screens 2-5 (T-109..T-112)**, back IS allowed — between onboarding steps you can reconsider "oh wait I'm actually 5+ years not 3-5". The `_layout.tsx` for the onboarding group will:
- Disable the swipe-back gesture AND hide the native header for screen 1.
- Allow both for screens 2-5 (chevron-back in header on those).

### Route structure proposal

**Proposal: dedicated `app/(onboarding)/` group with per-step files.**

```
app/
  (auth)/
    _layout.tsx
    welcome.tsx
    login.tsx
    verify.tsx
    enter-code.tsx
  (onboarding)/               <- NEW group
    _layout.tsx               <- Stack, headerShown:false, gesture disabled on [0]
    name-sex.tsx              <- T-108 (this one)
    experience.tsx            <- T-109
    usage-type.tsx            <- T-110
    plan-preferences.tsx      <- T-111 (conditional)
    injuries.tsx              <- T-112
  (tabs)/
    ...
```

### Alternatives considered

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **Flat `app/onboarding/name.tsx`, `app/onboarding/experience.tsx`, ...** | Slightly less nesting | No group-wide layout — can't apply a shared stack options config, each file reinvents the header. | ❌ |
| **Dynamic `app/onboarding/[step].tsx`** | One file, minimal scaffolding | Each step's UI is so different (text input vs bucket pills vs multi-select checkboxes) that a single dynamic file becomes a switch statement with 5 sub-components. We lose Expo Router's real strength: one file, one screen, clear imports. | ❌ |
| **Single-screen scroll wizard** (`app/onboarding.tsx` containing all 5 steps in a ScrollView/PagerView) | Native-feeling horizontal paging, no route transitions | Breaks conditional step logic (T-111 only if plan chosen in T-110), can't deep-link to specific step for resume, doesn't map to separate task IDs. | ❌ |
| **Onboarding group** ✅ | Mirrors existing `(auth)` / `(tabs)` convention, each file = each task = each PR, shared `_layout.tsx` for stack options, easy per-screen testing, supports conditional routing (skip `plan-preferences.tsx` when usage-type is loose). | Slight overhead of one extra folder. Negligible. | ✅ |

### Route gate (T-113 backend scope, noted for awareness)

- After verify success, AuthProvider (or a new OnboardingGuard) checks `profiles.onboarding_completed_at`.
  - If `null` AND user has no challenge context → push to `/(onboarding)/name-sex`.
  - If `null` AND user entered via challenge code (T-115 minimal path) → push to `/(onboarding)/name-sex` with a `minimal=true` query (T-115 may fork to its own abbreviated route — Designer T-115 decides).
  - If non-null → push to `/(tabs)`.
- **Designer does NOT wire this gate in T-108.** I'll build the screen assuming it's reachable at `/(onboarding)/name-sex` and T-113 owns the redirect logic.

### File name choice

`name-sex.tsx` is ugly. Alternatives I considered: `identity.tsx`, `you.tsx`, `step-1.tsx`, `profile-basics.tsx`. I like `identity.tsx`. **Flagging as open question.** If you want something else, tell me and I'll rename before building.

---

## 9. i18n keys needed (list for Copy T-114 — do not write strings now)

Under `onboarding` namespace:

- `onboarding.progressLabel` — the "Step 1 of 5" label with `{{current}}` and `{{total}}` interpolation. Used across T-108..T-112.
- `onboarding.identityTitle` — screen title (placeholder: "Wie ben je?" / "Who are you?").
- `onboarding.identitySubtitle` — short subtitle under title.
- `onboarding.nameLabel` — small-caps field label (placeholder: "NAAM" / "NAME"). Note: "NAAM" is NL, "NAME" is EN — same casing, different word, so this DOES need i18n even though enter-code's "CODE" was identical in both.
- `onboarding.namePlaceholder` — TextInput placeholder (low opacity, e.g. "Voornaam" / "First name").
- `onboarding.sexLabel` — small-caps field label (placeholder: "BIOLOGISCH GESLACHT" / "BIOLOGICAL SEX").
- `onboarding.sexMale` — pill label (placeholder: "Man" / "Male").
- `onboarding.sexFemale` — pill label (placeholder: "Vrouw" / "Female").
- `onboarding.sexPrivacyLine1` — privacy purpose line (fairness).
- `onboarding.sexPrivacyLine2` — privacy guarantee line (never shared).
- `onboarding.nameNotAvailable` — generic blocklist-rejection Toast message.

Under `common`:

- `common.continue` — already exists. Reuse.

### Existing keys to reuse (no new work)

- `common.continue`, `common.error`, `common.back` — all exist.
- `errors.networkError` — verify existence in T-114; add if missing.

### Stale keys to note (not my delete)

- None identified for this screen. T-106 already cleaned up the stale welcome keys.

---

## 10. Files I'll touch when implementing (exact absolute paths)

### Create

- `C:\Projects\ronex\app\(onboarding)\_layout.tsx` — Stack navigator for the onboarding group, `headerShown: false`, gestureEnabled per-screen via `Stack.Screen` options.
- `C:\Projects\ronex\app\(onboarding)\name-sex.tsx` (filename tentative — see open question 1) — the actual screen. Structure mirrors `enter-code.tsx`: SafeArea + KeyboardAvoidingView + header slot (progress) + content + bottom thumb-zone CTA.
- `C:\Projects\ronex\components\onboarding\OnboardingProgress.tsx` — shared component: 5 dots + "Stap X van Y" label. Props: `step: number, total: number`. Reused in T-109..T-112.
- `C:\Projects\ronex\stores\onboardingDraft.ts` — zustand store for in-flight onboarding state (displayName, biologicalSex, and placeholders for the next screens' fields). T-113 will read + flush this on final submit. **Creating this in T-108 so T-109..T-112 can just extend, not design-from-scratch.**

### Edit

- `C:\Projects\ronex\i18n\nl.json` — add the 10 new onboarding keys listed in §9 with PLACEHOLDER Dutch values. Copy T-114 rewrites them. Per `i18next.d.ts` missing (per T-107 note), no typing update.
- `C:\Projects\ronex\i18n\en.json` — same, English placeholders.

### Not touched (explicit exclusions)

- `lib/theme.ts` — no new tokens.
- `tailwind.config.js` — no new classes.
- `app/(auth)/*` — unchanged.
- `providers/AuthProvider.tsx` — the routing gate is T-113, not my scope.
- `package.json` — no new deps. `expo-haptics` already installed (T-106), reanimated already installed (T-015).

---

## 11. Open questions for Johnny (max 3)

1. **File name / screen name.** Default I'll use is `name-sex.tsx` (literal, lowercase-kebab, matches the task title). Alternatives: `identity.tsx` (my preference — cleaner, speaks to the thing not the fields), `basics.tsx`, `you.tsx`. Your call before I create the file.

2. **Privacy line casing — small-caps without uppercase (new precedent).** I'm proposing small-caps size/tracking but in sentence-case for the 2-line privacy helper (uppercase would read as SHOUTING on a privacy-sensitive field). This creates a new pattern within the `small-caps` token: optional-uppercase. If you'd rather I stick to the existing rule (always uppercase for small-caps) I'll fall back to `text-body text-content-muted` with reduced opacity — slightly heavier but tone-safe. Which direction?

3. **Draft store now, or wait for T-113?** To hand off clean data to T-113's backend save, I want to introduce a `stores/onboardingDraft.ts` (zustand) in T-108 so screens 2-5 have somewhere to write. This is arguably backend-agent territory (they own state management per CLAUDE.md). Options: (a) I build a minimal client-only draft store in T-108 and backend replaces it in T-113, (b) I pass data via `router.push` query params between onboarding screens and T-113 reads the full object from navigation state, (c) I wait and T-108's Continue just does `router.push` with no persistence, T-113 adds the store later. Your call.

Everything else I've decided on and will treat as approved-by-default:
- One screen for both fields (not split).
- Segmented pill row for biological_sex (not picker / not icons).
- Persistent inline privacy helper (not tooltip).
- 5-dot progress indicator + small-caps label.
- No back chevron on screen 1; allowed on screens 2-5.
- `app/(onboarding)/` route group.
- Shared `OnboardingProgress` component.

---

## Appendix — what this proposal does NOT cover

- Actual NL/EN strings — Copy T-114.
- Profile table insert / RLS / blocklist trigger — already done in T-101, just consumed here.
- Routing gate that redirects new users to onboarding — T-113.
- Minimal onboarding for challenge invitees — T-115 (Designer, same owner, separate flow).
- Onboarding screens 2-5 (experience, usage, plan, injuries) — T-109..T-112, separate mockups.
- Final submit + flush to Supabase — T-113.
