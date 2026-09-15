import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Shield, CheckCircle2, Lock, AlertCircle, ArrowLeft, Zap, Crown, Gift, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NOVAScore from '../components/shared/NOVAScore';
import { TickList } from '../components/marketing/blocks';
import { Frame } from '../components/marketing/product';
import { EXAMPLE_SCORE } from '../components/marketing/exampleScore';
import { useAuth } from '../lib/auth';
import PaymentFailedGate from '../components/billing/PaymentFailedGate';

/*
  Six, not fourteen, and each one an outcome rather than a feature name.

  The research on pricing pages puts the useful range at five to seven
  bullets, and is specific about why: a bullet should answer "what do I
  get?", not "what is included?". Fourteen line items is an inventory, and
  an inventory is read by nobody - a documented case cut its feature list,
  its tier count and added a Most Popular badge and went from 1.2% to 3.1%
  conversion without touching the price.

  The old list also repeated itself. "Psychology template & scoring" and
  "NOVA Score" are the same promise twice; "Performance analytics",
  "Trading calendar" and "Searchable trade log" are three names for looking
  at your own trades. Grouping them loses nothing a buyer needed and stops
  the list arguing with itself about how many things this product does.

  What is NOT dropped is the detail underneath. "Up to 5 accounts" and "CSV
  import" are facts somebody comparing products will look for, so they stay
  - as one quiet line rather than four bullets competing with the six that
  do the selling.
*/
const INCLUDED = [
  'Talk through a trade \u2014 it writes itself up',
  'Nova reads every entry and tells you what you keep doing',
  'Your psychology scored on every trade, not just P&L',
  'Your own rules and checklists, checked before you enter',
  'Calendar, analytics and every trade searchable',
  'Weekly and monthly reviews, written for you',
];

/* The specifics a comparison shopper checks, kept but not shouted. */
const ALSO_INCLUDED = 'Unlimited trades \u00b7 Up to 5 accounts \u00b7 CSV import \u00b7 Notes';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripeMonthlyPriceId = import.meta.env.VITE_STRIPE_PRICE_ID;
const stripeAnnualPriceId = import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID;
const stripeFounderMonthlyPriceId = import.meta.env.VITE_STRIPE_FOUNDER_PRICE_ID;
const stripeFounderAnnualPriceId = import.meta.env.VITE_STRIPE_FOUNDER_ANNUAL_PRICE_ID;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

type PlanType = 'monthly' | 'annual';

interface PaymentProps {
  onSubscriptionComplete?: () => void;
  isFirstTime?: boolean;
}

