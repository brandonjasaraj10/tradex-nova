import type { Instrument, Struggle } from '../services/onboarding';

/*
  What the preview screen shows, chosen by what somebody just told us.

  Every figure here is invented, and it has to be: this screen is shown to an
  account that has no trades, no broker connection and no subscription, and
  the point of it is to show what the product looks like full rather than
  empty. The screen labels it as an example, in as many words.

  The instruments are the part that must be right. A futures trader shown
  EURUSD learns that this was written for somebody else - so the symbols,
  the position sizes and the price scales are the ones each market actually
  uses. ES moves in points on 1-2 contracts; EURUSD moves in pips on lots;
  BTC does not trade at 1.0847.
*/

export interface SampleTrade {
  symbol: string;
  direction: 'Long' | 'Short';
  size: string;
  entry: string;
  exit: string;
  pnl: number;
  /* What a trader would have written about it - the reason to journal. */
  note: string;
}

export const INSTRUMENT_LABEL: Record<Instrument, string> = {
  futures: 'futures',
  forex: 'forex',
  stocks: 'stock',
  crypto: 'crypto',
};

export const SAMPLE_TRADES: Record<Instrument, SampleTrade[]> = {
  futures: [
    { symbol: 'ES', direction: 'Long', size: '2 contracts', entry: '5,842.25', exit: '5,851.75', pnl: 950, note: 'Waited for the retest. Followed the plan.' },
    { symbol: 'NQ', direction: 'Short', size: '1 contract', entry: '20,415.00', exit: '20,438.50', pnl: -470, note: 'Entered early, no confirmation.' },
    { symbol: 'CL', direction: 'Long', size: '1 contract', entry: '71.40', exit: '71.86', pnl: 460, note: 'Held to target for once.' },
  ],
  forex: [
    { symbol: 'EURUSD', direction: 'Long', size: '1.5 lots', entry: '1.08412', exit: '1.08655', pnl: 364, note: 'Clean break, waited for the pullback.' },
    { symbol: 'GBPJPY', direction: 'Short', size: '0.8 lots', entry: '193.240', exit: '193.615', pnl: -201, note: 'Moved my stop. Again.' },
    { symbol: 'AUDUSD', direction: 'Long', size: '1.0 lots', entry: '0.65180', exit: '0.65395', pnl: 215, note: 'Session open, textbook setup.' },
  ],
  stocks: [
    { symbol: 'NVDA', direction: 'Long', size: '120 shares', entry: '118.40', exit: '122.15', pnl: 450, note: 'Gap and go, sized properly.' },
    { symbol: 'TSLA', direction: 'Short', size: '80 shares', entry: '243.10', exit: '246.05', pnl: -236, note: 'Fought the trend. Knew better.' },
    { symbol: 'AAPL', direction: 'Long', size: '200 shares', entry: '226.80', exit: '228.35', pnl: 310, note: 'Boring setup, boring profit.' },
  ],
  crypto: [
    { symbol: 'BTCUSD', direction: 'Long', size: '0.35 BTC', entry: '67,420', exit: '68,890', pnl: 514, note: 'Waited out the wick. Worked.' },
    { symbol: 'ETHUSD', direction: 'Short', size: '4.2 ETH', entry: '2,640', exit: '2,688', pnl: -201, note: 'Revenge trade after the BTC stop.' },
    { symbol: 'SOLUSD', direction: 'Long', size: '60 SOL', entry: '154.20', exit: '158.40', pnl: 252, note: 'Sized down after two losses.' },
  ],
};

/*
  The second card, which is the one that matters.

  The trade log proves TradeX records trades, which every journal does. This
  proves it was built around the thing they just admitted is costing them
  money - and it is that admission, made thirty seconds earlier, that makes
  the card land rather than read as a feature list.

  "No idea, that's the problem" gets its own answer rather than a generic
  one. Somebody who does not know what is wrong is describing precisely the
  product's reason to exist, and telling them so is a stronger response than
  picking a struggle for them.
*/
export interface StruggleCard {
  title: string;
  /* The check as it would actually appear, before a trade. */
  items: { label: string; state: 'flagged' | 'ok' | 'pending' }[];
  /* What TradeX does about it, in one sentence. */
  outcome: string;
}

export const STRUGGLE_CARD: Record<Struggle, StruggleCard> = {
  revenge_trading: {
    title: 'Before your next trade',
    items: [
      { label: 'Last trade was a loss', state: 'flagged' },
      { label: 'Cooldown suggested — 15 minutes', state: 'flagged' },
      { label: 'Position size within your usual range', state: 'ok' },
      { label: 'Reason for this trade written down', state: 'pending' },
    ],
    outcome: 'TradeX notices the loss before you take the next one, and says so.',
  },
  overtrading: {
    title: 'Before your next trade',
    items: [
      { label: '6 trades today — your average is 3', state: 'flagged' },
      { label: 'Win rate drops after trade 4', state: 'flagged' },
      { label: 'This setup is on your plan', state: 'ok' },
      { label: 'Reason for this trade written down', state: 'pending' },
    ],
    outcome: 'TradeX counts what you have already taken today, and what it usually costs you.',
  },
  breaking_rules: {
    title: 'Your rules, on this trade',
    items: [
      { label: 'Stop loss set before entry', state: 'ok' },
      { label: 'Risk under 1% of account', state: 'flagged' },
      { label: 'Setup is on your approved list', state: 'ok' },
      { label: 'No trading in the first 15 minutes', state: 'pending' },
    ],
    outcome: 'You write the rules once. TradeX checks them against every trade you take.',
  },
  not_sure: {
    title: 'What TradeX found in 30 trades',
    items: [
      { label: 'You lose most after a winning streak', state: 'flagged' },
      { label: 'Your best trades are held twice as long', state: 'ok' },
      { label: 'Thursday is your worst day, consistently', state: 'flagged' },
      { label: 'Tracking 4 more patterns', state: 'pending' },
    ],
    outcome: 'Not knowing is the normal answer. Finding out is the entire point of this.',
  },
};
