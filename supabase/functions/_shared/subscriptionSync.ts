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

const APP_URL = 'https://tradexnova.com';
const SUPPORT_EMAIL = 'tradenovaai@gmail.com';

/*
  The email that actually reaches somebody whose card has failed.

  An in-app notification was already written on past_due, and it is the wrong
  channel on its own: seeing it means logging into the product they have just
  been locked out of. One real subscriber got that notification, never came
  back, and it is still unread. Email is the only channel that reaches a
  person who has stopped visiting.

  Built like the welcome email deliberately - mid-tone colours that survive
  Gmail's dark-mode inversion, a table-drawn logo because most clients block
  remote images, and a real reply-to so a confused customer reaches a human.
*/
function buildPaymentFailedHtml(daysLeft: number, amountLabel: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">

        <tr><td align="center" style="padding-bottom:32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td valign="middle" style="padding-right:4px;"><div style="width:4px;height:22px;background-color:#3B82F6;border-radius:2px;font-size:0;line-height:22px;">&nbsp;</div></td>
            <td valign="middle" style="padding-right:4px;"><div style="width:4px;height:30px;background-color:#3B82F6;border-radius:2px;font-size:0;line-height:30px;">&nbsp;</div></td>
            <td valign="middle" style="padding-right:12px;"><div style="width:4px;height:14px;background-color:#3B82F6;border-radius:2px;font-size:0;line-height:14px;">&nbsp;</div></td>
            <td valign="middle"><span style="font-size:26px;font-weight:700;letter-spacing:-0.5px;color:#111111;">TradeX</span></td>
          </tr></table>
        </td></tr>

        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border:1px solid #e2e2e2;border-radius:14px;">
            <tr><td style="padding:36px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:21px;font-weight:700;color:#111111;letter-spacing:-0.3px;">Your last payment didn&rsquo;t go through</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555555;">We tried to charge ${amountLabel} and your bank declined it. This happens most often with an expired card or a new card number &mdash; it usually is not a problem with your account.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F5F8FF;border:1px solid #D6E4FF;border-radius:10px;margin-bottom:24px;">
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#111111;"><strong>Your account stays open for ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}.</strong></p>
                  <p style="margin:6px 0 0 0;font-size:14px;line-height:1.6;color:#555555;">Nothing is deleted. Update your card before then and everything carries on as normal.</p>
                </td></tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td align="center" style="background-color:#3B82F6;border-radius:10px;">
                  <a href="${APP_URL}/settings" style="display:block;padding:15px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Update your payment method</a>
                </td></tr>
              </table>

              <p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#555555;">Already fixed it, or think this is a mistake? Reply to this email and a human will look.</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:28px 0 0 0;">
          <p style="margin:0;font-size:12px;color:#777777;">You&rsquo;re getting this because your TradeX subscription payment failed.</p>
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
  gracePeriodEnd: string | null,
  subscription: Stripe.Subscription,
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

    // Rounded up, and never below one: telling somebody they have 0 days left
    // while they still have access reads as though it is already too late.
    const daysLeft = gracePeriodEnd
      ? Math.max(1, Math.ceil((new Date(gracePeriodEnd).getTime() - Date.now()) / 86400000))
      : 7;

    const amount = subscription.items.data[0]?.price?.unit_amount;
    const currency = (subscription.items.data[0]?.price?.currency ?? 'usd').toUpperCase();
    // Falls back to wording that is true whatever the plan, rather than
    // inventing a figure - a wrong amount in a billing email is worse than none.
    const amountLabel = amount != null ? `$${(amount / 100).toFixed(2)} ${currency}` : 'your subscription';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'TradeX <noreply@tradexnova.com>',
        to: [email],
        reply_to: [SUPPORT_EMAIL],
        subject: `Your TradeX payment failed - ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to update your card`,
        html: buildPaymentFailedHtml(daysLeft, amountLabel),
      }),
    });

    if (!res.ok) {
      console.error('Payment failure email rejected for', email, await res.text());
      return;
    }

    console.info('Payment failure email sent to', email, `(${daysLeft} days left)`);
  } catch (err) {
    console.error('Payment failure email failed for', userId, err);
  }
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

    /*
      Only on the transition into past_due, never on the retries that follow.

      Stripe fires an event for every retry attempt, and `changed` is what
      keeps this to one email rather than one per attempt. Somebody whose card
      is failing is already having a bad day; mailing them four times about
      the same decline is how a useful warning becomes spam.
    */
    if (subscription.status === 'past_due') {
      await sendPaymentFailedEmail(supabase, userId, gracePeriodEnd, subscription);
    }
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
