import { NOVAScoreBreakdown } from '../../services/novaScore';

/*
  One example breakdown, shared by every marketing page that shows the real
  NOVAScore component.

  Kept here rather than inline so the pages cannot end up quoting different
  numbers for the same screenshot - which is exactly how a site ends up
  advertising two versions of the same figure.

  Shaped like a plausible improving trader rather than a perfect one: a 78
  overall with discipline clearly the weakest component, because a marketing
  screenshot showing straight 90s would be both a lie and, for this audience,
  instantly recognisable as one.
*/
export const EXAMPLE_SCORE: NOVAScoreBreakdown = {
  overall_score: 78,
  consistency_score: 81,
  risk_management_score: 86,
  profitability_score: 74,
  discipline_score: 62,
  execution_score: 79,
  psychology_score: 71,
  win_rate: 58,
  profit_factor: 1.94,
  avg_win_loss_ratio: 1.41,
  total_trades: 142,
  best_trade: 940,
  worst_trade: -410,
  avg_hold_minutes: 96,
  longest_win_streak: 7,
};
