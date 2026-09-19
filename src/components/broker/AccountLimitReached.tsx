/*
  What somebody sees when they cannot sync another account.

  This replaces a dead end. The message used to be "Your plan covers 1 synced
  account. Disconnect one to connect another." - true, and useless: it named
  the wall without naming a way past it, in a toast that disappeared while
  they were still reading it. Someone who has just taken a second prop
  challenge does not want to disconnect the first one.

  Two situations reach it, and they want opposite things:

    On a trial, syncing is off entirely. There is nothing to buy piecemeal -
    what they want is the subscription they already chose at signup, which
    is one button.

    On a plan, they have used their accounts up. What they want is a bigger
    plan, and the honest thing is to send them to compare rather than to
    upsell in a panel.

  The $19 add-on used to live here and is gone. It was a second thing to buy
  at the exact moment somebody is already deciding whether to buy the first,
  and a plan they understand beats an add-on they have to reason about. The
  Stripe prices and the server action still exist if it is ever wanted back.
*/

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { startSubscriptionNow } from '../../services/syncAccess';

interface Props {
  /* What their plan allows today. Zero while the trial is running. */
  limit: number;
  /*
    Trials have no synced accounts at all, so this decides which of the two
    panels above appears.
  */
  onTrial?: boolean;
  /* Called once syncing is actually unlocked, so the caller can retry. */
  onUnlocked: () => void;
  onDismiss?: () => void;
}

export default function AccountLimitReached({ limit, onTrial, onUnlocked, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startNow() {
    setBusy(true);
    setError('');
    const result = await startSubscriptionNow();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not start your subscription.');
      return;
    }
    onUnlocked();
  }

  if (onTrial) {
    return (
      <div className="rounded-xl border border-brand-blue-light/25 bg-brand-blue/[0.06] p-5">
        <p className="text-[15px] font-medium text-white">
          Syncing starts when your subscription does
        </p>
        <p className="mt-1.5 text-[13px] text-gray-400 leading-relaxed">
          Your trial has everything else — talk your trades through and let Nova read them
          back. Having an account sync itself is what the subscription turns on, and you do
          not have to wait out the rest of the trial to get it.
        </p>

        <button
          type="button"
          onClick={startNow}
          disabled={busy}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            bg-brand-blue text-white text-[13.5px] font-medium hover:bg-brand-blue/90
            disabled:opacity-60 transition-colors"
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Starting
            </>
          ) : (
            <>Start my subscription now</>
          )}
        </button>

        {/*
          Said before the button is pressed, not after. They picked their plan
          at signup, so the only thing they do not already know is that this
          brings the first charge forward.
        */}
        <p className="mt-2.5 text-[11.5px] text-gray-500 leading-relaxed">
          This ends your free trial and charges your card today. Cancel any time in two clicks.
        </p>

        {error && <p className="mt-3 text-[12.5px] text-brand-loss leading-relaxed">{error}</p>}

        {onDismiss && (
          <div className="mt-4 pt-3.5 border-t border-white/[0.07] text-right">
            <button
              type="button"
              onClick={onDismiss}
              className="text-[12.5px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-blue-light/25 bg-brand-blue/[0.06] p-5">
      <p className="text-[15px] font-medium text-white">
        Your plan covers {limit} synced {limit === 1 ? 'account' : 'accounts'}
      </p>
      <p className="mt-1.5 text-[13px] text-gray-400 leading-relaxed">
        Moving up a plan syncs more of them. Accounts you add by hand or import from a CSV
        stay unlimited on every plan, so this only applies to accounts that fill themselves in.
      </p>

      <Link
        to="/pricing"
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
          bg-brand-blue text-white text-[13.5px] font-medium hover:bg-brand-blue/90 transition-colors"
      >
        See plans
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      <p className="mt-2.5 text-[11.5px] text-gray-500 leading-relaxed">
        Change plan any time from Settings. Moving up takes effect immediately.
      </p>

      {onDismiss && (
        <div className="mt-4 pt-3.5 border-t border-white/[0.07] text-right">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[12.5px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
