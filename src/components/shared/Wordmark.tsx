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
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        Four wedges, traced from public/tradex_logo.png.

        Three earlier attempts all came back as "it just looks like a regular
        X", and all three were wrong the same way: they drew crossed bars and
        took a bite out of the middle. The mark is not crossed bars at all.

        Decoding the PNG's alpha channel and measuring each row's filled spans
        gives the real thing: four separate wedges, and BOTH diagonals broken.
        The two long arms - top-right and bottom-left - run almost to the
        centre and stop against a narrow vertical sliver of space. The two
        short arms - top-left and bottom-right - are cut off well before it,
        with mitred ends. Nothing touches anything.

        Coordinates below are that measurement, in the mark's own 0-100 box.
      */}

      {/* top left - short, mitred end */}
      <path d="M0 0 L26 0 L48 30 L37 41 Z" />

      {/* top right - long, squared inner edge against the centre gap */}
      <path d="M73 0 L98 0 L51 55 L51 29 Z" />

      {/* bottom left - long, mirrors the top right */}
      <path d="M48 45 L49 72 L26 100 L0 100 Z" />

      {/* bottom right - short, mirrors the top left */}
      <path d="M63 59 L100 100 L74 100 L52 70 Z" />
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
