/** @type {import('tailwindcss').Config} */
export default {
  /*
    Hover styles only where hovering is a thing.

    Without this, every hover: class also applies on touch - and a phone
    leaves that state stuck on the last thing tapped. In onboarding that
    read as the next question opening with an answer already highlighted
    blue, because the new button lands under the finger that just tapped
    the old one. The user has not chosen anything and the screen says they
    have.

    Tailwind wraps every hover: variant in @media (hover: hover) from here
    on, so a mouse behaves exactly as before and a finger no longer leaves
    a mark.
  */
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Brand tokens - see BRAND_GUIDE.md for when to use which.
      // These just give the app's intentional color choices a name, so
      // new code reaches for "brand-blue" instead of guessing between
      // shades, or between blue/grey and green/red for P&L.
      colors: {
        'brand-blue': '#3B82F6',       // solid fills: icon backgrounds, glows, gradients
        'brand-blue-light': '#60A5FA', // text, borders, hover/ring states on dark backgrounds
        'brand-bg': '#000000',         // page background
        'brand-surface': '#0A0A0A',    // cards and panels
        'brand-elevated': '#111111',   // inputs and nested/deeper panels
        'brand-profit': '#60A5FA',     // gains, positive stats (blue, not green - see BRAND_GUIDE.md)
        'brand-loss': '#9CA3AF',       // losses, negative stats (grey, not red)
      },
      keyframes: {
        'loader-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
      animation: {
        'loader-sweep': 'loader-sweep 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};