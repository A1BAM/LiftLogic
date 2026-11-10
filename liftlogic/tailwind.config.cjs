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
        ink: {
          950: '#000000', // the page: true black, which an OLED phone turns off
          900: '#101012', // a panel lifted off it
          800: '#1a1a1d', // a well you type into
          700: '#2e2e33', // hairlines and borders
          600: '#46464d' // disabled fills
        },
        // The only colour in the app, and only for what is finished.
        done: '#7ee08c'
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
