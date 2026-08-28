/*
  The drawn stand-in when a trade has no chart attached.

  Same shape language as the P&L sparkline on the dashboard - a smooth
  quadratic curve with a gradient fading out beneath it - so a card without a
  screenshot still looks like part of the app rather than a placeholder. An
  earlier version drew a jagged polyline on a grid, which read as a chart
  someone had failed to load.

  Blue and glowing for a winner, flat grey for a loser, matching the profit
  and loss colours used everywhere else.

  It is deliberately NOT a real price series. We have an entry, sometimes an
  exit, and a P&L - never the path between them. Drawing a plausible-looking
  curve from those would be inventing price action the trader never recorded,
  which is the same mistake as the fabricated metrics that used to sit on the
  NOVA panel. This encodes one true fact - won or lost - and the real numbers
  sit beside it on the card.
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
  const gradientId = `trade-curve-${isWin ? 'win' : 'loss'}`;

  /*
    Quadratic curve, then a chain of T commands that mirror the previous
    control point - the same construction the dashboard sparkline uses, which
    is what gives it the continuous flowing line rather than visible joins.
    The loss path is the win path reflected vertically, so the two are
    instantly distinguishable across a grid of cards.
  */
  const curve = isWin
    ? 'M0,34 Q10,32 20,29 T40,23 T60,17 T80,15 T100,6'
    : 'M0,6 Q10,8 20,11 T40,17 T60,23 T80,25 T100,34';

  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={isWin ? 0.3 : 0.16} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={`${curve} V40 H0 Z`} fill={`url(#${gradientId})`} />
      <path
        d={curve}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        // preserveAspectRatio="none" stretches the geometry horizontally, which
        // would thin the stroke with it - this keeps it an even 2px.
        vectorEffect="non-scaling-stroke"
        // Only winners glow. Grey light on black reads as a smudge, and a halo
        // around a loss looks celebratory.
        style={isWin ? { filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.7))' } : undefined}
      />
    </svg>
  );
}
