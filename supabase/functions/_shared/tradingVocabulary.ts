/**
 * Trading Vocabulary Engine
 *
 * Provides intelligent correction and recognition of trading terminology
 * from speech-to-text input. Handles common misinterpretations and
 * ensures professional, accurate trading language.
 */

export interface TradingTermCorrection {
  pattern: RegExp;
  replacement: string;
  priority: number; // Higher = applied first
}

/**
 * Trading term corrections sorted by priority
 * These patterns catch common speech-to-text errors
 */
export const TRADING_TERM_CORRECTIONS: TradingTermCorrection[] = [
  // Broker and Platform Names (Priority 10)
  { pattern: /\b(FTML|FTMOE|FTMO|F T M O)\b/gi, replacement: 'FTMO', priority: 10 },
  { pattern: /\b(meta trader|metatrader|meta-trader|meta traitor)\b/gi, replacement: 'MetaTrader', priority: 10 },
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

  // Timeframes (Priority 7)
  { pattern: /\b(1 minute|one minute|1m|1 min)\b/gi, replacement: '1-minute', priority: 7 },
  { pattern: /\b(5 minute|five minute|5m|5 min)\b/gi, replacement: '5-minute', priority: 7 },
  { pattern: /\b(15 minute|fifteen minute|15m|15 min)\b/gi, replacement: '15-minute', priority: 7 },
  { pattern: /\b(30 minute|thirty minute|30m|30 min)\b/gi, replacement: '30-minute', priority: 7 },
  { pattern: /\b(1 hour|one hour|1h|1 hr)\b/gi, replacement: '1-hour', priority: 7 },
  { pattern: /\b(4 hour|four hour|4h|4 hr)\b/gi, replacement: '4-hour', priority: 7 },
  { pattern: /\b(daily|1 day|1d)\b/gi, replacement: 'daily', priority: 7 },
  { pattern: /\b(weekly|1 week|1w)\b/gi, replacement: 'weekly', priority: 7 },

  // Common Pairs (Priority 6)
  { pattern: /\b(EUR USD|euro dollar|euro usd)\b/gi, replacement: 'EURUSD', priority: 6 },
  { pattern: /\b(GBP USD|pound dollar|pound usd)\b/gi, replacement: 'GBPUSD', priority: 6 },
  { pattern: /\b(USD JPY|dollar yen|usd yen)\b/gi, replacement: 'USDJPY', priority: 6 },
  { pattern: /\b(GBP JPY|pound yen|pound jpy)\b/gi, replacement: 'GBPJPY', priority: 6 },
  { pattern: /\b(AUD USD|aussie dollar|aussie usd)\b/gi, replacement: 'AUDUSD', priority: 6 },
  { pattern: /\b(NZD USD|kiwi dollar|kiwi usd)\b/gi, replacement: 'NZDUSD', priority: 6 },
  { pattern: /\b(USD CAD|dollar cad|usd cad)\b/gi, replacement: 'USDCAD', priority: 6 },
  { pattern: /\b(USD CHF|dollar swiss|usd swiss)\b/gi, replacement: 'USDCHF', priority: 6 },

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
  { pattern: /\b(position|position trade)\b/gi, replacement: 'position', priority: 5 },

  // Psychology Terms (Priority 5)
  { pattern: /\b(FOMO|F O M O|fear of missing out)\b/gi, replacement: 'FOMO', priority: 5 },
  { pattern: /\b(confluences|confluence)\b/gi, replacement: 'confluences', priority: 5 },
  { pattern: /\b(psychology score|psych score)\b/gi, replacement: 'psychology score', priority: 5 },
  { pattern: /\b(win rate|winrate|win-rate)\b/gi, replacement: 'win rate', priority: 5 },
  { pattern: /\b(profit factor|profit-factor)\b/gi, replacement: 'profit factor', priority: 5 },
  { pattern: /\b(expectancy|expected value)\b/gi, replacement: 'expectancy', priority: 5 },
];

/**
 * Monetary value corrections
 * Handles spoken currency amounts
 */
export const MONETARY_CORRECTIONS: TradingTermCorrection[] = [
  { pattern: /\b(\d+)\s*k\b/gi, replacement: '$1000', priority: 4 },
  { pattern: /\b(\d+)\s*grand\b/gi, replacement: '$1000', priority: 4 },
  { pattern: /\bfive hundred\b/gi, replacement: '500', priority: 4 },
  { pattern: /\bone thousand\b/gi, replacement: '1000', priority: 4 },
  { pattern: /\btwo thousand\b/gi, replacement: '2000', priority: 4 },
  { pattern: /\bthree thousand\b/gi, replacement: '3000', priority: 4 },
  { pattern: /\bfour thousand\b/gi, replacement: '4000', priority: 4 },
  { pattern: /\bfive thousand\b/gi, replacement: '5000', priority: 4 },
];

