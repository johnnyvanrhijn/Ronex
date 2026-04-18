# T-106 — Welcome Screen Fork + Enter-Code Stub (Mockup Proposal)

Status: proposal, awaiting Johnny's approval before implementation.
Author: Designer
Date: 2026-04-18

---

## 1. Summary

The Phase 0 welcome screen works but reads as a centered logo with two generic buttons — it doesn't yet feel like a first impression. This proposal keeps the structure (wordmark up top, two CTAs in the thumb zone) but introduces three small moves that carry the weight: a subtle vertical lime-to-black gradient anchor behind the wordmark (10-15% opacity, bottom half of the logo block), a visible hierarchy gap between the two CTAs (primary stays solid lime, secondary becomes a borderless ghost with a small-caps label — it's a side door, not a twin), and a haptic `light` tap on button press. The `code` button now routes to a NEW `/(auth)/enter-code` stub screen with a single full-width monospace-biased text input (not 6-8 boxes — reasoning below). No new dependencies, no new typography levels, no rebuild.

---

## 2. Welcome screen — refined

### Layout sketch (iPhone 15 Pro, 393×852)

```
 +---------------------------------------+
 | SafeArea top                          |
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |          . . . . . . . . .            |  <- subtle radial/vertical
 |        .                   .          |     gradient glow, lime
 |       .       Ronex        .          |     #22C55E @ 8% opacity,
 |        .                   .          |     blurred, sits behind
 |          . . . . . . . . .            |     the wordmark only
 |                                       |
 |         Train. Volg. Verbeter.        |  <- body, secondary
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |  +---------------------------------+  |
 |  |                                 |  |  <- primary CTA, lime fill
 |  |        Ik wil trainen           |  |     56pt tall, body/600
 |  |                                 |  |
 |  +---------------------------------+  |
 |                                       |
 |         IK HEB EEN CODE               |  <- ghost, small-caps
 |                                       |     no border, centered,
 |                                       |     48pt tap area
 | SafeArea bottom (home indicator)      |
 +---------------------------------------+
```

### What's changing vs. current `welcome.tsx`

| Change | Phase 0 now | Phase 1 proposal | Why |
|---|---|---|---|
| Background | Flat `#0A0A0A` | Flat `#0A0A0A` **+ lime radial glow behind wordmark** (React Native `View` with `bg-primary/10`, rounded-full, blurred via layered opacity rings — no new dep) | Adds depth without decoration. The glow is the only "brand moment" on screen. |
| Secondary CTA | Bordered, same visual weight as primary | Ghost (no border, no fill), small-caps label | Two equal buttons = decision fatigue. This says: "trainen" is the front door, "code" is for the 5% of users arriving via invite. |
| Haptics | None | `Haptics.selectionAsync()` on press (already installed — `expo-haptics` comes with Expo) | Premium tactile layer, zero cost. |
| Wordmark | 52px extrabold | 52px extrabold **unchanged** | Documented exception stays. No rework. |
| Tagline | `text-body` secondary | `text-body` secondary **unchanged** | Copy is T-107's call. |
| Routing | Both buttons → `/(auth)/login` | `train` → `/(auth)/login`, `code` → `/(auth)/enter-code` | The actual bug T-106 fixes. |

### Per-element spec

