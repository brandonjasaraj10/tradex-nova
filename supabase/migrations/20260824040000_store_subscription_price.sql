/*
  # Store what the subscription actually costs

  Settings hard-coded "$24.99/mo" in the plan card. Founder subscribers pay
  $14.99, so the one screen someone checks after paying told them the wrong
  price - and there was no way to render the right one, because the row held
  no price at all.

  Stripe already sends the price on every subscription event; syncSubscription
  simply never wrote it down. These three columns come straight off the
  subscription item, so the screen can state what Stripe is actually charging
  rather than what the pricing page said when the markup was written.
*/

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS unit_amount integer,
  ADD COLUMN IF NOT EXISTS billing_interval text;

COMMENT ON COLUMN subscriptions.unit_amount IS
  'Price actually charged, in cents, as reported by Stripe. Settings used to hard-code $24.99, so a founder paying $14.99 was shown the wrong number on the screen they check after paying.';
