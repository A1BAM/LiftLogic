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
        // Neutral greys, not slate: slate carries a blue cast that makes every
        // surface look faintly tinted once the accent is warm.
        ink: {
          950: '#0a0a0b', // page
          900: '#121214', // raised surface
          800: '#18181b', // input wells
          700: '#232327' // hairlines
        },
        // One accent, used only for what is happening now.
        ember: '#f0a93b'
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
