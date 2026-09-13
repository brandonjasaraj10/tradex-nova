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

export function XMark({ className = 'h-[0.88em] w-[0.88em]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        Four arms, drawn as solid wedges rather than two crossed bars.

        The gap is not a centred diamond - that was the first attempt and it
        read as an asterisk. In the real mark the break runs as a diagonal
        slice, so the upper-left arm sits detached from the rest while the
        other three meet. Each arm is a quadrilateral with a squared outer end
        and a mitred inner one, which is what gives it the angular, cut look
        rather than the soft feel of a stroked X.
      */}

      {/* upper left - the detached one */}
      <path d="M8 10 L30 10 L58 44 L47 57 Z" />

      {/* upper right */}
      <path d="M70 10 L92 10 L53 57 L42 44 Z" />

      {/* lower left */}
      <path d="M30 90 L8 90 L47 43 L58 56 Z" />

      {/* lower right */}
      <path d="M92 90 L70 90 L42 56 L53 43 Z" />
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
