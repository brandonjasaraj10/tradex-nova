import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { resolveUserIdFromCustomer, syncSubscription } from '../_shared/subscriptionSync.ts';

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
      userId = await resolveUserIdFromCustomer(stripe, supabase, subscription.customer);
    }

    if (!userId) {
      console.error(
        `Could not resolve a TradeX user for Stripe subscription ${subscription.id} (customer ${
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        }) - skipping sync`,
      );
      return;
    }

    await syncSubscription(supabase, userId, subscription);
  } catch (error) {
    console.error(`Failed to process event ${event.id} (${event.type}):`, error);
    throw error;
  }
}
