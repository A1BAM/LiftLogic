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
        // Still dark, but warm rather than neutral: a hint of brown through
        // the greys is the difference between a room with a lamp on and an
        // instrument panel. Dark enough to stay easy at 6am.
        ink: {
          950: '#0d0c0b', // the page
          900: '#171512', // a panel lifted off it
          800: '#201d19', // a well you type into
          700: '#322d27', // hairlines and borders
          600: '#4a433a' // empty states, disabled fills
        },
        // Warm whites. Paper under a lamp, not a lightbulb in the face.
        cream: {
          50: '#f7f3ec', // headlines and numbers
          200: '#e6dfd4', // body
          400: '#b9afa1', // secondary — still 8:1 on a panel
          600: '#8a8073' // only for rules and disabled glyphs, never for text
        },
        ember: '#e5a33f', // what is happening now
        sage: '#9ec47c' // what is finished
      },
      fontFamily: {
        // The UI voice.
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        // The personal one: names, days and the weight on the bar. Every face
        // here ships with the OS, so there is nothing to download and nothing
        // to reflow when it arrives.
        display: ['ui-serif', 'Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
};
