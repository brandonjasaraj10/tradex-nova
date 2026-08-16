import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'TradeX',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

const RELEVANT_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/*
  The app's paywall (has_active_subscription(), checkSubscriptionAccess(),
  every RLS policy on paid tables) reads exclusively from the `subscriptions`
  table, keyed by user_id. That's the only table that matters here - this
  handler's job is to keep it in sync with what's actually true in Stripe,
  for every subscription lifecycle event, automatically, with no user action
  required.
*/
async function handleEvent(event: Stripe.Event) {
  if (!RELEVANT_EVENTS.has(event.type)) {
    return;
  }

  try {
    let subscription: Stripe.Subscription;
    let userId: string | null = null;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== 'subscription' || !session.subscription) {
        return;
      }

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      userId = session.metadata?.supabase_user_id ?? subscription.metadata?.supabase_user_id ?? null;
    } else {
      subscription = event.data.object as Stripe.Subscription;
      userId = subscription.metadata?.supabase_user_id ?? null;
    }

    if (!userId) {
      userId = await resolveUserIdFromCustomer(subscription.customer);
    }

    if (!userId) {
      console.error(
        `Could not resolve a TradeX user for Stripe subscription ${subscription.id} (customer ${
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        }) - skipping sync`,
      );
      return;
    }

    await syncSubscription(userId, subscription);
  } catch (error) {
    console.error(`Failed to process event ${event.id} (${event.type}):`, error);
    throw error;
  }
}

// Falls back to the Stripe customer's own metadata, then to whatever
// customer id is already on file for a user, in case subscription-level
// metadata is ever missing (e.g. a subscription created before this
// metadata convention existed).
async function resolveUserIdFromCustomer(
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

  return data?.user_id ?? null;
}

async function syncSubscription(userId: string, subscription: Stripe.Subscription) {
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

  const previousStatus = existing?.status ?? null;

  if (existing) {
    const { error } = await supabase.from('subscriptions').update(record).eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('subscriptions').insert({ user_id: userId, ...record });
    if (error) throw error;
  }

  if (previousStatus !== subscription.status) {
    await notifyStatusChange(userId, previousStatus, subscription.status);
  }

  console.info(`Synced subscription ${subscription.id} (${subscription.status}) for user ${userId}`);
}

// Only notify on transitions that actually matter to the user - not every
// webhook fire (Stripe sends customer.subscription.updated for plenty of
// changes, like metadata, that shouldn't page anyone).
async function notifyStatusChange(userId: string, previousStatus: string | null, newStatus: string) {
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
