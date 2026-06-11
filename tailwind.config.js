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
        // Figma Neutral/* ramp — keep in lockstep with src/constants/theme.ts
        chocolate: '#2B2A27',
        ink: '#1B1B18',
        'apple-mail': '#F1F3F6',
        'hidden-lines': '#E0E4EB',
        'neutral-600': '#5A5A5A',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
