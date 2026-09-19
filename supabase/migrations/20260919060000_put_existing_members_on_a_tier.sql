/*
  Give every existing subscription an explicit tier.

  plan_type has been null on every Stripe-created row since the table existed,
  because nothing ever wrote it - the webhook stored stripe_price_id and
  stopped. subscription_tier_for() treats null as 'pro', so until now that was
  invisible: there was one plan and one allowance, and the fallback happened to
  be right for everybody.

  Tiers end that. A null plan_type now means Pro's allowance - two synced
  accounts and 100 Nova questions a day - handed to whoever happens to hold a
  subscription row, whatever they paid. At roughly $8.64 a month in MetaApi
  hosting per synced account, the second one is a real bill against revenue
  that was never charged for it.

  So the rows are filled in from the price each subscription actually holds,
  using the same mapping the webhook now applies going forward
  (_shared/subscriptionSync.ts). Doing it in both places is deliberate: this
  migration fixes the rows that exist today, and the webhook keeps every row
  created after it correct without another migration.

  The three live paying members are all on the $24.99 monthly price and all
  become Starter. That is not a downgrade:

    - Their price does not change. Nothing here touches Stripe, and the
      promise made twice on the pricing page - the rate you join at is the
      rate you keep - is kept literally.
    - Nothing is taken away. Accounts added by hand or imported from a CSV
      stay unlimited on every tier, which is all they have ever had. Broker
      sync did not exist when they subscribed.
    - They gain one synced account they did not have yesterday.

  Nobody needs to do anything on their end, and nobody is emailed about it.
*/

UPDATE subscriptions SET plan_type = 'starter'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1ScJiLP9mqFWeYrvAf1mt8kh',  /* $24.99 monthly - the live members */
    'price_1ScyAlP9mqFWeYrvEAo0WOhT',  /* $249.90 annual                    */
    'price_1U6eAKP9mqFWeYrv2D7cKdz6',  /* $14.99 founder                    */
    'price_1UGqG0P9mqFWeYrvtPMZvsk6',  /* Starter monthly                   */
    'price_1UGqFzP9mqFWeYrvwxpKrL7T'   /* Starter annual                    */
  );

UPDATE subscriptions SET plan_type = 'pro'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1UGqGwP9mqFWeYrvzMUUTkyY',
    'price_1UGqGwP9mqFWeYrvkph5vtn3'
  );

UPDATE subscriptions SET plan_type = 'elite'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1UGqq1P9mqFWeYrvfkgvSpDn',
    'price_1UGqrcP9mqFWeYrvwfanVeKY'
  );

/*
  Rows with no Stripe price at all are the comped and manually-inserted ones -
  the test accounts and the few people given access by hand. They keep the
  'pro' they already carry; there is no price to read and no reason to change
  what somebody was deliberately granted.

  Left deliberately unmapped: any price id not listed above. Those rows keep
  plan_type null and go on getting subscription_tier_for()'s 'pro' fallback,
  which is the generous answer. A price this migration has not heard of is
  almost certainly one nobody has mapped yet, and demoting a paying customer
  over our own bookkeeping gap is the worse of the two mistakes.
*/
