/**
 * Ronex design tokens — programmatic access.
 *
 * Use Tailwind classes (via NativeWind) in JSX whenever possible.
 * Import from here only when you need raw values in JS/TS
 * (e.g. Reanimated, SVG charts, haptic thresholds).
 */

export const colors = {
  primary: {
    DEFAULT: '#22C55E',
    dark: '#16A34A',
  },
  background: '#0A0A0A',
  surface: {
    DEFAULT: '#171717',
    elevated: '#262626',
  },
  content: {
    DEFAULT: '#FAFAFA',
    secondary: '#A3A3A3',
    muted: '#525252',
  },
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

/**
 * Typography — SPEC §14 Rule 5 mandates exactly 3 typographic levels.
 * Do NOT add a 4th level. Weight variation within `body` (400 default,
 * 600 for emphasis) counts as ONE level — size + line-height define the
 * level, weight is emphasis within it.
 *
 * Documented exceptions (see docs/design-system.md):
 * - Welcome wordmark (52px) — single brand-hero exception
 * - OTP input digits (24px) — input-field content, not a hierarchy level
 */
export const typography = {
  displayLg: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    fontWeight: '800' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  smallCaps: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
} as const;

export const fontSizes = {
  displayLg: 32,
  body: 16,
  smallCaps: 12,
} as const;

export const lineHeights = {
  displayLg: 36,
  body: 24,
  smallCaps: 16,
} as const;

export const spacing = (units: number) => units * 4;

export const borderRadius = {
  button: 12,
  card: 16,
  input: 12,
  pill: 9999,
} as const;

/** Minimum tap target for gym-friendly UI (44pt iOS guideline) */
export const MIN_TAP_TARGET = 44;

/** Minimum tap target during active workout (56pt) */
export const WORKOUT_TAP_TARGET = 56;
