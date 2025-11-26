/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        jorna: {
          50: '#fff7f2',
          100: '#fde7d7',
          500: '#CE6A2F',
          600: '#b85c28',
          700: '#9f4f22',
          800: '#7a3a18'
        },
        'jorna-brown': '#643511'
      }
    },
  },
  plugins: [],
}
