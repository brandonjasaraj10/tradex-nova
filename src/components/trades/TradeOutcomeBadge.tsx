import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { tradeOutcome } from '../../utils/formatMetrics';

/*
  Says whether a position won or lost, in words as well as colour.

  The P&L figure already carries the answer, but reading it means parsing a
  number and a minus sign on every row. This is for scanning: run an eye down
  the list and the winners and losers separate without doing any arithmetic.

  Breakeven is its own state rather than being folded into "loss". A trade
  closed at exactly zero is not a losing trade, and calling it one on a page
  someone uses to judge their record would be wrong - TradeTrendGlyph draws
  those with the falling grey line, which is the reason this badge exists
  beside it rather than instead of it.

  Colours follow the rule used everywhere else in the app: blue for gains,
  grey for losses. Deliberately not red - red is kept for genuinely
  destructive actions, not for a losing trade.
*/

interface Props {
  pnl: number;
}

export default function TradeOutcomeBadge({ pnl }: Props) {
  const outcome = tradeOutcome(pnl);

  const style = {
    win: { Icon: TrendingUp, label: 'Win', className: 'bg-blue-500/10 text-blue-400' },
    loss: { Icon: TrendingDown, label: 'Loss', className: 'bg-gray-500/10 text-gray-400' },
    breakeven: { Icon: Minus, label: 'Even', className: 'bg-white/[0.04] text-gray-500' },
  }[outcome];

  const { Icon, label, className } = style;

  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${className}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}
