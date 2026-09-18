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
  /*
    The live Stripe prices this tier sells, by billing interval.

    Kept beside the copy rather than in six environment variables, because a
    price id is a public identifier, not a secret - it ships in the frontend
    bundle either way. Putting them here means the price a customer reads and
    the price they are charged come from one file, and a missing Vercel
    variable can no longer silently break checkout for one tier.
  */
  priceIds: { monthly: string; annual: string };
};

export const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$29.99',
    who: 'The account you actually trade.',
    lines: [
      { text: 'One account logs its own trades \u2014 you write the thinking, never the numbers', included: true },
      { text: 'Ask Nova 25 times a day what your own numbers actually say', included: true },
      { text: 'Journal any other account by hand or CSV, as many as you like', included: true },
    ],
    cta: 'Start journaling',
    priceIds: {
      monthly: 'price_1UGqG0P9mqFWeYrvtPMZvsk6',
      annual: 'price_1UGqFzP9mqFWeYrvwxpKrL7T',
    },
  },
  {
    name: 'Pro',
    price: '$49.99',
    who: 'Your funded account and your own.',
    lines: [
      { text: 'Two accounts log their own trades \u2014 prop and personal, neither one typed', included: true },
      { text: '100 questions a day \u2014 four times Starter, past what most people use', included: true },
      { text: 'Need a third? $19, on the spot \u2014 no upgrade, no email', included: true },
    ],
    cta: 'Start journaling',
    featured: true,
    priceIds: {
      monthly: 'price_1UGqGwP9mqFWeYrvzMUUTkyY',
      annual: 'price_1UGqGwP9mqFWeYrvkph5vtn3',
    },
  },
  {
    name: 'Elite',
    price: '$99.99',
    who: 'Several funded accounts, where a missed day is real money.',
    lines: [
      { text: 'Five accounts log their own trades \u2014 cheaper than Pro plus three add-ons', included: true },
      { text: '300 questions a day \u2014 you will not reach it', included: true },
      { text: 'Your support goes to the front of the queue', included: true },
    ],
    cta: 'Start journaling',
    priceIds: {
      monthly: 'price_1UGqq1P9mqFWeYrvfkgvSpDn',
      annual: 'price_1UGqrcP9mqFWeYrvwfanVeKY',
    },
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

