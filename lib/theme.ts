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

export const fontSizes = {
  display: 32,
  heading: 24,
  subheading: 18,
  body: 16,
  label: 14,
  caption: 12,
} as const;

export const lineHeights = {
  display: 40,
  heading: 32,
  subheading: 28,
  body: 24,
  label: 20,
  caption: 16,
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
