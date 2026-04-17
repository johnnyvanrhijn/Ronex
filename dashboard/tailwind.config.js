/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ronex palette — deep, confident, high contrast
        ink: {
          950: '#0A0B0D',    // deepest black
          900: '#14161A',    // main bg
          800: '#1C1F24',    // raised surface
          700: '#2A2E35',    // borders
          600: '#3D424B',    // dim text
          500: '#6B7280',    // secondary text
          400: '#9CA3AF',    // tertiary
        },
        bone: {
          50: '#FAFAF7',     // main text on dark
          100: '#F0EEE6',    // softer
          200: '#D4D0C5',    // dim on dark
        },
        lime: {
          400: '#D4FF3B',    // accent — PR, action
          500: '#B8E520',    // hover state
        },
        ember: {
          500: '#FF6B35',    // secondary accent
        },
        ruby: {
          500: '#E03636',    // error/degrade
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '600' }],
        'display-xl': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-lg': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
