/*
  Ask the backend to authorise the trial card, the moment somebody lands back
  from checkout.

  Fire-and-forget from the caller's point of view, with one exception: a
  decline is worth interrupting for. Everything else - already verified, no
  card yet, a bank that wants 3-D Secure - is silence, because there is
  nothing the member could usefully do about any of it.

  The nightly sweep runs the same check for anyone whose browser never made
  this call, so a closed tab delays the answer rather than losing it.
*/

import { supabase } from '../lib/supabase';

export interface TrialCardResult {
  declined: boolean;
  error?: string;
}

export async function verifyTrialCard(): Promise<TrialCardResult> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-trial-card', {
      body: {},
    });

    if (error) {
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (body?.declined === true) {
            return { declined: true, error: String(body.error ?? 'Your card was declined.') };
          }
        } catch {
          /* fall through to the quiet case */
        }
      }
      /*
        Anything that is not an outright decline stays quiet. A trial that
        could not be checked is not a trial that failed, and the sweep will
        try again tonight.
      */
      return { declined: false };
    }

    if (data?.declined === true) {
      return { declined: true, error: String(data.error ?? 'Your card was declined.') };
    }
    return { declined: false };
  } catch {
    return { declined: false };
  }
}
