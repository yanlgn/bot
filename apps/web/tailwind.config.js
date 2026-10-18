/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        cortex: {
          red: '#E5092E',
          'red-dark': '#B00520',
          'red-light': '#FF2A4D',
          black: '#0B0B0D',
          dark: '#111116',
          card: '#16161D',
          border: '#242430',
          muted: '#8E8E9A'
        },
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#E5092E',
          600: '#CC0727',
          700: '#B00520',
          900: '#7A0315'
        },
        scidark: {
          900: '#0B0B0D',
          800: '#111116',
          700: '#16161D',
          600: '#242430'
        }
      }
    }
  },
  plugins: []
};
