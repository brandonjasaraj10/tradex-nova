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

export function XMark({ className = 'h-[0.9em] w-[0.9em]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        Traced from public/tradex_logo.png rather than guessed at - the first
        two attempts were a crossed pair with a diamond bite and then four
        loose wedges, and both read as an ordinary X because they were
        symmetrical.

        The real mark is not. Decoding the PNG's alpha channel and printing it
        as a grid shows one diagonal running unbroken corner to corner, while
        the other is cut clean through just ABOVE centre - so the top-left arm
        hangs separate and the remaining three meet. That asymmetry is the
        whole character of it.
      */}
      <defs>
        <mask id="tradex-x-break">
          <rect width="100" height="100" fill="#fff" />
          {/*
            A band lying across the NW-SE stroke, perpendicular to it, sitting
            above centre where the PNG shows the break.
          */}
          <rect x="18" y="36" width="64" height="13" fill="#000" transform="rotate(-45 50 50)" />
        </mask>
      </defs>

      {/* NW to SE - the broken one */}
      <rect
        x="40.5" y="3" width="19" height="94" rx="1.5"
        transform="rotate(45 50 50)"
        mask="url(#tradex-x-break)"
      />
      {/* NE to SW - continuous */}
      <rect x="40.5" y="3" width="19" height="94" rx="1.5" transform="rotate(-45 50 50)" />
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
