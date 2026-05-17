/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#fa2d48',
        'bg-main': '#1a1a2e',
        'bg-sidebar': '#16162a',
        'bg-card': '#222244',
        'bg-hover': '#2a2a4a',
        'text-main': '#e0e0e0',
        'text-secondary': '#a0a0b0',
      },
    },
  },
  plugins: [],
};
