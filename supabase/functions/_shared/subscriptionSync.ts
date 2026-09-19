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

/*
  There is no grace period. A failed card stops access at the decline, and it
  comes back when the card is fixed.

  This function is kept, rather than the column simply being dropped, because
  grace_period_end still exists on the table and must be actively cleared:
  a stale deadline left behind would go on granting access to somebody whose
  payment is failing. Returning null unconditionally is what does that.
*/
export function resolveGracePeriodEnd(): string | null {
  return null;
}

/*
  Global endpoint, not regional - see the note in mt-servers/index.ts.
*/
const PROVISIONING_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

/*
  Stop paying MetaApi for accounts belonging to somebody who is no longer a
  subscriber.

  MetaApi bills per connected account for as long as it exists in their
  cloud, and none of that stops on its own. Without this, a cancelled
  customer's connections keep running and keep charging us - a cost with no
  revenue behind it and nobody using it, which is the worst kind because
  nothing surfaces it until the invoice.

  Stopping, never deleting:

    no longer paying (past_due, canceled, unpaid, incomplete_expired) ->
    undeploy. The account stops running, which takes it from about $9 a
    month to about $0.77, but it stays registered with MetaApi.

    paying again (active, trialing) -> deploy. Syncing resumes on its own,
    with nothing to re-enter. Without this the undeploy above would be a
    silent one-way door: the subscriber pays, gets their access back, and
    their trades quietly never sync again.

  Cancelling used to delete. It was changed because we deliberately never
  store the investor password, so deleting means the trader has to find it
  again to come back - and people who cancel a trading journal frequently do
  come back. TradeZella's own documentation says unlinking a broker "does not
  delete any existing trades. It only removes the connection for future
  syncs", and keeping the connection is the same promise one step further.

  The cost of that choice is about $0.77 a month per churned account,
  accumulating quietly. The point at which it stops being worth it is a
  dormancy sweep - delete accounts stopped for, say, six months - not a
  deletion at the moment somebody cancels.

  Never allowed to break the subscription sync. What Stripe says is true
  about a subscription matters far more than our housekeeping at a third
  party, so every failure here is caught and logged.
*/
async function applyBrokerSyncPolicy(
  supabase: SupabaseClient,
  userId: string,
  status: string,
) {
  const token = Deno.env.get('METAAPI_TOKEN');
  if (!token) return;

  const resume = status === 'active' || status === 'trialing';
  const stop = ['past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(status);
  if (!stop && !resume) return;

  try {
    const { data, error } = await supabase
      .from('broker_connections')
      .select('id, metaapi_account_id')
      .eq('user_id', userId)
      .not('metaapi_account_id', 'is', null);

    if (error) {
      console.error('Could not read broker connections for', userId, error);
      return;
    }

    const connections = (data ?? []) as { id: string; metaapi_account_id: string }[];
    if (connections.length === 0) return;

    for (const connection of connections) {
      const base = `${PROVISIONING_URL}/users/current/accounts/${connection.metaapi_account_id}`;
      const auth = { 'auth-token': token };

      try {
        if (resume) {
          const res = await fetch(`${base}/deploy`, { method: 'POST', headers: auth });
          if (!res.ok) {
            console.error('Could not resume', connection.metaapi_account_id, await res.text());
          }
          continue;
        }

        const res = await fetch(`${base}/undeploy`, { method: 'POST', headers: auth });
        if (!res.ok) {
          console.error('Could not stop', connection.metaapi_account_id, await res.text());
        }

        /*
          metaapi_account_id is deliberately kept. It is what lets the
          account start again untouched when they resubscribe, and it is
          also the only pointer to something still costing us $0.77 a month
          - losing it would make that charge invisible.
        */
      } catch (err) {
        console.error('Broker sync policy failed for connection', connection.id, err);
      }
    }

    console.info(
      `Broker sync policy applied for ${userId} (${status}): ${connections.length} connection(s)`,
    );
  } catch (err) {
    console.error('Broker sync policy failed for', userId, err);
  }
}

const APP_URL = 'https://tradexnova.com';
const SUPPORT_EMAIL = 'tradenovaai@gmail.com';

/*
  The email that actually reaches somebody whose card has failed.

  An in-app notification was already written on past_due, and it is the wrong
  channel on its own: seeing it means logging into the product they have just
  been locked out of. One real subscriber got that notification, never came
  back, and it is still unread. Email is the only channel that reaches a
  person who has stopped visiting.

  Dark, matching the app and the other TradeX emails. Every background carries
  a bgcolor attribute as well as an inline style, because some clients strip
  styles and would otherwise render light text on white.

  The logo is the real mark, served from www because the bare domain
  308-redirects there and some clients will not follow a redirect for an
  image. Alt text is white so a reader who blocks images still sees the word.
*/
const LOGO_URL = 'https://www.tradexnova.com/tradex_logo.png';
function buildPaymentFailedHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">

        <tr><td align="center" style="padding-bottom:32px;">
          <img src="${LOGO_URL}" width="72" height="72" alt="TradeX"
               style="display:block;border:0;outline:none;text-decoration:none;color:#ffffff;font-size:22px;font-weight:700;">
        </td></tr>

        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0A0A0A" style="background-color:#0A0A0A;border:1px solid #1f1f1f;border-radius:14px;">
            <tr><td style="padding:36px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Your last payment didn&rsquo;t go through</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#8b8b8b;">Your bank declined the charge. This happens most often with an expired card or a new card number &mdash; it usually is not a problem with your account.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0d1a2f" style="background-color:#0d1a2f;border:1px solid #1e3a5f;border-radius:10px;margin-bottom:24px;">
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#ffffff;"><strong>Your access is paused until your card is updated.</strong></p>
                  <p style="margin:6px 0 0 0;font-size:14px;line-height:1.6;color:#8b8b8b;">Nothing is deleted. Update your card and everything comes straight back.</p>
                </td></tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td align="center" bgcolor="#3B82F6" style="background-color:#3B82F6;border-radius:10px;">
                  <a href="${APP_URL}/settings" style="display:block;padding:15px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Update your payment method</a>
                </td></tr>
              </table>

              <p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#8b8b8b;">Already fixed it, or think this is a mistake? Reply to this email and a human will look.</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:28px 0 0 0;">
          <p style="margin:0;font-size:12px;color:#6b6b6b;">You&rsquo;re getting this because your TradeX subscription payment failed.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/*
  Never allowed to break the sync.

  This runs inside the webhook's event handler. An email provider having a bad
  day must not stop the subscriptions table being updated - the record of what
  Stripe says is true is far more important than the notification about it.
  Everything here is caught and logged.
*/
async function sendPaymentFailedEmail(
  supabase: SupabaseClient,
  userId: string,
) {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY missing - payment failure email not sent for', userId);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userError || !email) {
      console.error('Could not resolve an email for', userId, userError);
      return;
    }

    /*
      No figure in the email, on purpose.

      This used to print price.unit_amount off the subscription, which is the
      list price of the plan and not what Stripe actually tried to take. A
      proration, a partial credit, tax, or any discount makes the two differ,
      and it read "$24.99" to an annual subscriber whose real charge was
      $249.90. A wrong number in a billing email is worse than no number - it
      is the thing a worried customer checks first, and getting it wrong is
      how a real charge starts looking like a scam.

      Fetching the true figure means pulling the latest invoice, which this
      handler does not have. The card is what needs attention either way, and
      the exact amount is one click away in the billing portal.
    */
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'TradeX <noreply@tradexnova.com>',
        to: [email],
        reply_to: [SUPPORT_EMAIL],
        subject: 'Your TradeX payment failed - update your card to restore access',
        html: buildPaymentFailedHtml(),
      }),
    });

    if (!res.ok) {
      console.error('Payment failure email rejected for', email, await res.text());
      return;
    }

    console.info('Payment failure email sent to', email);
  } catch (err) {
    console.error('Payment failure email failed for', userId, err);
  }
}

