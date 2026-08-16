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
export async function syncSubscription(supabase: SupabaseClient, userId: string, subscription: Stripe.Subscription) {
  const record = {
    stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const previousStatus = (existing as { status: string } | null)?.status ?? null;

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
