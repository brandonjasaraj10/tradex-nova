import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { resolveUserIdFromCustomer, syncSubscription } from '../_shared/subscriptionSync.ts';

const appInfo = { name: 'TradeX', version: '1.0.0' } as const;

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { appInfo });

/*
  Optional test-mode counterparts, so a failed payment can be rehearsed
  without touching live billing.

  Stripe's sandboxes are a separate environment: different signing secret,
  different API key, different object ids. Testing previously meant swapping
  the live secret for the sandbox one, which stops real renewals being
  processed for as long as the test runs - not a trade anyone should make.

  Both are optional and everything below falls back to live when they are
  absent, so an environment without them behaves exactly as it did before.
*/
const testWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST');
const testSecretKey = Deno.env.get('STRIPE_SECRET_KEY_TEST');
const stripeTest = testSecretKey ? new Stripe(testSecretKey, { appInfo }) : null;

/*
  Live secret first, so the overwhelmingly common case is one attempt and the
  live path is never affected by a misconfigured test secret. A signature only
  validates against the environment that produced it, so trying both cannot
  make a forged request pass - it just checks the two environments we accept.
*/
async function verifyEvent(body: string, signature: string): Promise<Stripe.Event> {
  const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), testWebhookSecret].filter(Boolean) as string[];
  // Named explicitly rather than throwing whatever the loop last saw, which
  // with no secrets at all would be undefined - an error with no message is
  // the worst thing to meet while payments are failing.
  if (secrets.length === 0) {
    throw new Error('No Stripe webhook signing secret is configured');
  }
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, signature, secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

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
      event = await verifyEvent(body, signature);
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

  /*
    The client has to match the environment the event came from. A test object
    id does not exist to a live key, so looking one up with the wrong client
    fails - and the failure looks like a missing customer rather than a
    configuration mistake, which is a genuinely confusing thing to debug.

    A test event with no test key configured is skipped rather than attempted:
    it can only fail, and trying would write a misleading error into the logs
    of a system that handles real money.
  */
  const client = event.livemode ? stripe : stripeTest;
  if (!client) {
    console.warn(`Ignoring ${event.type}: test-mode event received but STRIPE_SECRET_KEY_TEST is not set`);
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
      subscription = await client.subscriptions.retrieve(subscriptionId);
      userId = session.metadata?.supabase_user_id ?? subscription.metadata?.supabase_user_id ?? null;
    } else {
      subscription = event.data.object as Stripe.Subscription;
      userId = subscription.metadata?.supabase_user_id ?? null;
    }

    if (!userId) {
      userId = await resolveUserIdFromCustomer(client, supabase, subscription.customer);
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