/*
  Which tier a Stripe price sells.

  Until this existed, plan_type was never written by anything - the webhook
  stored stripe_price_id and stopped there. subscription_tier_for() falls back
  to 'pro' when plan_type is null, which meant every paying subscriber got
  Pro's allowance whatever they had actually bought: a Starter customer at
  $29.99 received the two synced accounts Pro charges $49.99 for, and an Elite
  customer at $99.99 received two instead of five.

  The first direction costs real money - a synced account is about $8.64 a
  month in MetaApi hosting - and the second is worse, because it silently
  under-delivers to the people paying most.

  Mapped from the price id rather than the amount. The amount changes with
  discounts, coupons, proration and tax; the id is what the customer actually
  bought and never moves.
*/
const TIER_BY_PRICE_ID: Record<string, string> = {
  /* Starter - monthly, annual */
  price_1UGqG0P9mqFWeYrvtPMZvsk6: 'starter',
  price_1UGqFzP9mqFWeYrvwxpKrL7T: 'starter',
  /* Pro */
  price_1UGqGwP9mqFWeYrvzMUUTkyY: 'pro',
  price_1UGqGwP9mqFWeYrvkph5vtn3: 'pro',
  /* Elite */
  price_1UGqq1P9mqFWeYrvfkgvSpDn: 'elite',
  price_1UGqrcP9mqFWeYrvwfanVeKY: 'elite',

  /*
    The plans sold before tiers existed, mapped to their own 'legacy' tier.

    Starter in every way that costs money - one synced account, because sync
    did not exist when they subscribed and one is what $24.99 supports - and
    Pro in the one way that was already theirs: 100 Nova questions a day
    rather than Starter's 25. The pricing page promised twice that nothing
    they already had would move behind a higher tier, and keeping that costs
    nothing.

    See 20260919060000_put_existing_members_on_a_tier.sql, which defines the
    tier and must agree with this map.
  */
  price_1ScJiLP9mqFWeYrvAf1mt8kh: 'legacy',  /* $24.99 monthly  */
  price_1ScyAlP9mqFWeYrvEAo0WOhT: 'legacy',  /* $249.90 annual  */
  price_1U6eAKP9mqFWeYrv2D7cKdz6: 'legacy',  /* $14.99 founder  */
};

