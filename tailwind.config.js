/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7fa',
          100: '#e4e8f0',
          200: '#cdd5e4',
          300: '#a9b9d3',
          400: '#7e95bd',
          500: '#5c76a6',
          600: '#485d8b',
          700: '#3c4d73',
          800: '#344161',
          900: '#2d3752',
          950: '#1e2436',
        }
      }
    },
  },
  plugins: [],
}