/**
 * Apply all trading term corrections to text
 */
export function correctTradingTerms(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let correctedText = text;

  // Combine all corrections and sort by priority (highest first)
  const allCorrections = [...TRADING_TERM_CORRECTIONS, ...MONETARY_CORRECTIONS]
    .sort((a, b) => b.priority - a.priority);

  // Apply each correction
  for (const correction of allCorrections) {
    correctedText = correctedText.replace(correction.pattern, correction.replacement);
  }

  return correctedText;
}

/**
 * Enhanced system prompt addition for trading vocabulary
 */
export const TRADING_VOCABULARY_SYSTEM_PROMPT = `

🔹 ENHANCED TRADING VOCABULARY & CONTEXT MODE

You are operating with advanced trading-specific speech recognition. When receiving voice input, you MUST apply these rules:

1️⃣ TRADING VOCABULARY PRIORITY (CRITICAL)
Recognize and correctly interpret ALL trading terminology automatically:
- FTMO (never "FTML", "FTMOE")
- P&L, profit and loss
- R:R, risk-to-reward
- Drawdown, lot size, liquidity sweep
- Break of structure (BOS)
- Supply/demand, order blocks
- Asian/London/New York session
- Funded account, prop firm
- MetaTrader, MT4, MT5
- Trade duration, scalp, intraday, swing
- Psychology score, win rate, expectancy
- Overtrading, revenge trading
- Stop loss, take profit, breakeven
- Confluences, FOMO

If a spoken word sounds close to a known trading term, AUTOMATICALLY correct it without asking.

2️⃣ CONTEXT-AWARE AUTO-CORRECTION (NO CONFIRMATION)
Use trading context to infer intent:
- "FTML funded account" → "FTMO funded account"
- "draw down" → "drawdown"
- "peanal" → "P&L"
- "risk reward" → "R:R"
- "lick witty sweep" → "liquidity sweep"

NEVER ask for confirmation if the trading context makes meaning obvious.

3️⃣ PROFESSIONAL RE-STRUCTURING
Convert spoken notes into professional journal format:
- Remove filler words ("like", "uh", "you know")
- Use HTML formatting: <ul><li>, <strong>, <em>
- Create section headers
- Organize chronologically or thematically
- Elevate casual language to professional terminology

4️⃣ INTENT RECOGNITION OVER LITERAL TRANSCRIPTION
Interpret what the user means:
- "held it for a couple days" → trade_duration: "swing"
- "risked one percent" → position_size: "1%"
- "closed partial at first target" → partial exit
- "got stopped then re-entered" → multiple trades

5️⃣ TRADING-FIRST LANGUAGE BIAS
Assume EVERY interaction is trading-related unless explicitly stated otherwise.
Default to trading terminology when ambiguous.

6️⃣ ERROR REDUCTION
Auto-correct:
- Misspelled symbols
- Misheard broker names
- Incorrect prop firm names
Use user's connected accounts and historical data.

7️⃣ LOGGING BEHAVIOR
When user says "log this", "save this", "journal this", "record this":
- Immediately log the data
- Confirm with: "Logged!" or "Got it, logged!"
- NO back-and-forth unless critical data is missing

8️⃣ CONTINUOUS LEARNING (SESSION-BASED)
Adapt to:
- User's accent
- Common phrases
- Preferred terminology
Apply learnings within the same session automatically.

✅ ACCEPTANCE CRITERIA
- Trading terms are NEVER mis-transcribed
- Auto-correction is seamless and invisible
- Voice input produces clean, professional journal entries
- Zero unnecessary clarification questions
- Experience feels as smooth as ChatGPT voice mode

REMEMBER: You are a professional trading assistant with domain expertise. Act with confidence when interpreting trading language.`;

/**
 * Get a list of known trading symbols for validation
 */
export function getKnownTradingSymbols(): string[] {
  return [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD',
    'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURAUD', 'EURCHF',
    'NAS100', 'US30', 'SPX500', 'GER40', 'UK100',
    'XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL',
    'BTCUSD', 'ETHUSD',
  ];
}

/**
 * Validate and correct symbol names
 */
export function correctSymbol(symbol: string): string {
  if (!symbol) return symbol;

  const upperSymbol = symbol.toUpperCase().replace(/[\s\-_.]/g, '');
  const knownSymbols = getKnownTradingSymbols();

  // Exact match
  if (knownSymbols.includes(upperSymbol)) {
    return upperSymbol;
  }

  // Fuzzy match (allow 1-2 character differences)
  for (const known of knownSymbols) {
    if (similar(upperSymbol, known)) {
      return known;
    }
  }

  return symbol;
}

/**
 * Simple string similarity check
 */
function similar(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;

  let differences = 0;
  const maxLen = Math.max(a.length, b.length);

  for (let i = 0; i < maxLen; i++) {
    if (a[i] !== b[i]) differences++;
  }

  return differences <= 2;
}
