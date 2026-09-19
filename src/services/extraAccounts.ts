/*
  Buying, changing and dropping extra synced accounts.

  The number sent is absolute - "I want three" rather than "add one". A
  double-tapped button cannot then sell somebody a fourth account, because
  sending 3 twice still means 3, and the number on screen is the number
  Stripe ends up with even if a response goes missing on the way back.

  Price is not passed from here. Which of the two add-on prices applies
  depends on whether the member is billed monthly or annually, and that is
  decided on the server from their existing subscription - a client that
  could name its own price could name a cheaper one.
*/

import { supabase } from '../lib/supabase';

/*
  Both add-on prices, and they must agree with ADDON_PRICE_IDS in
  supabase/functions/_shared/subscriptionSync.ts and the copy of it in
  manage-subscription.

  The annual one exists only because Stripe refuses a subscription holding two
  different intervals. An annual member cannot be sold a monthly add-on, so
  they are sold the annual one - at 10x monthly, the same ratio the three
  tiers already use ($29.99 / $299.90).
*/
export const EXTRA_ACCOUNT_PRICE_MONTHLY = 19;
export const EXTRA_ACCOUNT_PRICE_ANNUAL = 190;

export interface ExtraAccountState {
  extras: number;
  /* 'month' | 'year', straight off the member's own subscription. */
  interval: 'month' | 'year';
}

export interface ExtraAccountsResult {
  ok: boolean;
  extraAccounts?: number;
  /* 'month' | 'year' - what they are billed on, for wording the receipt. */
  interval?: string;
  error?: string;
  /*
    What the card actually did. 'paid' is the ordinary case;
    'requires_action' means the bank wants 3-D Secure and carries the secret
    to confirm it in place; 'failed' means declined. Reported rather than
    assumed, because granting an allowance against an unpaid invoice costs us
    $8.64 a month per account and the member never finds out they owe it.
  */
  payment?: { status: string; clientSecret?: string; hostedInvoiceUrl?: string };
  /*
    The bank is holding the charge for 3-D Secure. Not a failure and not a
    purchase - the caller confirms the card and then asks again.
  */
  pending?: boolean;
}

export async function setExtraSyncedAccounts(quantity: number): Promise<ExtraAccountsResult> {
  try {
    const { data, error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'set_extra_accounts', quantity },
    });

    /*
      Same shape as metaTraderConnect: supabase-js hides the body on a non-2xx
      and the body is where the readable reason lives ("Your subscription
      needs to be active..."). Showing "Edge Function returned a non-2xx
      status code" to somebody who just tried to give us money is the worst
      possible version of this.
    */
    if (error) {
      let message = 'Could not change your accounts.';
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (typeof body?.error === 'string') message = body.error;
        } catch {
          /* keep the generic message */
        }
      }
      return { ok: false, error: message };
    }

    if (data?.error) return { ok: false, error: String(data.error), payment: data?.payment };

    /*
      ok means paid, and nothing else.

      The server now refuses to raise the allowance until the invoice is
      actually settled, so a response that is not a success is not a purchase
      - it is either the bank asking for 3-D Secure (pending) or a decline.
      Treating "the request did not throw" as success is exactly what let an
      unpaid account through before.
    */
    if (data?.success !== true) {
      return {
        ok: false,
        pending: data?.pending === true,
        error: data?.pending === true ? undefined : 'Your card was declined.',
        extraAccounts: typeof data?.extraAccounts === 'number' ? data.extraAccounts : quantity,
        interval: typeof data?.interval === 'string' ? data.interval : undefined,
        payment: data?.payment,
      };
    }

    return {
      ok: true,
      extraAccounts: typeof data?.extraAccounts === 'number' ? data.extraAccounts : quantity,
      interval: typeof data?.interval === 'string' ? data.interval : undefined,
      payment: data?.payment,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not change your accounts.',
    };
  }
}

/*
  How many extras this user already pays for, and on what cycle.

  The count matters so the stepper starts from what they have rather than from
  zero - otherwise somebody who already bought one and wants a second would be
  offered "1", be charged for no change, or have their existing extra removed.

  The interval matters because the panel has to quote the price they will
  actually be charged. Quoting "$19 a month" to an annual member and then
  taking $190 is the kind of surprise that becomes a chargeback, and the
  server picks the annual price for them whether or not the screen said so.
*/
export async function getExtraAccountState(): Promise<ExtraAccountState> {
  const { data } = await supabase
    .from('subscriptions')
    .select('extra_synced_accounts, billing_interval')
    .maybeSingle();
  const row = data as { extra_synced_accounts: number | null; billing_interval: string | null } | null;
  return {
    extras: typeof row?.extra_synced_accounts === 'number' ? row.extra_synced_accounts : 0,
    /*
      Defaults to monthly, which is both the common case and the safe one: a
      member quoted the monthly price and charged the monthly price is right,
      whereas defaulting to annual would quote $190 to somebody who owes $19.
    */
    interval: row?.billing_interval === 'year' ? 'year' : 'month',
  };
}

/*
  Finish a purchase the bank wanted a second factor for.

  Stripe.js does the challenge itself - it opens the issuer's own frame over
  the page, which is the embedded form in the only sense that applies here.
  There is no card to collect: the card is already on file and already
  attached to the invoice, so all that is missing is the tap.
*/
export async function confirmExtraAccountPayment(clientSecret: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);
    if (!stripe) return { ok: false, error: 'Could not reach Stripe.' };

    const { error } = await stripe.confirmCardPayment(clientSecret);
    if (error) return { ok: false, error: error.message ?? 'Your bank did not approve the payment.' };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not confirm the payment.',
    };
  }
}
