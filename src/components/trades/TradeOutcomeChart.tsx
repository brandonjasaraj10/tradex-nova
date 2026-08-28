/*
  The drawn stand-in when a trade has no chart attached.

  This fills the top half of a card, so it cannot be a small icon floating in
  a dark box - at that size a lone glyph reads as a missing-image placeholder,
  which is exactly the impression to avoid when most trades have nothing
  attached.

  So it draws a full-width chart instead: a filled area with a gradient under
  a stroked line, rising for a winner and falling for a loser, on a faint
  grid. Blue and glowing for profit, flat grey for loss - the app's colours
  everywhere else.

  It is deliberately NOT a real price series. We have an entry, sometimes an
  exit, and a P&L - never the path between them. Drawing a plausible-looking
  curve from those would be inventing price action the trader never recorded,
  which is the same class of mistake as the fabricated metrics on the NOVA
  panel. This is a shape that encodes one true fact - won or lost - and the
  real numbers sit beside it on the card.
*/

interface Props {
  pnl: number;
  className?: string;
}

const WIN = '#3B82F6';
const LOSS = '#9CA3AF';

export default function TradeOutcomeChart({ pnl, className = '' }: Props) {
  const isWin = pnl > 0;
  const color = isWin ? WIN : LOSS;
  const gradientId = `trade-area-${isWin ? 'win' : 'loss'}`;

  // Same silhouette either way, mirrored vertically, so a winner and a loser
  // are instantly distinguishable at a glance across a grid of cards.
  const line = isWin
    ? 'M0,58 L18,49 L36,52 L54,38 L72,42 L90,24 L108,29 L126,14 L144,18 L160,6'
    : 'M0,6 L18,15 L36,12 L54,26 L72,22 L90,40 L108,35 L126,50 L144,46 L160,58';

  const area = `${line} L160,70 L0,70 Z`;

  return (
    <svg
      viewBox="0 0 160 70"
      preserveAspectRatio="none"
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={isWin ? 0.30 : 0.16} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* A faint grid, so the shape reads as a chart rather than a swoosh. */}
      {[14, 28, 42, 56].map((y) => (
        <line key={y} x1="0" y1={y} x2="160" y2={y} stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1" />
      ))}
      {[32, 64, 96, 128].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="70" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1" />
      ))}

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        // Only winners glow. Grey light on black reads as a smudge, and a
        // halo around a loss looks celebratory.
        style={isWin ? { filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.75))' } : undefined}
      />
    </svg>
  );
}
