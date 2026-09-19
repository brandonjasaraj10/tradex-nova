/*
  What somebody sees when their plan will not hold another synced account.

  This replaces a dead end. The message used to be "Your plan covers 1 synced
  account. Disconnect one to connect another." - true, and useless: it named
  the wall without naming a way past it, in a toast that disappeared while
  they were still reading it. Somebody who has just taken a second prop
  challenge does not want to disconnect the first one.

  So it offers the two real ways forward, in the order that suits the person
  rather than us: buy the account they are trying to connect right now, or
  move up a plan. The add-on is first because it is what they came to do -
  pushing the bigger subscription at somebody who needs one more account is
  how an upsell starts feeling like a toll gate.
*/

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, ArrowRight, Loader2 } from 'lucide-react';
import {
  EXTRA_ACCOUNT_PRICE_MONTHLY,
  EXTRA_ACCOUNT_PRICE_ANNUAL,
  setExtraSyncedAccounts,
  confirmExtraAccountPayment,
} from '../../services/extraAccounts';

interface Props {
  /* What their plan allows today, including extras already bought. */
  limit: number;
  /* Extras already paid for, so the stepper starts from the truth. */
  currentExtras: number;
  /*
    What the member is billed on. Decides which price is quoted, because
    Stripe will charge the one matching their existing subscription whatever
    the screen says - and being told $19 then charged $190 is how a surprise
    becomes a chargeback.
  */
  interval: 'month' | 'year';
  /* Called once Stripe has taken the money and the allowance is bigger. */
  onPurchased: (newExtras: number) => void;
  onDismiss?: () => void;
}

export default function AccountLimitReached({ limit, currentExtras, interval, onPurchased, onDismiss }: Props) {
  /*
    Starts at one more than they have, because wanting one more is why this
    panel is on screen. They can still ask for several.
  */
  const [wanted, setWanted] = useState(currentExtras + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const adding = wanted - currentExtras;

  const annual = interval === 'year';
  const each = annual ? EXTRA_ACCOUNT_PRICE_ANNUAL : EXTRA_ACCOUNT_PRICE_MONTHLY;
  const total = adding * each;
  /* "a year" / "/yr" rather than a separate string per sentence. */
  const per = annual ? 'a year' : 'a month';
  const short = annual ? '/yr' : '/mo';

  async function buy() {
    setBusy(true);
    setError('');
    const result = await setExtraSyncedAccounts(wanted);

    /*
      The bank wants 3-D Secure. Stripe.js puts the issuer's own challenge
      over the page - there is no card to collect, it is already on file and
      already on the invoice, so the only thing missing is the tap.

      Nothing has been granted at this point: the server refuses to raise the
      allowance until the invoice is settled. So once the challenge passes we
      ask again with the same number, which is idempotent - Stripe sees no
      change to make, finds the invoice now paid, and grants it.
    */
    if (result.pending && result.payment?.clientSecret) {
      const confirmed = await confirmExtraAccountPayment(result.payment.clientSecret);
      if (!confirmed.ok) {
        setBusy(false);
        setError(
          `${confirmed.error ?? 'Your bank did not approve the payment.'} The account has not been added.`,
        );
        return;
      }

      const settled = await setExtraSyncedAccounts(wanted);
      setBusy(false);
      if (!settled.ok) {
        setError(
          settled.error
            ?? 'Your bank approved it but the payment has not settled yet. Give it a moment and try again.',
        );
        return;
      }
      onPurchased(settled.extraAccounts ?? wanted);
      return;
    }

    setBusy(false);

    if (!result.ok) {
      setError(
        result.error
          ?? 'Your card was declined, so the account has not been added. Update your card in Settings and try again.',
      );
      return;
    }

    onPurchased(result.extraAccounts ?? wanted);
  }

  return (
    <div className="rounded-xl border border-brand-blue-light/25 bg-brand-blue/[0.06] p-5">
      <p className="text-[15px] font-medium text-white">
        Your plan covers {limit} synced {limit === 1 ? 'account' : 'accounts'}
      </p>
      <p className="mt-1.5 text-[13px] text-gray-400 leading-relaxed">
        Add another for ${each} {per}, or move up a plan. Accounts you
        add by hand or import from a CSV stay unlimited either way.
      </p>

      <div className="mt-4 flex items-center gap-3">
        {/*
          A stepper rather than a single "add one" button, because somebody
          starting two challenges at once should not have to buy the same
          thing twice and be charged two prorations for it.
        */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-brand-elevated p-1">
          <button
            type="button"
            onClick={() => setWanted((n) => Math.max(currentExtras + 1, n - 1))}
            disabled={busy || wanted <= currentExtras + 1}
            aria-label="One fewer account"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5
              disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[2ch] text-center text-[14px] font-medium text-white tabular-nums">
            {adding}
          </span>
          <button
            type="button"
            onClick={() => setWanted((n) => Math.min(50, n + 1))}
            disabled={busy || wanted >= 50}
            aria-label="One more account"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5
              disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            bg-brand-blue text-white text-[13.5px] font-medium hover:bg-brand-blue/90
            disabled:opacity-60 transition-colors"
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Adding
            </>
          ) : (
            <>
              Add {adding} {adding === 1 ? 'account' : 'accounts'} &middot; ${total}{short}
            </>
          )}
        </button>
      </div>

      {/*
        Said before they buy, not after. A prorated first charge is the thing
        people write in about, and it reads as a surprise only when nobody
        mentioned it.
      */}
      <p className="mt-2.5 text-[11.5px] text-gray-500 leading-relaxed">
        Charged now, prorated to your renewal date, then ${total} {per}. Remove it any time
        from Settings.
      </p>

      {error && (
        <p className="mt-3 text-[12.5px] text-brand-loss leading-relaxed">{error}</p>
      )}

      <div className="mt-4 pt-3.5 border-t border-white/[0.07] flex items-center justify-between">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-blue-light hover:text-white transition-colors"
        >
          Compare plans
          <ArrowRight className="w-3 h-3" />
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[12.5px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