| Element | Typography | Color token | Spacing / size |
|---|---|---|---|
| Background | — | `bg-background` (#0A0A0A) | full screen |
| Lime glow (behind wordmark) | — | `bg-primary` @ 8-10% opacity, `rounded-full`, ~280px square, centered behind wordmark | absolute, `blur` achieved via 3 stacked semi-transparent rings |
| Wordmark "Ronex" | **Exception — 52px/56 extrabold** (documented, unchanged) | `text-content` | centered, `tracking-tight` |
| Tagline | `text-body` (16/24) + `text-content-secondary` | `text-content-secondary` | `mt-3`, center-aligned, max-width ~280 |
| Primary button | `text-body font-inter-semibold` | bg `bg-primary`, text `text-background` | `h-14` (56pt), `rounded-button` (12), full-width, `px-6` inset from screen edge |
| Secondary CTA label | `text-small-caps uppercase` | `text-content-secondary` (subdued) | `h-12` tap area, centered, `mt-3` |
| Button block padding | — | — | `pb-4` above home indicator |

### Typography rule-5 compliance

Still 3 levels only: `display-lg` is not used on this screen (wordmark uses the documented 52px exception instead), `body` covers the tagline + primary button label, `small-caps` covers the ghost CTA. No new deviations, no new tokens. The only rule-5 footnote on this screen remains the pre-existing wordmark exception.

### Motion / feedback

- Press primary → `Haptics.selectionAsync()` + the Pressable's native `active:bg-primary-dark` already handles visual feedback.
- Press secondary → same haptic, color fades to `text-content` on active (`active:opacity-80`).
- No entrance animation. The screen is a door, not a reveal.

---

## 3. Enter-code screen (new stub)

### The input variant decision — **single input, not 6-8 boxes**

I considered both. My call: **single full-width text input**, reasoning:

- OTP boxes are great for **numeric, fixed-length, auto-received-via-SMS** codes. Challenge codes per SPEC are alphanumeric (e.g. `ABC-123`), **user types or pastes from a message**, and length can vary (6-8 chars). Boxes would force a design decision about hyphens, letter case, and whether index-5 is the 6th or 7th char.
- Paste UX is **better with one field**: iOS paste from clipboard auto-fills cleanly; with 6 boxes we have to manually split + distribute (see `verify.tsx` lines 58-71 — doable but brittle for alphanumeric).
- Boxes also create visual similarity to the OTP verify screen, which is a **different context** (a login step vs. accepting a challenge). A different form = a different mental model.
- Tradeoff: slightly less "premium/tactile" than the verify screen's boxes. Mitigated by: large field (h-14), monospace-biased font weight, `autoCapitalize="characters"`, `autoCorrect=false`, focused border in `border-primary`.

### Layout sketch

```
 +---------------------------------------+
 | [<]                                   |  <- back chevron, 44pt
 |                                       |
 |  Heb je een code?                     |  <- display-lg
 |                                       |
 |  Plak 'm hier om mee te doen aan      |  <- body, secondary
 |  een challenge.                       |
 |                                       |
 |  CODE                                 |  <- small-caps label
 |  +---------------------------------+  |
 |  |  ABC-123                        |  |  <- input h-14, monospace
 |  +---------------------------------+  |     body/semibold, caps
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |                                       |
 |  +---------------------------------+  |
 |  |          Verder                 |  |  <- primary, enabled only
 |  +---------------------------------+  |     when code.length >= 6
 |                                       |
 | SafeArea bottom                       |
 +---------------------------------------+
```

### Per-element spec

| Element | Typography | Color token | Spacing / size |
|---|---|---|---|
| Back chevron | — (icon 24px) | `#FAFAFA` | `h-11 w-11` rounded-full, `active:bg-surface`, `px-4 pt-2` outer |
| Title | `text-display-lg` (32/36/800) | `text-content` | `mt-8 px-6` |
| Subtitle | `text-body` | `text-content-secondary` | `mt-2 px-6` |
| Input label "CODE" | `text-small-caps uppercase` | `text-content-secondary` | `mt-10 px-6 mb-2` |
| Input field | `text-body font-inter-semibold`, `letter-spacing: 1.5px`, `autoCapitalize="characters"` | bg `bg-surface`, border `border-surface-elevated`, focused `border-primary` | `h-14`, `rounded-input` (12), `px-4`, full-width within `px-6` container |
| Primary button | `text-body font-inter-semibold` | bg `bg-primary` when valid, `bg-surface-elevated` when disabled; text `text-background` / `text-content-muted` | `h-14`, `rounded-button`, full-width, `px-6 pb-4`, thumb zone |

### Behaviour (T-106 stub scope only)

- Input accepts any characters, auto-uppercases visually.
- Primary enabled when `trim().length >= 6`.
- On press: `Haptics.selectionAsync()`, **stub for now** → `Alert.alert('Code validation komt in T-115')` or simply `router.back()` with a TODO comment. T-115 will replace the press handler with real validation + minimal-onboarding routing.
- No error states yet (T-115 owns `codeInvalid` rendering).
- Back chevron → `router.back()` (returns to welcome).
- `KeyboardAvoidingView` like `verify.tsx` so the input stays visible when the keyboard opens.

### Typography rule-5 compliance

Three levels used: `display-lg` (title), `body` (subtitle, input value, button label), `small-caps` (field label). Clean.

---

## 4. Navigation map

```
                   +---------------------+
                   |  (auth)/welcome     |
                   |  wordmark + 2 CTAs  |
                   +----------+----------+
                              |
                  +-----------+-----------+
                  |                       |
         "Ik wil trainen"         "Ik heb een code"
                  |                       |
                  v                       v
         +----------------+     +------------------+
         | (auth)/login   |     | (auth)/enter-code|   <- NEW, stub in T-106
         | email input    |     | single code field|
         +-------+--------+     +--------+---------+
                 |                       |
                 v                       v
         +----------------+     +--------------------+
         | (auth)/verify  |     | T-115: validate    |
         | OTP 6-box      |     | code + minimal     |
         +-------+--------+     | onboarding flow    |
                 |              +--------------------+
                 v
             (tabs)/home
          [full onboarding
          T-108…T-114 lives
          between verify and
          home for new users]
```

T-106's job ends at "the enter-code screen exists and the welcome fork routes correctly". T-115 wires up the validation, the minimal onboarding for invitees, and the post-success navigation.

---

## 5. Implementation plan (what I'll touch when approved)

### Files — edit

- `C:\Projects\ronex\app\(auth)\welcome.tsx`
  - Rewire secondary button to `router.push('/(auth)/enter-code')`.
  - Downgrade secondary to ghost + small-caps label (remove border, change height to 48pt, swap text class).
  - Add subtle lime glow behind wordmark (3 stacked `<View>` rings with increasing opacity, absolute-positioned inside logo container).
  - Add `Haptics.selectionAsync()` on both button presses (import from `expo-haptics`, already in SDK).

### Files — create

- `C:\Projects\ronex\app\(auth)\enter-code.tsx`
  - SafeAreaView + KeyboardAvoidingView shell (mirror of `verify.tsx` structure).
  - Back chevron, title, subtitle, small-caps label, single `TextInput`, primary button.
  - State: `const [code, setCode] = useState('')`.
  - Stub handler: for now `Alert` + TODO-comment pointing at T-115.

### i18n keys used (all already exist in `i18n/nl.json` and `i18n/en.json` per T-009)

- `onboarding.welcomeTitle`, `onboarding.welcomeSubtitle`, `onboarding.wantToTrain`, `onboarding.hasCode` — welcome (unchanged).
- `onboarding.enterCode` — enter-code title. Already exists ("Voer code in"). **Note**: current NL value reads fine as a title. If Copy (T-107) wants a more direct title like "Heb je een code?", that's their call, not mine.
- `onboarding.codePlaceholder` — input placeholder ("ABC-123"). Exists.
- `common.back`, `common.continue` — exist.

### Potentially missing keys (flagging to Copy, not adding myself)

- A **subtitle** string for the enter-code screen ("Plak 'm hier om mee te doen aan een challenge." or similar). No key exists. Options for T-107: reuse nothing and add `onboarding.enterCodeSubtitle`, or leave the screen subtitle-less. I'd prefer a subtitle — it sets expectation. Flagging only, not writing.
- A **small-caps field label** string ("CODE"). Could reuse `onboarding.enterCode` or add `onboarding.codeLabel`. Minor, Copy's call.

### Screenshot plan for Expo Go verification

Once implemented, I'll verify on Johnny's iPhone via Expo Go:

1. `welcome` — confirm glow is visible but subtle (not a colored blob), primary button is still the clear affordance, ghost CTA is discoverable but demoted.
2. `welcome` → tap "Ik wil trainen" → lands on `login` (unchanged, regression check).
3. `welcome` → tap "Ik heb een code" → lands on `enter-code`.
4. `enter-code` — keyboard opens, input is not clipped, back chevron works.
5. `enter-code` — paste a 6-char code from clipboard, confirm primary enables, tap triggers stub alert.
6. Dutch locale check: no string overflow on either screen (NL "Ik heb een uitdagingscode" is the longest and fits — currently clipped on one line, I'll confirm under the new ghost style).

---

## 6. Open questions for Johnny

Only two — I made calls on the rest:

1. **Glow treatment.** I'm proposing a low-opacity lime glow (3 stacked rings, no library). If you'd rather the welcome screen stay fully flat (current Phase 0 look) and we reserve the "brand glow" for a later hero moment (e.g. PR celebration in T-215), I'll drop it and the premium lift then comes purely from the CTA hierarchy shift + haptics. Your call.
2. **Single input vs. 6-box for enter-code.** I've argued for single input above. If you feel strongly the 6-box treatment makes the challenge flow feel more "ceremonial" (you're about to accept a challenge from a friend — it's a moment), I can pivot — but then T-115 has to solve alphanumeric-box edge cases. Signal your preference.

Everything else — ghost secondary, haptics, routing, i18n reuse, stub handler — I'll take as approved-by-default unless you flag.

---

## Appendix — what I am NOT touching in T-106

- `login.tsx` / `verify.tsx` — unchanged.
- Tab screens, home screen — out of scope (T-016, T-117 handle those).
- New i18n strings — Copy (T-107) writes them.
- Real code validation — T-115.
- New dependencies — none proposed.
- New typography tokens — none. Rule 5 intact.