export default function Payment({ onSubscriptionComplete, isFirstTime = false }: PaymentProps) {
  const { pastDue } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const [isFounder, setIsFounder] = useState(false);

  useEffect(() => {
    setStripeConfigured(!!stripePublicKey && !!stripeMonthlyPriceId);
  }, []);

  /*
    Display only - create-subscription independently re-checks this same
    function before letting a founder price through, so a user who flips
    this flag in their own browser still can't buy at the founder price.
    Falls back to standard pricing if the founder price ids aren't
    configured, so a missing env var degrades to full price rather than to
    a broken checkout button.
  */
  useEffect(() => {
    let cancelled = false;

    async function checkFounderEligibility() {
      if (!stripeFounderMonthlyPriceId && !stripeFounderAnnualPriceId) return;

      const { data, error: rpcError } = await supabase.rpc('is_founder_eligible');

      if (!cancelled && !rpcError && data === true) {
        setIsFounder(true);
      }
    }

    checkFounderEligibility();
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = async () => {
    if (!stripeConfigured) {
      setError('Stripe is not configured. Please contact support.');
      return;
    }

    const priceId = selectedPlan === 'annual'
      ? (isFounder && stripeFounderAnnualPriceId ? stripeFounderAnnualPriceId : stripeAnnualPriceId)
      : (isFounder && stripeFounderMonthlyPriceId ? stripeFounderMonthlyPriceId : stripeMonthlyPriceId);

    if (!priceId) {
      setError('Selected plan is not available. Please try another option.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to subscribe');
        navigate('/auth');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw stripeError;
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualActivation = async () => {
    setManualLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to activate subscription');
        navigate('/auth');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'activate',
          duration: 30,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate subscription');
      }

      const result = await response.json();
      setSuccess('Subscription activated successfully!');

      setTimeout(() => {
        if (onSubscriptionComplete) {
          onSubscriptionComplete();
        } else {
          navigate('/dashboard');
        }
      }, 1500);
    } catch (err) {
      console.error('Manual activation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setManualLoading(false);
    }
  };

  /*
    Both founder plans are exactly 40% off their standard counterparts
    ($24.99 -> $14.99 and $249.90 -> $149.90), so both cards state the same
    "40% off, forever" and strike through the price a non-founder pays.
    Previously monthly said "Save $10/mo" while annual said "Save $29.98" -
    per-month against per-year - which made the monthly plan look like the
    weaker deal at a glance when the discount is identical. Annual's extra
    advantage (two months free versus paying founder-monthly all year) is
    stated as a feature rather than mixed into the same number.
  */
  const plans = isFounder
    ? [
        {
          id: 'monthly' as PlanType,
          name: 'Monthly',
          price: '$14.99',
          period: '/month',
          originalPrice: '$24.99',
          description: 'Founding member rate, locked in',
          icon: Zap,
          // Shared items first and in the same order on both cards, then the
          // plan's own extras - so annual reads as a superset of monthly at a
          // glance rather than a different list. Annual previously omitted
          // "All Pro features" entirely, which made the pricier plan look
          // like it included less.
          features: ['All Pro features', 'Your price never rises', 'Cancel anytime'],
          highlight: false,
          savings: '40% off, forever',
          popular: false,
        },
        {
          id: 'annual' as PlanType,
          name: 'Annual',
          price: '$12.49',
          period: '/month',
          // $20.83 is what a non-founder pays per month on annual
          // ($249.90/12), so this is the same 40% cut as the monthly card
          // and both cards compare like with like.
          originalPrice: '$20.83',
          description: 'Founding member rate, best value',
          icon: Crown,
          features: ['All Pro features', 'Your price never rises', '2 months free vs monthly', 'Priority support'],
          highlight: true,
          savings: '40% off, forever',
          billedAs: '$149.90 billed annually',
          popular: true,
        },
      ]
    : [
        {
          id: 'monthly' as PlanType,
          name: 'Monthly',
          price: '$24.99',
          period: '/month',
          description: 'Perfect for getting started',
          icon: Zap,
          features: ['All Pro features', 'Cancel anytime'],
          highlight: false,
          savings: null,
          popular: false,
        },
        {
          id: 'annual' as PlanType,
          name: 'Annual',
          price: '$20.83',
          period: '/month',
          // Struck against the monthly plan's own price, so the saving being
          // shown is exactly what switching to annual is worth.
          originalPrice: '$24.99',
          description: 'Best value for serious traders',
          icon: Crown,
          features: ['All Pro features', '2 months free vs monthly', 'Priority support'],
          highlight: true,
          savings: '2 months free',
          billedAs: '$249.90 billed annually',
          popular: true,
        },
      ];

  /*
    What the trial actually charges, for whichever plan is selected. Annual
    is charged its full $249.90 rather than the $20.83/mo it advertises, so
    the timeline has to quote billedAs and not the headline price - saying
    "$20.83 will be charged" would be untrue.
  */
  const activePlan = plans.find((pl) => pl.id === selectedPlan) ?? plans[0];
  const activeBilledAs = 'billedAs' in activePlan ? activePlan.billedAs : undefined;
  const chargeAmount = activeBilledAs ? activeBilledAs.split(' ')[0] : activePlan.price;

  /*
    A lapsed subscriber is not a prospect. Showing them plans would sell a
    second subscription on top of the one that already exists.
  */
  if (pastDue) {
    return <PaymentFailedGate />;
  }

  /*
    Restrained on purpose, and that is a change.

    This page used to carry floating particles drifting up the screen, a
    rotating gift icon, a pulsing dot, a scaling badge, an animated gradient
    border on the highlighted plan, and a lift-and-scale on hover for every
    card. Twenty-five separate pieces of motion on the one screen where
    somebody is deciding whether to hand over a card. It made the paywall the
    loudest page on a site whose whole visual argument is restraint.

    What is left moves only where movement means something: the panel fades
    in once, and the selected plan changes state when you pick it.

    pb-44 below sm clears the CTA bar pinned to the bottom there.
  */
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Wider from lg up so the two columns have room to be columns. At
          max-w-3xl the split produced two cramped strips in the corner of a
          1280px screen. */}
      <div className="max-w-3xl lg:max-w-[62rem] mx-auto px-5 sm:px-8 pt-6 sm:pt-12 pb-44 sm:pb-20">
        {/*
          The way out is a corner X on a phone, as it is on every paywall
          worth copying. "Back to Dashboard" is a wide, prominent control
          pointing away from payment, and on mobile it sat above the fold
          while the button that matters sat below it.
        */}
        {!onSubscriptionComplete && (
          <div className="flex items-center justify-between mb-8 sm:mb-12">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hidden sm:inline-flex items-center gap-2 text-[13.5px] text-gray-400
                hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Close and go back to the dashboard"
              className="sm:hidden ml-auto w-11 h-11 -mr-2 flex items-center justify-center rounded-full
                text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              {isFounder ? 'Founding member pricing' : 'Choose your plan'}
            </p>
            {/*
              The offer, not the pitch.

              This said "Find out what you keep doing" - the landing page's
              promise, which is the right headline for a stranger and the
              wrong one here. Anybody reading this has already signed up;
              they know what TradeX does and they are deciding what it costs.
              The eyebrow and the headline were also making two different
              arguments stacked on each other, one about pricing and one
              about value.

              It is now the same headline as /pricing, word for word, so the
              page someone compared on and the page they pay on say the same
              thing.
            */}
            <h1 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em]
              text-white text-balance">
              One plan. Everything in it.
            </h1>
            <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed text-gray-400
              max-w-sm mx-auto text-balance">
              {isFounder
                ? 'Your founding member rate is applied below, and it never rises.'
                : 'No tiers, no add-ons, no trade limits. Annual just costs less.'}
            </p>
          </div>

          {/*
            Three reassurances, each different. Two of these used to read
            "Cancel anytime" verbatim - one behind a gift icon, one behind a
            padlock - so the row said the same thing twice on the screen where
            someone decides to pay.
          */}
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-8 sm:mb-10">
            {[
              [Shield, '14-day money back'],
              [Lock, 'Card handled by Stripe'],
              [Gift, 'Cancel in two clicks'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Shield;
              return (
                <li key={label as string} className="inline-flex items-center gap-1.5 text-[12.5px] text-gray-400">
                  <I className="w-3.5 h-3.5 text-brand-blue-light flex-shrink-0" />
                  {label as string}
                </li>
              );
            })}
          </ul>

          {isFounder && (
            <p className="text-center text-[12.5px] text-gray-400 mb-8 -mt-4">
              Founding member pricing closes Tuesday, August 25 at 10PM MDT.{' '}
              <span className="text-white font-medium">Lock it in and it never rises.</span>
            </p>
          )}

          {/* ----------------------------------------------------------
            Two columns from lg up, one below it.

            Measured before this change: on a 1440x820 desktop the button sat
            1575px down the page - 755px BELOW the fold - so a desktop visitor
            had to scroll nearly a full screen past the plans to reach the
            thing they came to press. Mobile was already fine, because the CTA
            is pinned there.

            A floating bar would have fixed that but not the other half of the
            problem: a max-w-3xl column on a 1440px screen left most of the
            viewport empty. Splitting it puts the decision and the button
            together on the left, above the fold, and moves the supporting
            material - guarantee, feature list, score - into the space that
            was doing nothing.

            lg, not sm, because the split needs real width. Tablets keep the
            single column, where the order still reads correctly top to
            bottom.
          */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10 lg:items-start">
            <div>
          {/* ---------------------------------------------------------- */}
          {/* The plans. Two rows, not two tall cards - the choice here is
              monthly against annual, which is one decision, and a card each
              made it look like two products. */}
          <div className="flex flex-col gap-3 mb-8">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left rounded-2xl p-4 sm:p-5 transition-colors ${
                    isSelected
                      ? 'border border-brand-blue-light/40 bg-brand-blue/[0.07]'
                      : 'border border-white/[0.07] bg-brand-surface hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* The radio, drawn rather than a real input, so the
                          whole row is the target on a phone. */}
                      <span
                        aria-hidden="true"
                        className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-brand-blue-light' : 'border-white/25'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-brand-blue-light" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-medium text-white">{plan.name}</span>
                          {plan.popular && (
                            <span className="text-[10px] font-medium uppercase tracking-[0.1em]
                              text-brand-blue-light bg-brand-blue-light/10 rounded-full px-2 py-0.5">
                              Best value
                            </span>
                          )}
                        </div>
                        {plan.savings && (
                          <p className="text-[12px] text-gray-500 mt-0.5">{plan.savings}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="flex items-baseline justify-end gap-1">
                        {plan.originalPrice && (
                          <span className="text-[13px] text-gray-600 line-through tabular-nums">
                            {plan.originalPrice}
                          </span>
                        )}
                        <span className="text-[20px] sm:text-[22px] font-semibold text-white tabular-nums tracking-[-0.02em]">
                          {plan.price}
                        </span>
                        <span className="text-[12px] text-gray-500">{plan.period}</span>
                      </p>
                      {plan.billedAs && (
                        <p className="text-[11.5px] text-gray-600 mt-0.5">{plan.billedAs}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        {/*
          The button is pinned to the bottom of a phone screen. Measured
          before this change: it sat 1079px down an 844px screen, so nobody
          reached it without scrolling past both plans. Static from sm up,
          where it has always been in view.
        */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 max-w-md mx-auto p-4 space-y-3
            bg-black/95 backdrop-blur-sm border-t border-white/10
            sm:static sm:z-auto sm:max-w-none sm:p-0 sm:space-y-4 sm:bg-transparent
            sm:backdrop-blur-none sm:border-0"
        >
          {!stripeConfigured && (
            <div className="p-4 rounded-xl bg-brand-blue/10 border border-brand-blue-light/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-brand-blue-light flex-shrink-0 mt-0.5" />
              <div className="text-[13px]">
                <p className="font-medium text-brand-blue-light mb-1">Development mode</p>
                <p className="text-gray-400">Stripe is not configured. Use manual activation for testing.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-[13px] leading-relaxed text-red-300">{error}</div>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-brand-blue/10 border border-brand-blue-light/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-brand-blue-light flex-shrink-0 mt-0.5" />
              <div className="text-[13px] leading-relaxed text-gray-300">{success}</div>
            </div>
          )}

          {/* The white pill every other CTA on the site uses. */}
          {stripeConfigured ? (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-7 py-3.5 rounded-full
                bg-white text-black text-[14.5px] font-medium hover:bg-gray-200
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Processing…'
                : `Start journaling — ${chargeAmount}${selectedPlan === 'annual' ? '/year' : '/month'}`}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleManualActivation}
                disabled={manualLoading}
                className="w-full inline-flex items-center justify-center px-7 py-3.5 rounded-full
                  bg-white text-black text-[14.5px] font-medium hover:bg-gray-200
                  transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {manualLoading ? 'Activating…' : 'Activate subscription (testing)'}
              </button>
              <p className="text-[11.5px] text-center text-gray-500">
                This will activate a 30-day subscription for testing purposes.
              </p>
            </>
          )}

          <p className="text-center text-[11.5px] text-gray-500">
            14-day money back guarantee &middot; Cancel anytime
          </p>
        </div>

            </div>

            {/* The supporting column. Everything here is for somebody who has
                not decided yet; the decision itself is already made possible
                on the left. */}
            <div className="mt-8 lg:mt-0">
          {/* ---------------------------------------------------------- */}
          {/*
            The guarantee, given real weight.

            It used to be nine grey words under the button. It is the single
            most important thing on this screen: TradeX has no free trial -
            deliberately, the first cohort converted 1 in 11 and half of them
            never logged a trade - so this IS the trial, and it is the only
            thing standing between a stranger and their card.

            Worth the space on the evidence: guarantee messaging on a pricing
            page lifts conversion around 21% (Conversion Rate Experts'
            meta-analysis), and refunds do not rise proportionally - one
            measured case doubled conversion against a 3% rise in refunds,
            for about 6.5% more revenue net of them.

            "Both plans" is stated plainly because it is the part that is
            genuinely unusual here. The nearest competitor's equivalent
            guarantee applies to annual billing only, so paying monthly with
            them buys no way out at all. No competitor is named - that is a
            claim that would need checking and maintaining - but the fact
            about TradeX is worth saying out loud.
          */}
          <div className="rounded-2xl border border-brand-blue-light/25 bg-brand-blue/[0.06] p-5 sm:p-6 mb-8">
            <div className="flex items-start gap-3.5">
              <Shield className="w-5 h-5 text-brand-blue-light flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[17px] sm:text-[19px] font-semibold tracking-[-0.02em] text-white mb-2">
                  Fourteen days to change your mind
                </h2>
                {/*
                  The same words the abandoned-signup email uses, deliberately.
                  Somebody who gets that email and clicks through should land on
                  the promise they were just made, not a reworded cousin of it.

                  It also no longer rests on Nova. The old version - "see
                  whether it tells you something you did not already know" -
                  staked the whole guarantee on one feature. TradeX makes two
                  promises: that you keep journaling at all, which is the reason
                  it was built, and that it shows you something. The guarantee
                  should fail if either does.
                */}
                <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-gray-300">
                  Give it two proper weeks. If you are still not journaling, or
                  it has not shown you something about how you trade that you did
                  not already know, ask for your money back. No questions, no
                  retention call, no form asking why.
                </p>
                {/*
                  Cancelling and refunding are two different things and the
                  site was blurring them. Cancelling really is two clicks in
                  Settings with no email. A refund has no self-serve button,
                  so it genuinely needs one message - which is worth stating
                  plainly here rather than letting someone discover it after
                  they have read "no email" somewhere else.
                */}
                <ul className="mt-4 flex flex-col gap-2">
                  {[
                    'Applies to monthly as well as annual, not just the yearly plan',
                    'Cancelling is two clicks in Settings — no email, any time',
                    'For a refund, one email to us is the only step',
                    'Your journal stays yours — export it or delete it whenever',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-gray-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue-light flex-shrink-0 mt-[3px]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
            </div>
          </div>

          {/* ----------------------------------------------------------
            Below the fold, full width, in its own pair.

            These two used to sit in the right-hand column alongside the
            guarantee, which made that column roughly three times the height
            of the left one - so scrolling past the plans showed a tall stack
            on the right and a completely empty black half on the left. A
            two-column grid only works when the columns are roughly the same
            height, so the page is split where its content actually divides:
            decision beside reassurance, then detail beside proof.
          */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">

          {/* ---------------------------------------------------------- */}
          {/* Everything included, in the same list and the same order as
              /pricing, so the page someone compared before signing up and
              the page they pay on cannot disagree. */}
          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-6 mb-8">
            <p className="text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-4">
              Included, whichever you pick
            </p>
            <TickList items={INCLUDED} />
            <p className="mt-4 text-[12px] text-gray-500 leading-relaxed">
              {ALSO_INCLUDED}
            </p>
          </div>

          {/* ---------------------------------------------------------- */}
          {/* What the money actually buys, using the real NOVAScore
              component rather than a picture of one - the same panel
              /pricing shows. A price on its own is a cost; a price next to
              the thing it produces is a trade. */}
          <div className="mb-8">
            <Frame label="What you get from it" note="Example figures">
              <NOVAScore breakdown={EXAMPLE_SCORE} size="sm" showBreakdown periodLabel="Last 30 days" />
            </Frame>
          </div>
          </div>
        </motion.div>

        {/*
          Terms. inline-block with vertical padding gives these a 44px tap
          height without moving the text - they were 20px, under the minimum
          on any phone, and this is the payment screen's only route to what
          someone is agreeing to.
        */}
        <p className="mt-8 text-center text-[12.5px] text-gray-500">
          By subscribing, you agree to our{' '}
          <button
            onClick={() => navigate('/terms')}
            className="text-gray-300 underline underline-offset-2 hover:text-white
              transition-colors inline-block py-3 sm:py-0 align-middle"
          >
            Terms of Service
          </button>{' '}
          and{' '}
          <button
            onClick={() => navigate('/privacy')}
            className="text-gray-300 underline underline-offset-2 hover:text-white
              transition-colors inline-block py-3 sm:py-0 align-middle"
          >
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  );
}
