import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

type SupabaseClient = ReturnType<typeof createClient>;

// Falls back to the Stripe customer's own metadata, then to whatever
// customer id is already on file for a user, in case subscription-level
// metadata is ever missing (e.g. a subscription created before this
// metadata convention existed).
export async function resolveUserIdFromCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | null> {
  const customerId = typeof customer === 'string' ? customer : customer.id;

  const stripeCustomer = await stripe.customers.retrieve(customerId);
  if (!('deleted' in stripeCustomer && stripeCustomer.deleted) && (stripeCustomer as Stripe.Customer).metadata?.supabase_user_id) {
    return (stripeCustomer as Stripe.Customer).metadata.supabase_user_id;
  }

  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  return (data as { user_id: string } | null)?.user_id ?? null;
}

/*
  The app's paywall (has_active_subscription(), checkSubscriptionAccess(),
  every RLS policy on paid tables) reads exclusively from the `subscriptions`
  table, keyed by user_id. This is the single place that writes to it from
  Stripe data - used by both the real-time webhook and the periodic
  reconciliation job, so both stay behaviorally identical by construction
  rather than by two hand-kept-in-sync implementations.
*/
const GRACE_PERIOD_DAYS = 7;

/*
  The grace-period rule, kept separate so it can be reasoned about and tested
  without a Stripe fixture or a database.

  Three cases:
  - past_due and no window open yet -> start one, GRACE_PERIOD_DAYS out.
  - past_due with a window already open -> leave it exactly as it is. Stripe
    fires an event per retry attempt, so recomputing here would push the
    deadline out on every failure and the grace period would never end.
  - anything else -> clear it. A recovered card, a cancellation and a fresh
    subscription all need the column empty, or a stale deadline would keep
    granting access to somebody who is no longer past_due.
*/
export function resolveGracePeriodEnd(
  status: string,
  existing: { status: string; grace_period_end: string | null } | null,
  now: Date = new Date()
): string | null {
  if (status !== 'past_due') return null;
  if (existing?.status === 'past_due' && existing.grace_period_end) {
    return existing.grace_period_end;
  }
  return new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function syncSubscription(supabase: SupabaseClient, userId: string, subscription: Stripe.Subscription) {
  const { data: current, error: lookupError } = await supabase
    .from('subscriptions')
    .select('status, grace_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  /*
    Thrown, not swallowed. A failed lookup is indistinguishable from "no row
    yet", which would make this insert over a subscription that already
    exists and restart a grace period that was already running.
  */
  if (lookupError) throw lookupError;

  const existingRow = current as { status: string; grace_period_end: string | null } | null;
  const gracePeriodEnd = resolveGracePeriodEnd(subscription.status, existingRow);

  const record = {
    stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    /*
      What Stripe is actually charging, so the app never has to guess.

      Settings hard-coded $24.99, which was wrong for every founder-price
      subscriber - the exact screen they look at after paying. Stripe sends
      this on every event; it was simply never stored.
    */
    stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
    unit_amount: subscription.items.data[0]?.price?.unit_amount ?? null,
    billing_interval: subscription.items.data[0]?.price?.recurring?.interval ?? null,
    /*
      How long a failed payment keeps access before it is cut off.

      has_active_subscription() has always honoured this column, auth.tsx
      reads it, and subscriptionService has passing tests for it - but nothing
      ever wrote it, so it was null on every row and past_due meant instant
      lockout. One real subscriber went active at 06:41 and lost access at
      07:41 when the card failed an hour later, with no window to fix it.

      Written here rather than in the webhook because reconciliation shares
      this function, so a status Stripe reports late gets the same window as
      one reported in real time.

      Preserved, not extended, while already past_due: Stripe sends an event
      per retry, and recomputing the deadline each time would push it further
      out with every failure and never actually expire.
    */
    grace_period_end: gracePeriodEnd,
    updated_at: new Date().toISOString(),
  };

  const existing = existingRow;
  const previousStatus = existing?.status ?? null;

  if (existing) {
    const { error } = await supabase.from('subscriptions').update(record).eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('subscriptions').insert({ user_id: userId, ...record });
    if (error) throw error;
  }

  const changed = previousStatus !== subscription.status;
  if (changed) {
    await notifyStatusChange(supabase, userId, previousStatus, subscription.status);
  }

  console.info(`Synced subscription ${subscription.id} (${subscription.status}) for user ${userId}`);
  return { previousStatus, newStatus: subscription.status, changed };
}

// Only notify on transitions that actually matter to the user - not every
// sync (Stripe sends customer.subscription.updated for plenty of changes,
// like metadata, that shouldn't page anyone; reconciliation runs on a
// schedule regardless of whether anything actually changed).
async function notifyStatusChange(supabase: SupabaseClient, userId: string, previousStatus: string | null, newStatus: string) {
  let title: string | null = null;
  let message: string | null = null;
  let type: 'success' | 'warning' | 'info' = 'info';

  if (newStatus === 'active' && previousStatus !== 'active') {
    title = 'Subscription active';
    message = 'Your TradeX subscription is now active. Welcome aboard!';
    type = 'success';
  } else if (newStatus === 'past_due') {
    title = 'Payment failed';
    message = 'Your last payment did not go through. Please update your payment method to keep your subscription active.';
    type = 'warning';
  } else if (newStatus === 'canceled') {
    title = 'Subscription canceled';
    message = 'Your TradeX subscription has been canceled.';
    type = 'info';
  }

  if (!title || !message) return;

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
  });

  if (error) {
    console.error('Failed to create subscription notification:', error);
  }
}
