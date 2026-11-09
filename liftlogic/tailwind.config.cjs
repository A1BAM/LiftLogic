/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Water: everything from sea-glass to deep lagoon. Text sits at the
        // dark end of this ramp rather than in grey, so nothing reads as ink
        // on a surface that is meant to look wet.
        aero: {
          50: '#f3fdff',
          100: '#e2f8ff',
          200: '#c2eefb',
          300: '#8fe1f5',
          400: '#4ecfe9',
          500: '#17b8d9',
          600: '#0897ba',
          700: '#097792',
          800: '#0c5b73',
          900: '#0a3d4e'
        },
        // Meadow: the other half of the palette, for growth and completion.
        leaf: {
          200: '#e4f9b8',
          300: '#c8f255',
          400: '#a9e22b',
          500: '#8ccb12',
          600: '#6ea50c'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif']
      },
      boxShadow: {
        glass: '0 12px 34px -14px rgba(8, 86, 112, 0.35), inset 0 1px 0 rgba(255,255,255,0.95)',
        gel: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px -6px rgba(8, 140, 180, 0.55)',
        bubble: 'inset 0 -8px 18px -8px rgba(10,120,150,0.25), inset 0 6px 10px -4px rgba(255,255,255,0.95)'
      }
    }
  },
  plugins: []
};
