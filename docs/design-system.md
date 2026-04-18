# Ronex Design System

Living reference for design tokens and per-screen application rules. For the product spec see `SPEC.md`, for brand voice see `TONE.md`.

## Typography

SPEC §14 Rule 5 mandates **exactly 3 typographic levels**. No screen gets a 4th.

| Level | Size / LH | Weight | Tracking | Casing | Tailwind | Purpose |
|---|---|---|---|---|---|---|
| **display-lg** | 32 / 36 | 800 | -0.5px | normal | `text-display-lg` | Screen titles, primary data (PR weight, stat numbers, league tier, user name in greeting) |
| **body** | 16 / 24 | 400 default / 600 emphasis | 0 | normal | `text-body` (+ `font-inter-semibold` when emphasized) | Sections, paragraphs, button labels, input values |
| **small-caps** | 12 / 16 | 600 | 1.5px | UPPERCASE | `text-small-caps uppercase` | Labels, metadata, timestamps, tab labels, stat labels, resend timer |

**Weight variation within `body` is ONE level**, not two. Size + line-height define the level; weight is emphasis within it.

**Casing for small-caps is applied via the `uppercase` utility** at the consumer site. NativeWind does not honor `textTransform` inside `fontSize` tuples, so always pair `text-small-caps` with `uppercase`:

```tsx
<Text className="text-small-caps uppercase">E-mailadres</Text>
```

Programmatic access (for Reanimated, SVG, etc.) lives in `lib/theme.ts` under `typography`.

### Casing variants within `small-caps` (SPEC §14 Rule 5)

The `small-caps` token supports two casing variants. Both share the same size / weight / tracking — only the casing rule differs. Both count as the same single level in the 3-level hierarchy (no 4th level introduced).

| Variant | Utilities | When to use |
|---|---|---|
| **`small-caps-label`** | `text-small-caps uppercase` | Default. 1-2 word labels, tab labels, timestamps, metadata, counters. |
| **`small-caps-helper`** | `text-small-caps` + `style={{ textTransform: 'none' }}` | Multi-line explanatory / helper text where uppercase would read as shouting. Used for the privacy helper line under sensitive form fields. Introduced in T-108 (`app/(onboarding)/identity.tsx`) under the biological-sex selector. |

NativeWind does not reliably honor `textTransform: 'none'` via className overrides when it conflicts with the `uppercase` utility, so `small-caps-helper` uses an inline `style` override. Keep this pattern when adding new helper-line usages. When in doubt, prefer `small-caps-label` — only reach for `small-caps-helper` when the text is a multi-line sentence and uppercase would be aggressive.

## Documented exceptions

Only these two escapes from the 3-level rule are sanctioned. Any other deviation is a bug — report to Designer.

### Welcome wordmark — 52px

`app/(auth)/welcome.tsx` renders "Ronex" as an inline 52px extrabold wordmark. This is the **single brand-hero exception**. The welcome screen is the user's first impression; the wordmark must carry presence that `display-lg` at 32px cannot. **No other screen gets this privilege.** Do not create a `display-xl` token. Do not reuse 52px anywhere else.

The exception is marked inline with the comment `// Documented typography exception — see docs/design-system.md`.

### OTP input digits — 24px

`app/(auth)/verify.tsx` renders each OTP digit at inline 24px bold inside a 48×60 field box. This is **input-field content, not a text hierarchy level**. Rule 5 governs text hierarchy on a screen, not every numeric value rendered inside a form input.

This sets precedent for future numeric form-input values — e.g. the weight input in workout logging, rep counts in the set logger, etc. — which may need their own inline-sized treatment to fit their field box without overflowing or shrinking to illegibility. When adding another case, mark it with the same `// Documented typography exception` comment and describe it here.

## Rule 5 enforcement

Any screen using more than 3 typographic levels (excluding the two documented exceptions above) is a bug. When spotted:

1. File against Designer.
2. Collapse the 4th level into one of the 3 existing levels (or into an emphasis variant within `body`).
3. Do not silently expand the token set.

If a legitimate 4th level seems necessary, it is more likely that the screen is doing too much — revisit the information architecture before the typography.
