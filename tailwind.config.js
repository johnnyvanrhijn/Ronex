/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 uses content paths to scan for class names
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ─── Colors ───────────────────────────────────────────
      colors: {
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
      },

      // ─── Typography ───────────────────────────────────────
      fontFamily: {
        inter: ['Inter_400Regular'],
        'inter-light': ['Inter_300Light'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
        'inter-extrabold': ['Inter_800ExtraBold'],
        'inter-black': ['Inter_900Black'],
      },
      // SPEC §14 Rule 5 — exactly 3 typographic levels. Do not add a 4th.
      // Casing for small-caps is applied at the consumer site via Tailwind's
      // `uppercase` utility (NativeWind does not honor textTransform in
      // fontSize tuples). Always pair `text-small-caps` with `uppercase`.
      fontSize: {
        'display-lg': ['32px', { lineHeight: '36px', letterSpacing: '-0.5px', fontWeight: '800' }],
        'body':       ['16px', { lineHeight: '24px' }],
        'small-caps': ['12px', { lineHeight: '16px', letterSpacing: '1.5px', fontWeight: '600' }],
      },
      letterSpacing: {
        tight: '-0.5px',
        wide:  '1.5px',
      },

      // ─── Spacing (base 4px) ───────────────────────────────
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },

      // ─── Border radius ────────────────────────────────────
      borderRadius: {
        button: '12px',
        card: '16px',
        input: '12px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};
