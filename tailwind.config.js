/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#F5F5F5',
        primary: '#0D0D0D',
        'primary-text': '#FFFFFF',
        border: '#E5E5E5',
        muted: '#999999',
        'text-secondary': '#666666',
        badge: '#E53935',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
