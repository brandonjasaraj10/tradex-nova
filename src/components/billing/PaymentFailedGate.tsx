import { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

/*
  What a subscriber sees when their card has failed and access has stopped.

  This exists because of what would otherwise happen. Without a grace period,
  a failed payment blocks access straight away and the app sends the user to
  the paywall - the same paywall a stranger sees. Someone who has been paying
  for months would be shown a grid of plans as though they had never
  subscribed, and picking one would open a *second* Stripe subscription
  alongside the broken one. Two subscriptions, two charges, and a support
  conversation that starts from a bad place.

  So a past-due subscriber gets one route instead: the billing portal, where
  the card they already have on file can be replaced. No plan choice, because
  they already chose.
*/
export default function PaymentFailedGate() {
  const { signOut } = useAuth();
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

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
      setFailed(true);
      setOpening(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-brand-blue-light/30 bg-[#0A0A0A] p-8"
        style={{ boxShadow: '0 0 30px rgba(59, 130, 246, 0.15)' }}
      >
        <AlertCircle className="w-8 h-8 text-brand-blue-light mb-5" aria-hidden="true" />

        <h1 className="text-xl font-semibold text-white mb-3">
          Your last payment didn&rsquo;t go through
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed mb-2">
          Your bank declined the charge, so your account is paused. This is
          usually an expired card or a new card number rather than anything
          wrong with your account.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          {/*
            Said plainly and early. The fear at this exact moment is that
            months of journalling have been thrown away, and that fear is what
            makes people give up rather than fix the card.
          */}
          <span className="text-white font-medium">Nothing has been deleted.</span>{' '}
          Update your card and everything comes straight back.
        </p>

        <button
          type="button"
          onClick={openBillingPortal}
          disabled={opening}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-brand-blue/20 text-brand-blue-light border border-brand-blue-light/30 hover:bg-brand-blue/30 transition-colors disabled:opacity-60"
        >
          {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {opening ? 'Opening…' : 'Update payment method'}
          {!opening && <ArrowRight className="w-4 h-4" />}
        </button>

        {failed && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            Couldn&rsquo;t open the billing portal. Email{' '}
            <a href="mailto:tradenovaai@gmail.com" className="text-brand-blue-light">
              tradenovaai@gmail.com
            </a>{' '}
            and a human will sort it.
          </p>
        )}

        {/*
          A way out, kept deliberately quiet.

          This screen replaces every route, so without it the only exit is
          closing the tab - and a wall with no door reads as a product holding
          someone hostage over a declined card. Small and grey because the
          card is still the thing we want them to fix; present because not
          everyone wants to.
        */}
        <button
          type="button"
          onClick={signOut}
          className="w-full mt-5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
