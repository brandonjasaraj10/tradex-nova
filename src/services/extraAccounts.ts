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

export const EXTRA_ACCOUNT_PRICE_MONTHLY = 19;

export interface ExtraAccountsResult {
  ok: boolean;
  extraAccounts?: number;
  /* 'month' | 'year' - what they are billed on, for wording the receipt. */
  interval?: string;
  error?: string;
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

    if (data?.error) return { ok: false, error: String(data.error) };

    return {
      ok: true,
      extraAccounts: typeof data?.extraAccounts === 'number' ? data.extraAccounts : quantity,
      interval: typeof data?.interval === 'string' ? data.interval : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not change your accounts.',
    };
  }
}

/*
  How many extras this user already pays for, so the stepper starts from
  what they have rather than from zero - otherwise somebody who already
  bought one and wants a second would be offered "1" and quietly be charged
  for no change, or worse, have their existing extra removed.
*/
export async function getExtraSyncedAccounts(): Promise<number> {
  const { data } = await supabase
    .from('subscriptions')
    .select('extra_synced_accounts')
    .maybeSingle();
  const n = (data as { extra_synced_accounts: number | null } | null)?.extra_synced_accounts;
  return typeof n === 'number' ? n : 0;
}
