/*
  "Trade" plus the mark, which is an X.

  The brand mark has always been a stylised X - it is the favicon, the app
  icon and the logo at the top of every TradeX email. The wordmark, though,
  spelled "TradeX" in plain type beside three vertical bars that are not the
  mark and appear nowhere else, so the two halves of the brand never met.

  Drawn inline rather than loaded from /tradex_logo.png for a practical
  reason: vite.config sets publicDir to false and copies an allowlist into
  dist at build time, so nothing in public/ is served by the dev server at
  all. The PNG renders in production and as a broken image locally, which is
  both impossible to check and a trap for the next person.

  Inline also means it takes currentColor, stays sharp at any size, and costs
  no request.
*/

interface WordmarkProps {
  /** Tailwind text size for the word; the mark scales with it. */
  className?: string;
}

export function XMark({ className = 'h-[0.92em] w-[0.92em]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        Two bars crossing, with a small diamond bitten out of the middle so
        they read as four separate arms - which is what the real mark does.
        Arms are deliberately heavy and the gap small: the first pass had it
        the other way round and the result read as an asterisk rather than an
        X.
      */}
      <mask id="tradex-x-gap">
        <rect width="100" height="100" fill="white" />
        <rect x="41" y="41" width="18" height="18" fill="black" transform="rotate(45 50 50)" />
      </mask>
      <g mask="url(#tradex-x-gap)" fill="currentColor">
        <rect x="39" y="2" width="22" height="96" rx="2" transform="rotate(45 50 50)" />
        <rect x="39" y="2" width="22" height="96" rx="2" transform="rotate(-45 50 50)" />
      </g>
    </svg>
  );
}

export default function Wordmark({ className = 'text-lg' }: WordmarkProps) {
  return (
    <span
      className={`inline-flex items-center gap-[0.08em] font-semibold tracking-[-0.02em] text-white ${className}`}
    >
      Trade
      <XMark />
      <span className="sr-only">X</span>
    </span>
  );
}
