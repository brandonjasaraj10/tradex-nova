/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Brand tokens - see BRAND_GUIDE.md for when to use which.
      // Values match Tailwind's own blue-500/blue-400/green-400/red-400
      // (that's what the app already uses almost everywhere) - these
      // just give the intentional choices a name, so new code reaches
      // for "brand-blue" instead of guessing between 400 and 500.
      colors: {
        'brand-blue': '#3B82F6',       // solid fills: icon backgrounds, glows, gradients
        'brand-blue-light': '#60A5FA', // text, borders, hover/ring states on dark backgrounds
        'brand-bg': '#000000',         // page background
        'brand-surface': '#0A0A0A',    // cards and panels
        'brand-elevated': '#111111',   // inputs and nested/deeper panels
        'brand-profit': '#4ADE80',     // gains, positive stats
        'brand-loss': '#F87171',       // losses, errors, destructive actions
      },
    },
  },
  plugins: [],
};