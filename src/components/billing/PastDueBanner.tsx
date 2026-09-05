import { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

/*
  Shown only while a failed payment is inside its grace period.

  Access continues for seven days after a card fails, and until now nothing in
  the app said so. Someone whose payment bounced kept using TradeX normally
  and then lost access with no warning they had seen - the only notice was an
  email and an in-app notification behind the bell.

  Deliberately not dismissible. A banner you can close is one you will close,
  and the cost of missing this one is losing your journal history's
  availability at the end of the week. It disappears on its own the moment the
  payment succeeds, because gracePeriodEnd goes null.
*/
export default function PastDueBanner() {
  const { gracePeriodEnd } = useAuth();
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!gracePeriodEnd) return null;

  // Rounded up and floored at one, matching the email exactly - the two must
  // never disagree about how long is left.
  const daysLeft = Math.max(
    1,
    Math.ceil((gracePeriodEnd.getTime() - Date.now()) / 86400000)
  );

  /*
    Straight into Stripe's own portal rather than a page that explains how to
    get there. The fewer steps between "my card failed" and a working card,
    the more of these recover.
  */
  async function openBillingPortal() {
    setOpening(true);
    setFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'create_portal_session' },
      });
      if (error || !data?.url) throw error ?? new Error('No portal URL returned');
      window.location.href = data.url;
    } catch {
      // Settings has its own working path to the portal, so a failure here
      // is a detour rather than a dead end.
      setFailed(true);
      setOpening(false);
    }
  }

  return (
    <div
      role="status"
      className="border-b border-amber-400/25 bg-amber-500/10"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="text-sm text-white">
            <span className="font-semibold">Your last payment didn&rsquo;t go through.</span>{' '}
            <span className="text-gray-300">
              Your account stays open for {daysLeft} more {daysLeft === 1 ? 'day' : 'days'}.
            </span>
          </p>
          {failed && (
            <p className="text-xs text-gray-400 mt-1">
              Couldn&rsquo;t open the billing portal. You can also update your card from Settings.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openBillingPortal}
          disabled={opening}
          className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/25 transition-colors disabled:opacity-60"
        >
          {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {opening ? 'Opening…' : 'Update payment method'}
          {!opening && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