/*
  An unrecognised price returns null, which leaves plan_type alone rather than
  overwriting it. A price id this file has not been told about is far more
  likely to be a new plan nobody has mapped yet than a reason to demote
  somebody, and subscription_tier_for()'s own 'pro' fallback already covers
  the null case generously. Erring toward the customer is the right error
  here; it shows up on an invoice, not in a support ticket.
*/
function tierForPrice(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  return TIER_BY_PRICE_ID[priceId] ?? null;
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
    exists and lose the status it was in.
  */
  if (lookupError) throw lookupError;

  const existingRow = current as { status: string; grace_period_end: string | null } | null;
  /*
    Always null now. Written on every sync rather than left alone, so any
    deadline surviving from the old policy is cleared the next time Stripe
    tells us anything about that subscription.
  */
  const gracePeriodEnd = resolveGracePeriodEnd();

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
      Spread rather than set, so an unmapped price leaves whatever plan_type
      is already on the row instead of nulling it. See tierForPrice above.
    */
    ...(tierForPrice(subscription.items.data[0]?.price?.id)
      ? { plan_type: tierForPrice(subscription.items.data[0]?.price?.id) }
      : {}),
    /*
      Always null. Kept as a column, and written on every sync, purely so a
      deadline from the old policy is cleared rather than left sitting there.

      It used to hold a seven-day window. That was withdrawn on 10 September
      after the first trial cohort reached a charge: a failed card now ends
      access at the decline. The enforcement lives in
      has_active_subscription(), which no longer looks at this column at all -
      writing null here is belt and braces, not the rule itself.
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

    /*
      Only on the transition into past_due, never on the retries that follow.

      Stripe fires an event for every retry attempt, and `changed` is what
      keeps this to one email rather than one per attempt. Somebody whose card
      is failing is already having a bad day; mailing them four times about
      the same decline is how a useful warning becomes spam.
    */
    if (subscription.status === 'past_due') {
      await sendPaymentFailedEmail(supabase, userId);
    }

    await applyBrokerSyncPolicy(supabase, userId, subscription.status);
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
