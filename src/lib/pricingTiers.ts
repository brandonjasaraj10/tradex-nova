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
    who: 'For one trading account.',
    /*
      Three lines, identical shape in every column, in the same order.

      This replaced a version where each tier had its own sentence structure
      and its own em-dashed aside. It read better and compared worse, which
      is the wrong trade on a pricing table - nobody reads these, they diff
      them. When the columns line up, 1 / 2 / 5 and 1,000 / 3,000 / 8,000 do
      the selling on their own and the eye finds the difference without being
      told what it is.

      What the product actually DOES is not in here on purpose. It is the
      same on every plan, so it sits in IN_EVERY_PLAN below where it is said
      once instead of three times competing with the numbers.
    */
    /*
      Credits a month, not messages a day.

      Monthly because that is the period somebody is billed for, and because
      journalling is bursty - heavy on trading days, a long review on a
      Sunday, nothing for a week. A daily cap is at its tightest during
      exactly the session worth encouraging.

      A credit is not a message: a chat message costs 1, a voice journal
      entry 3, a weekly review 10, a full pattern analysis 25. That is what
      makes it a currency rather than a longer word for "message".

      The SIZE of these comes from what people actually do, not from what
      sounds generous. Across every account that has ever used Nova chat the
      median day is 1 message, the average active day 6.3, and the busiest
      day anybody has ever had is 47; no day has ever passed 100. An earlier
      draft offered 500 a day, roughly eighty times the heaviest day on
      record, which is not generosity - it is a number nobody can read as
      meaning anything. 1,000 a month is about 33 a day, still clear of the
      busiest day ever recorded.

      It also has to survive being used. A message costs around a cent once
      the cached system prompt is counted, so Starter's 1,000 caps exposure
      near $11 against $29.99 of revenue. The 500-a-day version was 15,000 a
      month, or about $165 against the same $29.99.

      THE METERING DOES NOT EXIST YET. nova_chat_rate_limits.day_count is
      still a plain daily tally of messages and nova_daily_limit_for() hands
      out 25 / 100 / 300 by tier, so this page currently advertises an
      allowance nothing enforces, in a period nothing measures. Shipped ahead
      of the build deliberately; the metering has to introduce a monthly
      window and reconcile these numbers with those limits in one change.
    */
    lines: [
      { text: '1 account synced', included: true },
      { text: '1,000 Nova credits a month', included: true },
      { text: 'Unlimited accounts by hand or CSV', included: true },
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
    who: 'For a funded account and your own.',
    lines: [
      { text: '2 accounts synced', included: true },
      { text: '3,000 Nova credits a month', included: true },
      /*
        This line sold extra synced accounts at $19 each, "whenever you want,
        no upgrade call, no waiting". None of that exists: there is no Stripe
        price for an add-on, no way to buy one, and synced_account_limit_for()
        caps hard at the tier's number. Somebody on Pro who needed a third
        account would have gone looking for a button that was never built and
        hit a wall with no path forward.

        Replaced with the line Starter already carries, which is true on every
        plan and keeps the three columns parallel - the comparison is what
        makes them readable, and 1/2/5 against 1,000/3,000/8,000 does the
        selling without a fourth idea competing. Worth building properly later; not
        worth advertising before it is.
      */
      { text: 'Unlimited accounts by hand or CSV', included: true },
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
    who: 'For several funded accounts at once.',
    lines: [
      { text: '5 accounts synced', included: true },
      { text: '8,000 Nova credits a month', included: true },
      { text: 'Priority support', included: true },
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
  'Synced accounts fill their own trades in \u2014 you add the thinking, never the numbers',
  'Talk through a trade \u2014 it writes itself up',
  'Nova reads every entry and tells you what you keep doing',
  'Your psychology scored on every trade, not just P&L',
  'Your own rules and checklists, checked before you enter',
  'Calendar, analytics and every trade searchable',
  'Weekly and monthly reviews, written for you',
];

/* The specifics a comparison shopper checks, kept but not shouted. */
export const ALSO_INCLUDED =
  'Unlimited trades \u00b7 CSV import \u00b7 Notes \u00b7 3 days free to start';

