/*
  The plans, in one place, because two pages render them.

  Pricing.tsx and the landing page's pricing section both show these tiers.
  Kept as one module rather than copied into each, and that is not tidiness:
  the pricing page's own comment already warned that duplicating this "is how
  a site ends up advertising two different prices", and it had just happened -
  the homepage said one plan at $24.99 while /pricing offered three from
  $29.99. A price that lives in two files eventually disagrees with itself.
*/

export type Tier = {
  name: string;
  price: string;
  /* Who this is for, in their words rather than ours. */
  who: string;
  /*
    What the money actually buys, written as the outcome rather than the
    specification. "Closed trades appear on their own, once a day" beats
    "1x daily sync interval" - the first is a thing that happens to you, the
    second is a row in a table.
  */
  lines: { text: string; included: boolean }[];
  cta: string;
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$29.99',
    who: 'One account, and you would rather not type it up yourself.',
    lines: [
      { text: 'One account, syncing on its own', included: true },
      { text: 'Yesterday’s trades, waiting each morning', included: true },
      { text: 'Add or import as many accounts as you like', included: true },
      { text: '25 questions a day for Nova', included: true },
      { text: 'Trades that land while you are still at the screen', included: false },
    ],
    cta: 'Start journaling',
  },
  {
    name: 'Pro',
    price: '$59.99',
    who: 'A few accounts running, and you write trades up while they are fresh.',
    lines: [
      { text: 'Three accounts, syncing on their own', included: true },
      { text: 'Trades land minutes after you close them', included: true },
      { text: 'Add or import as many accounts as you like', included: true },
      { text: '100 questions a day for Nova', included: true },
      { text: 'More synced accounts whenever, $15 each', included: true },
    ],
    cta: 'Start journaling',
    featured: true,
  },
  {
    name: 'Elite',
    price: '$149.99',
    who: 'Several funded accounts at once, where a missed day is real money.',
    lines: [
      { text: 'Six accounts, syncing on their own', included: true },
      { text: 'Trades land minutes after you close them', included: true },
      { text: '300 questions a day — you will not reach it', included: true },
      { text: 'First on every new platform we connect', included: true },
      { text: 'Your support goes to the front of the queue', included: true },
    ],
    cta: 'Start journaling',
  },
];

/*
  In every plan, listed once rather than three times.

  Repeating identical ticks down three columns is how a pricing table
  becomes a wall nobody reads. The columns carry only what differs;
  everything shared sits underneath, where it reassures without competing.

  The WORDING here came from main rather than from this branch, and
  deliberately. This branch still carried the old fourteen-item inventory,
  where "Psychology template & scoring" and "NOVA Score" were the same
  promise twice and "Performance analytics", "Trading calendar" and
  "Searchable trade log" were three names for looking at your own trades.
  Main had already cut that to six outcomes, on research putting the useful
  range at five to seven bullets and a documented case going from 1.2% to
  3.1% conversion by shortening the list. Winning a merge is not a reason to
  lose that.
*/
export const IN_EVERY_PLAN = [
  'Talk through a trade \u2014 it writes itself up',
  'Nova reads every entry and tells you what you keep doing',
  'Your psychology scored on every trade, not just P&L',
  'Your own rules and checklists, checked before you enter',
  'Calendar, analytics and every trade searchable',
  'Weekly and monthly reviews, written for you',
];

/* The specifics a comparison shopper checks, kept but not shouted. */
export const ALSO_INCLUDED =
  'Unlimited trades \u00b7 CSV import \u00b7 Notes \u00b7 14-day money back guarantee';

