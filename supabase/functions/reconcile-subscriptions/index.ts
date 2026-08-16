import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { syncSubscription } from '../_shared/subscriptionSync.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  appInfo: { name: 'TradeX', version: '1.0.0' },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/*
  Defensive drift correction: the webhook keeps subscriptions in sync in
  real time, but webhook delivery isn't guaranteed (Stripe retries and
  eventually gives up; a deploy or outage at the wrong moment can miss an
  event). This re-checks every subscription we know about against Stripe's
  actual state on a schedule, using the exact same sync logic the webhook
  uses, so drift can't silently persist forever.
*/
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('X-Cron-Secret');
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: rows, error } = await supabase
      .from('subscriptions')
      .select('user_id, stripe_subscription_id')
      .not('stripe_subscription_id', 'is', null);

    if (error) throw error;

    let checked = 0;
    let corrected = 0;
    const errors: string[] = [];

    for (const row of (rows ?? []) as { user_id: string; stripe_subscription_id: string }[]) {
      checked++;
      try {
        const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
        const result = await syncSubscription(supabase, row.user_id, subscription);
        if (result.changed) {
          corrected++;
          console.info(
            `Reconciliation corrected drift for user ${row.user_id}: ${result.previousStatus} -> ${result.newStatus}`,
          );
        }
      } catch (err) {
        errors.push(`${row.stripe_subscription_id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return Response.json({ checked, corrected, errors });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
