/*
  What a user's plan lets them sync, and how to unlock more of it.

  Two things, because the panel that asks needs both: whether they are still
  on the trial (which syncs nothing at all), and a way to end that trial early
  for somebody who wants their trades arriving tonight rather than in two
  days.

  This file used to sell the $19 add-on as well. That came out: it was a
  second thing to buy at the exact moment somebody is already deciding whether
  to buy the first, and a plan they understand beats an add-on they have to
  reason about. The Stripe prices and the server action still exist, so it can
  come back without rebuilding anything.
*/

import { supabase } from '../lib/supabase';

export interface SyncAccessState {
  /*
    Trials have no synced accounts at all, so this decides whether somebody
    is offered their subscription or a bigger plan.
  */
  onTrial: boolean;
}

export async function getSyncAccessState(): Promise<SyncAccessState> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .maybeSingle();
  const row = data as { status: string | null } | null;
  return { onTrial: row?.status === 'trialing' };
}

/*
  End the trial and start paying, so syncing turns on now.

  Stripe closes the trial, raises the first invoice and moves the subscription
  to active. If the card fails it lands on past_due instead, and the server
  reports that rather than pretending it worked - so a failed charge cannot
  leave somebody looking subscribed.

  They chose their plan at signup, so there is nothing to pick here. This only
  brings the first charge forward.
*/
export async function startSubscriptionNow(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'start_subscription_now' },
    });

    if (error) {
      let message = 'Could not start your subscription.';
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

    if (data?.success === true) return { ok: true };
    return { ok: false, error: String(data?.error ?? 'Could not start your subscription.') };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not start your subscription.',
    };
  }
}
