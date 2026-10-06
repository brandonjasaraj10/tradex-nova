/*
  What TradeX connects to, and what it does not.

  THE CRITICAL DISTINCTION THIS FILE EXISTS TO HOLD

  The `brokers` table in the database marks all 32 of its rows supported:
  true, including NinjaTrader, Tradovate, TopStep, Interactive Brokers and
  TD Ameritrade. That column means "selectable when you add an account by
  hand", not "syncs" - and nothing in the app has ever claimed otherwise. But
  a page listing it as a sync compatibility list would be false, which is why
  this list is written by hand against the platform each firm actually runs
  rather than generated from that table.

  TradeX syncs through MetaApi, which speaks MetaTrader 4 and MetaTrader 5
  and nothing else. So the real question for any firm is not whether we have
  heard of them, it is which platform they hand you when you pass.

  Futures prop firms are the trap. TopStep, Apex Trader Funding, Bulenox and
  Tradeify are well known and none of them are on MetaTrader - they run
  Rithmic, Tradovate or NinjaTrader. Putting them on a "works today" list
  because the name is familiar is how a page like this becomes a lie.
*/

export type Platform = 'mt4' | 'mt5' | 'both';

export type SupportedFirm = {
  name: string;
  /* Prop firm, or a retail broker somebody trades their own money with. */
  kind: 'prop' | 'broker';
};

/*
  Firms and brokers whose accounts run on MetaTrader, so sync works today.

  Not an endorsement and not a partnership - there is no arrangement with any
  of them. The claim is only that their accounts run on a platform TradeX can
  read, which is a fact about them rather than a relationship with them.
*/
export const WORKS_TODAY: SupportedFirm[] = [
  { name: 'FTMO', kind: 'prop' },
  { name: 'FundedNext', kind: 'prop' },
  { name: 'The5ers', kind: 'prop' },
  { name: 'FundingPips', kind: 'prop' },
  { name: 'E8 Markets', kind: 'prop' },
  { name: 'Alpha Capital Group', kind: 'prop' },
  { name: 'FXIFY', kind: 'prop' },
  { name: 'Goat Funded Trader', kind: 'prop' },
  { name: 'Funded Trading Plus', kind: 'prop' },
  { name: 'City Traders Imperium', kind: 'prop' },
  { name: 'MyFundedFX', kind: 'prop' },
  { name: 'Blue Guardian', kind: 'prop' },
  { name: 'The Funded Trader', kind: 'prop' },
  { name: 'ThinkCapital', kind: 'prop' },
  { name: 'IC Markets', kind: 'broker' },
  { name: 'Pepperstone', kind: 'broker' },
  { name: 'OANDA', kind: 'broker' },
  { name: 'XM', kind: 'broker' },
  { name: 'FOREX.com', kind: 'broker' },
  { name: 'IG', kind: 'broker' },
];

/*
  Platforms TradeX cannot read yet.

  Each one is here because prop firms actually hand these out, not because
  they would be nice to have - and each names what it would take, because a
  "coming soon" list with no reasoning behind it is a wish list.

  No dates. Nothing here is committed, and a date on a roadmap item nobody
  has started is the kind of promise that turns into a support email.
*/
export const NOT_YET: Array<{ name: string; who: string }> = [
  {
    name: 'cTrader',
    who: 'IC Markets, Pepperstone and a growing number of prop firms offer it alongside MetaTrader.',
  },
  {
    name: 'DXtrade',
    who: 'The platform a lot of newer prop firms moved to when MetaQuotes tightened licensing.',
  },
  {
    name: 'Match-Trader',
    who: 'Common at prop firms that run their own branded terminal.',
  },
  {
    name: 'TradeLocker',
    who: 'Used by several funding programmes and built for exactly this kind of account.',
  },
  {
    name: 'Tradovate, NinjaTrader and Rithmic',
    who: 'The futures side - TopStep, Apex Trader Funding, Bulenox and Tradeify all live here, and none of them are on MetaTrader.',
  },
];
