/**
 * Trading Vocabulary Correction - Client Side
 *
 * Applies intelligent corrections to trading terminology from speech-to-text input
 * This runs on the client side before sending to the backend for additional processing
 */

interface TradingTermCorrection {
  pattern: RegExp;
  replacement: string;
  priority: number;
}

const TRADING_TERM_CORRECTIONS: TradingTermCorrection[] = [
  // Broker and Platform Names (Priority 10)
  { pattern: /\b(FTML|FTMOE|F T M O)\b/gi, replacement: 'FTMO', priority: 10 },
  { pattern: /\b(meta trader|meta-trader|meta traitor)\b/gi, replacement: 'MetaTrader', priority: 10 },
  { pattern: /\b(MT ?4|M T 4|empty four)\b/gi, replacement: 'MT4', priority: 10 },
  { pattern: /\b(MT ?5|M T 5|empty five)\b/gi, replacement: 'MT5', priority: 10 },

  // Common Trading Terms (Priority 9)
  { pattern: /\b(P and L|P & L|PNL|peanal|penal)\b/gi, replacement: 'P&L', priority: 9 },
  { pattern: /\b(R to R|R 2 R|R:R|R R|risk reward|risk to reward)\b/gi, replacement: 'R:R', priority: 9 },
  { pattern: /\b(draw down|draw-down)\b/gi, replacement: 'drawdown', priority: 9 },
  { pattern: /\b(lot size|lot-size)\b/gi, replacement: 'lot size', priority: 9 },
  { pattern: /\b(stop loss|stop-loss)\b/gi, replacement: 'stop loss', priority: 9 },
  { pattern: /\b(take profit|take-profit)\b/gi, replacement: 'take profit', priority: 9 },
  { pattern: /\b(break even|break-even)\b/gi, replacement: 'breakeven', priority: 9 },

  // Trading Patterns (Priority 8)
  { pattern: /\b(liquidity sweep|lick witty sweep)\b/gi, replacement: 'liquidity sweep', priority: 8 },
  { pattern: /\b(break of structure|BOS|B O S)\b/gi, replacement: 'break of structure', priority: 8 },
  { pattern: /\b(change of character|CHoCH|choch)\b/gi, replacement: 'change of character', priority: 8 },
  { pattern: /\b(order block|order-block)\b/gi, replacement: 'order block', priority: 8 },
  { pattern: /\b(fair value gap|FVG|F V G)\b/gi, replacement: 'fair value gap', priority: 8 },
  { pattern: /\b(supply and demand|supply & demand)\b/gi, replacement: 'supply and demand', priority: 8 },

  // Trading Sessions (Priority 8)
  { pattern: /\b(Asian session|Asia session|asian)\b/gi, replacement: 'Asian session', priority: 8 },
  { pattern: /\b(London session|london)\b/gi, replacement: 'London session', priority: 8 },
  { pattern: /\b(New York session|NY session|New york|newyork)\b/gi, replacement: 'New York session', priority: 8 },

  // Account Types (Priority 8)
  { pattern: /\b(funded account|funded)\b/gi, replacement: 'funded account', priority: 8 },
  { pattern: /\b(prop firm|prop-firm|propharm)\b/gi, replacement: 'prop firm', priority: 8 },
  { pattern: /\b(demo account|demo)\b/gi, replacement: 'demo account', priority: 8 },
  { pattern: /\b(live account|live)\b/gi, replacement: 'live account', priority: 8 },

  // Trading Actions (Priority 7)
  { pattern: /\b(over trading|over-trading)\b/gi, replacement: 'overtrading', priority: 7 },
  { pattern: /\b(revenge trading|revenge-trading)\b/gi, replacement: 'revenge trading', priority: 7 },
  { pattern: /\b(risk management|risk-management)\b/gi, replacement: 'risk management', priority: 7 },
  { pattern: /\b(position sizing|position-sizing)\b/gi, replacement: 'position sizing', priority: 7 },

  // Common Pairs (Priority 6)
  { pattern: /\b(EUR USD|euro dollar|euro usd)\b/gi, replacement: 'EURUSD', priority: 6 },
  { pattern: /\b(GBP USD|pound dollar|pound usd)\b/gi, replacement: 'GBPUSD', priority: 6 },
  { pattern: /\b(USD JPY|dollar yen|usd yen)\b/gi, replacement: 'USDJPY', priority: 6 },
  { pattern: /\b(GBP JPY|pound yen|pound jpy)\b/gi, replacement: 'GBPJPY', priority: 6 },
  { pattern: /\b(AUD USD|aussie dollar|aussie usd)\b/gi, replacement: 'AUDUSD', priority: 6 },
  { pattern: /\b(NZD USD|kiwi dollar|kiwi usd)\b/gi, replacement: 'NZDUSD', priority: 6 },

  // Indices (Priority 6)
  { pattern: /\b(NAS ?100|nas hundred|nasdaq 100)\b/gi, replacement: 'NAS100', priority: 6 },
  { pattern: /\b(US ?30|us thirty|dow jones)\b/gi, replacement: 'US30', priority: 6 },
  { pattern: /\b(SPX ?500|S&P 500|sp 500)\b/gi, replacement: 'SPX500', priority: 6 },

  // Commodities (Priority 6)
  { pattern: /\b(XAU USD|gold|xau usd)\b/gi, replacement: 'XAUUSD', priority: 6 },
  { pattern: /\b(XAG USD|silver|xag usd)\b/gi, replacement: 'XAGUSD', priority: 6 },

  // Trade Durations (Priority 5)
  { pattern: /\b(scalp|scalping)\b/gi, replacement: 'scalp', priority: 5 },
  { pattern: /\b(intraday|intra-day|intra day)\b/gi, replacement: 'intraday', priority: 5 },
  { pattern: /\b(swing|swing trade|swing-trade)\b/gi, replacement: 'swing', priority: 5 },

  // Monetary corrections (Priority 4)
  { pattern: /\b(\d+)\s*k\b/gi, replacement: '$1000', priority: 4 },
  { pattern: /\b(\d+)\s*grand\b/gi, replacement: '$1000', priority: 4 },
];

/**
 * Apply trading term corrections to text
 */
export function correctTradingTerms(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let correctedText = text;

  // Sort by priority (highest first)
  const sortedCorrections = [...TRADING_TERM_CORRECTIONS].sort(
    (a, b) => b.priority - a.priority
  );

  // Apply each correction
  for (const correction of sortedCorrections) {
    correctedText = correctedText.replace(correction.pattern, correction.replacement);
  }

  return correctedText;
}
