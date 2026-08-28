/*
  The little chart that replaces the up/down arrows.

  The arrows encoded LONG vs SHORT, but the colours asked for here - glowy
  blue and dark grey - are this app's profit and loss colours everywhere
  else. Colouring by direction would paint every short grey, which reads as
  "lost money" for a trade that may well have won.

  So the glyph encodes the OUTCOME: a rising blue line for a winning trade, a
  falling grey one for a loser. Direction is still on the row, in the
  LONG/SHORT badge beside the symbol, so nothing is lost and the two are not
  saying the same thing twice.
*/

interface Props {
  pnl: number;
  size?: number;
  /** Cards give it more room than rows, so the glow scales with it. */
  emphasis?: boolean;
}

const WIN = '#3B82F6';
const LOSS = '#9CA3AF';

export default function TradeTrendGlyph({ pnl, size = 20, emphasis = false }: Props) {
  const isWin = pnl > 0;
  const color = isWin ? WIN : LOSS;

  // A rising or falling line with a little noise, so it reads as a chart
  // rather than an arrow drawn diagonally.
  const points = isWin
    ? '1,15 5,11 9,12 13,6 17,7 21,2'
    : '1,3 5,7 9,6 13,12 17,11 21,15';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 17"
      fill="none"
      aria-hidden="true"
      style={
        // Only winners glow. A loss rendered with the same halo would look
        // celebratory, and grey light on black reads as smudge rather than
        // emphasis.
        isWin
          ? { filter: `drop-shadow(0 0 ${emphasis ? 6 : 3}px rgba(59,130,246,${emphasis ? 0.85 : 0.6}))` }
          : undefined
      }
    >
      <polyline
        points={points}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
