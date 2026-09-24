import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js';
import { CalendarClock, CheckCircle2, Lock, AlertCircle, ArrowLeft, Zap, Crown, RotateCcw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NOVAScore from '../components/shared/NOVAScore';
import { TickList } from '../components/marketing/blocks';
import { TIERS } from '../lib/pricingTiers';
import { Frame } from '../components/marketing/product';
import { EXAMPLE_SCORE } from '../components/marketing/exampleScore';
import { useAuth } from '../lib/auth';
import PaymentFailedGate from '../components/billing/PaymentFailedGate';
import { trackEvent } from '../lib/productAnalytics';

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

  What is NOT dropped is the detail underneath - the facts somebody
  comparing products looks for - as one quiet line rather than four bullets
  competing with the six that do the selling.

  "Up to 5 accounts" used to sit in that line and had to go. It is left over
  from the single-plan era and, now that the tier columns are directly above
  it, it flatly contradicts them: Starter says one account synced and
  unlimited by hand, and then this said five. A comparison shopper reading
  both in the same glance is exactly who that would lose.
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
const ALSO_INCLUDED = 'Unlimited trades \u00b7 Unlimited manual accounts \u00b7 CSV import \u00b7 Notes';

/*
  A price string turned into its weekly equivalent.

  Takes the displayed string rather than a number so there is one place that
  knows how these are formatted, and returns a string for the same reason.
  An annual total divides by 52; a monthly price is twelve of them over 52.
*/
const weeklyFrom = (price: string, annual: boolean) => {
  const total = Number(price.replace(/[^0-9.]/g, ''));
  if (!total) return price;
  const weekly = annual ? total / 52 : (total * 12) / 52;
  return `$${weekly.toFixed(2)}`;
};

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripeMonthlyPriceId = import.meta.env.VITE_STRIPE_PRICE_ID;
const stripeAnnualPriceId = import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID;
const stripeFounderMonthlyPriceId = import.meta.env.VITE_STRIPE_FOUNDER_PRICE_ID;
const stripeFounderAnnualPriceId = import.meta.env.VITE_STRIPE_FOUNDER_ANNUAL_PRICE_ID;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

/* Monthly or annual - the billing interval, and the founder view's two cards. */
type PlanType = 'monthly' | 'annual';

/* Which plan, for everyone who is not a founding member. */
type TierId = 'starter' | 'pro' | 'elite';

/* Looked up by the display name, which is what TIERS is keyed on. */
const tierById = (name: string) => TIERS.find((t) => t.name === name);

/*
  A row in the chooser is either a tier or, for founders, a billing interval,
  so the id the list is keyed on has to be able to be either.
*/
type SelectionId = PlanType | TierId;

/*
  Six prices: three tiers, monthly and annual each.

  The ids now live in pricingTiers.ts beside the copy they sell, because the
  price a customer reads and the price they are charged should come out of
  one file. They are public identifiers - they ship in this bundle whatever
  we do - so keeping them in six environment variables bought nothing except
  a way for one tier's checkout to break silently when a variable went
  missing on a deploy.

  An environment variable still wins if it is set, which is what makes a test
  price or a one-off promotion possible without a code change.
*/
const TIER_PRICE_IDS: Record<TierId, Record<PlanType, string | undefined>> = {
  starter: {
    monthly: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID ?? tierById('Starter')?.priceIds.monthly,
    annual: import.meta.env.VITE_STRIPE_STARTER_ANNUAL_PRICE_ID ?? tierById('Starter')?.priceIds.annual,
  },
  pro: {
    monthly: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? tierById('Pro')?.priceIds.monthly,
    annual: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID ?? tierById('Pro')?.priceIds.annual,
  },
  elite: {
    monthly: import.meta.env.VITE_STRIPE_ELITE_PRICE_ID ?? tierById('Elite')?.priceIds.monthly,
    annual: import.meta.env.VITE_STRIPE_ELITE_ANNUAL_PRICE_ID ?? tierById('Elite')?.priceIds.annual,
  },
};

/*
  Annual is ten months for twelve, which is the same "2 months free" the
  single plan already offered - keeping the discount identical across every
  tier means nobody has to work out whether the deal got worse as they moved
  up.

  Monthly figure first because that is what people compare against rivals;
  the annual total is stated underneath rather than hidden, since a plan that
  advertises $124.99 and charges $1,499.90 is the thing that generates
  chargebacks.
*/
const TIER_CATALOGUE: {
  id: TierId;
  name: string;
  monthly: string;
  annualPerMonth: string;
  annualTotal: string;
  /*
    The whole tier in one line, always on screen.

    This is the fix for a paywall that showed three prices and no reason to
    prefer any of them - somebody was being asked to choose between $29.99
    and $149.99 with the difference stated nowhere. A scannable comparison
    is the single most consistent addition among paywalls that convert,
    because it answers "what do I actually get" before it gets asked.
  */
  summary: string;
  features: string[];
  popular?: boolean;
}[] = TIERS.map((tier) => {
  /*
    Derived from TIERS rather than written again here.

    This array used to be a second, hand-kept copy, and it had already
    drifted exactly as pricingTiers.ts warned it would: the paywall was
    still offering Pro at $59.99 with three accounts and Elite at $149.99
    with six, still promising a daily-sync tier that no longer exists, and
    still advertising "first on every new platform" - which was never true,
    since every plan gets a new platform on the same day. Somebody comparing
    the paywall against /pricing would have found four disagreements.

    A price that lives in two files eventually disagrees with itself, and on
    a payment screen that disagreement is a chargeback.
  */
  const monthlyValue = Number(tier.price.replace(/[^0-9.]/g, ''));
  const annualTotalValue = monthlyValue * 10;
  const money = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    id: tier.name.toLowerCase() as TierId,
    name: tier.name,
    monthly: tier.price,
    /*
      Annual is ten months for twelve, so the per-month figure is the annual
      total spread back over twelve - not the monthly price with a discount
      bolted on. Rounded to the cent Stripe will actually charge.
    */
    annualPerMonth: money(Math.round((annualTotalValue / 12) * 100) / 100),
    annualTotal: `${money(annualTotalValue)} billed annually`,
    summary: tier.who,
    features: tier.lines.filter((l) => l.included).map((l) => l.text),
    popular: tier.featured,
  };
});

interface PaymentProps {
  onSubscriptionComplete?: () => void;
  isFirstTime?: boolean;
}

export default function Payment({ onSubscriptionComplete, isFirstTime = false }: PaymentProps) {
  const { pastDue, profile } = useAuth();

  /*
    The headline is whatever they said was wrong thirty seconds ago.

    Question three of onboarding asks what they struggle with and then the
    answer has never been used again. It is the most relevant sentence
    available on this screen and it costs nothing to say: somebody who has
    just told you they revenge trade should not be read a generic pitch.

    Outcome, not mechanism. No mention of Nova or of AI - the competition
    leads on both (TradeZella's headline is "Meet Your AI Trading Partner",
    and as of 2026-09-24 they run a sentiment agent that flags tilt), and
    what is still only true here is that the trader does the scoring
    themselves, before the click, against rules they wrote.
  */
  const struggleHeadline = ({
    revenge_trading: 'Stop giving it back in the next three trades.',
    breaking_rules: 'You wrote the rules. Start keeping them.',
    overtrading: 'Take fewer trades. On purpose.',
    not_sure: 'Find out what is actually costing you.',
  } as Record<string, string>)[profile?.onboarding_struggle ?? ''] ??
    'Your strategy isn’t what fails the challenge.';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  /*
    The Checkout Session's client secret, set once the user has chosen and
    pressed the button. Non-null means the embedded form is on screen, which
    is also what the mounting effect below keys off.
  */
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [success, setSuccess] = useState('');
  /*
    Defaults to Pro rather than the cheapest row. A chooser that opens on the
    entry plan asks people to talk themselves up; opening on the one most
    will want asks them to confirm.
  */
  const [selectedPlan, setSelectedPlan] = useState<SelectionId>('starter');
  /*
    Named billing, not interval - setInterval would shadow the global.

    Annual, not monthly. Briefly monthly on the reasoning that a smaller
    number is an easier yes; the evidence says the opposite works better -
    apps doing $100k/month default to the yearly plan and shrink the number
    by reframing it per week rather than by shortening the commitment.
    Lowering the commitment gives away the LTV that price framing gets for
    free.
  */
  const [billing, setBilling] = useState<PlanType>('annual');

  /*
    The paywall opens on one plan, and only becomes a comparison if asked.

    Measured on the 22-23 September cohort: a reel put 156 people through
    signup, 151 finished onboarding, and 2 started a checkout. Everything
    upstream converted well - 37% of the people who asked for the link
    created an account, 97% of those finished onboarding - and then 149 of
    151 left on this screen.

    What they met was three tiers, two billing intervals and a card request,
    with Pro annual preselected: a $599.90 commitment, roughly ninety
    seconds after tapping a comment button on a fifteen second video. That
    is a considered purchase laid out for somebody who is still scrolling.

    So the default is now the smallest true commitment - Starter, monthly -
    presented as the offer rather than as one of six. The other tiers are
    one tap away and nothing about the prices, the trial or the card
    requirement has changed; the only thing removed is the obligation to
    compare before paying.
  */
  /*
    The paywall fired no events at all, which is why "151 finished onboarding,
    2 started a checkout" is the whole story we have. Four events turn one
    number into a place: arrived, changed plan, opened the comparison, opened
    Stripe.
  */
  useEffect(() => {
    trackEvent('paywall_viewed', { struggle: profile?.onboarding_struggle ?? null });
  }, [profile?.onboarding_struggle]);

  const [comparing, setComparing] = useState(false);

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
        /*
          A founder's rows are monthly and annual, not Starter/Pro/Elite, so
          the default tier selection is meaningless to them. Moved onto the
          annual card - which is the one their view highlights - rather than
          left pointing at a row that is not on their screen.
        */
        setSelectedPlan('annual');
      }
    }

    checkFounderEligibility();
    return () => { cancelled = true; };
  }, []);

  /*
    Mount Stripe's embedded checkout once a session exists.

    Kept in an effect rather than done inline in the click handler because
    the element it mounts into does not exist until React has rendered the
    checkout view - setting the secret is what puts that element on screen,
    and this runs after.

    The destroyed flag matters: initEmbeddedCheckout is async, and a user who
    presses back before it resolves would otherwise have an instance mounted
    into a element that is no longer there. Stripe's own instance is torn
    down on the way out so a second attempt gets a clean one rather than
    "you can only create one Embedded Checkout".
  */
  useEffect(() => {
    if (!checkoutSecret) return;

    let destroyed = false;
    let instance: StripeEmbeddedCheckout | null = null;

    (async () => {
      const stripe = await stripePromise;
      if (!stripe || destroyed) return;

      const checkout = await stripe.initEmbeddedCheckout({ clientSecret: checkoutSecret });
      if (destroyed) {
        checkout.destroy();
        return;
      }
      instance = checkout;
      checkout.mount('#tradex-embedded-checkout');
    })().catch((err) => {
      console.error('Embedded checkout failed to mount:', err);
      if (destroyed) return;
      /*
        Back to the plan chooser rather than a blank panel. The message names
        the card form specifically, because "something went wrong" on a
        payment screen reads as "your card was charged, maybe".
      */
      setCheckoutSecret(null);
      setError('The payment form did not load. Please try again.');
    });

    return () => {
      destroyed = true;
      instance?.destroy();
    };
  }, [checkoutSecret]);

  const handleSubscribe = async () => {
    trackEvent('paywall_checkout_started', {
      plan: selectedPlan, billing, amount: chargeAmount,
      struggle: profile?.onboarding_struggle ?? null,
    });
    if (!stripeConfigured) {
      setError('Stripe is not configured. Please contact support.');
      return;
    }

    /*
      Two different shapes of choice, deliberately kept apart.

      A founding member is buying the plan they were promised at the rate
      they were promised, so their selection is still just monthly or annual
      and resolves exactly as it always did. Nothing about tiers reaches
      them, which is the whole point of grandfathering.

      Everybody else is choosing a tier, and the interval is a separate
      toggle, so the price is a lookup on both.
    */
    const priceId = isFounder
      ? (selectedPlan === 'annual'
          ? (stripeFounderAnnualPriceId ?? stripeAnnualPriceId)
          : (stripeFounderMonthlyPriceId ?? stripeMonthlyPriceId))
      : TIER_PRICE_IDS[selectedPlan as TierId]?.[billing];

    if (!priceId) {
      /*
        The tier prices do not exist in Stripe yet. Saying so is better than
        the generic "try another option", which would send somebody round
        the three tiers pressing a button that cannot work for any of them.
      */
      setError(
        isFounder
          ? 'Selected plan is not available. Please try another option.'
          : 'This plan is not open for signups yet. Please contact support and we will sort it out.',
      );
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
          embedded: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId, clientSecret } = await response.json();

      /*
        Keep the card form on our own page.

        Same Checkout Session as the redirect - the fields are still Stripe's
        iframe, so no card number ever reaches us and PCI scope does not
        move. What changes is that somebody deciding whether to pay is not
        thrown onto a different domain mid-decision, which is the point in
        the funnel where people reconsider.

        If the server gives us no clientSecret - an older deploy, or embedded
        refused for any reason - fall back to the redirect rather than
        showing an empty box. A checkout that works somewhere else beats one
        that works nowhere.
      */
      if (clientSecret) {
        setCheckoutSecret(clientSecret);
        return;
      }

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
    : /*
        Three tiers, priced against whichever interval is selected. Built
        from the same catalogue the figures live in, so the chooser and the
        button underneath can never quote different money.

        The monthly price is struck through on annual rows rather than the
        saving being summarised in words: "$59.99 -> $49.99" is a comparison
        somebody can check, where "save 17%" is one they have to trust.
      */
      TIER_CATALOGUE.map((tier) => ({
        id: tier.id as SelectionId,
        name: tier.name,
        price: billing === 'annual' ? tier.annualPerMonth : tier.monthly,
        period: '/month',
        originalPrice: billing === 'annual' ? tier.monthly : undefined,
        /*
          The price said by the week, on a phone only.

          Subscription apps reframe this way and the reason is not
          decoration: $5.77 gets compared against a coffee, $299.90 against a
          decision. The sum leaving the account is identical.

          Both intervals, not just the annual one, and that is because this
          page has a toggle. Apps that quote weeks on the yearly plan alone
          are listing plans separately, where each can carry its own unit;
          across a switch, "/week" on one side and "/month" on the other
          makes the two incomparable at exactly the moment somebody is
          comparing them. $6.92 against $5.77 is a saving that can be seen.

          Phone only, because that is where the convention lives. A desktop
          pricing table quoting weeks reads as evasive rather than familiar,
          so sm and up gets the monthly figure with the old price struck
          through beside it.

          What keeps it honest is billedAs directly underneath, naming the
          sum and the interval Stripe will actually take. A page that
          advertises $5.77 and charges $299.90 without saying so is how
          chargebacks start.
        */
        weeklyPrice: weeklyFrom(billing === 'annual' ? tier.annualTotal : tier.monthly,
                                billing === 'annual'),
        summary: tier.summary,
        icon: tier.id === 'elite' ? Crown : Zap,
        features: tier.features,
        highlight: !!tier.popular,
        savings: billing === 'annual' ? '2 months free' : null,
        /*
          The real charge, under whichever headline figure is showing.

          On annual it is needed on every screen. On monthly it exists only
          for the phone, where the headline says $6.92 a week - on a desktop
          the headline already says $29.99/month and repeating it as "billed
          monthly" underneath is the same sentence twice.
        */
        billedAs: billing === 'annual' ? tier.annualTotal : `${tier.monthly} billed monthly`,
        billedAsMobileOnly: billing !== 'annual',
        popular: !!tier.popular,
      }));

  /*
    What the trial actually charges, for whichever plan is selected. Annual
    is charged its full $249.90 rather than the $20.83/mo it advertises, so
    the timeline has to quote billedAs and not the headline price - saying
    "$20.83 will be charged" would be untrue.
  */
  /*
    Whether this purchase is annual, from whichever control actually decides
    it: a founder picks an interval as their plan, everyone else picks a tier
    and sets the interval on the toggle. Read from the wrong one and an
    annual charge gets labelled "/month" on the button that takes the money.
  */
  const isAnnual = isFounder ? selectedPlan === 'annual' : billing === 'annual';
  const activePlan = plans.find((pl) => pl.id === selectedPlan) ?? plans[0];
  const activeBilledAs = 'billedAs' in activePlan ? activePlan.billedAs : undefined;

  /* More than one plan on screen - which decides both what the list renders
     and whether it renders as rows or as columns. */
  const showingAll = isFounder || comparing;
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
  /*
    The checkout, on our own page.

    A full replacement rather than a modal over the plan chooser: someone
    entering card details should have one thing in front of them, and a
    dimmed pricing table behind glass is a second thing. The way back is a
    single quiet control, because a prominent escape next to a payment form
    is an invitation to take it.

    Stripe's iframe brings its own light surface, so the panel around it is
    white on purpose - a black gutter around a white form reads as a seam.
  */
  if (checkoutSecret) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-6 sm:pt-12 pb-20">
          <button
            type="button"
            onClick={() => setCheckoutSecret(null)}
            className="inline-flex items-center gap-2 text-[13.5px] text-gray-400
              hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </button>

          <div className="rounded-2xl overflow-hidden bg-white">
            <div id="tradex-embedded-checkout" />
          </div>

          <p className="mt-6 text-center text-[12.5px] text-gray-500">
            <Lock className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            Payments handled by Stripe. Your card details never touch our servers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Wider from lg up so the two columns have room to be columns. At
          max-w-3xl the split produced two cramped strips in the corner of a
          1280px screen. */}
      <div className="max-w-3xl lg:max-w-[62rem] mx-auto px-5 sm:px-8 pt-5 sm:pt-12 pb-36 sm:pb-20">
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
          {/*
            Tighter on a phone, unchanged on a desktop.

            Measured at 375x812: the header ran to 470px before the first
            price, so the third plan and its price sat below the fold on the
            screen where somebody chooses between them. A paywall does best
            when the choice fits on one screen, and 58% of this traffic is a
            phone. Every reduction below is inside a mobile breakpoint - the
            desktop layout had the room and keeps it.
          */}
          <div className="text-center mb-3.5 sm:mb-10">
            <p className="hidden sm:block text-[10px] sm:text-[11px] tracking-[0.18em]
              uppercase text-gray-500 mb-2.5 sm:mb-4">
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
              thing. A founding member is still buying the single plan they
              were promised, so they keep the old headline - for them it is
              still true, and "pick how many accounts" would be offering a
              choice their view does not contain.
            */}
            {/*
              The outcome, not the SKU.

              "Pick how many accounts you run" is a comparison headline, and
              this screen stopped being a comparison. It also sold the
              packaging at the moment somebody is deciding whether the thing
              is worth having at all.

              What it sells now is the reason the product exists. Every rival
              journal scores the money: Edgewonk promises profits outright,
              TradeZella leads on AI. Checked 2026-09-24, TradeZella has moved
              into psychology too - a "Sentiment Agent" that reads your tone
              and flags tilt - so "we do psychology" is no longer the whole
              claim, and "we have an AI" is their headline, not ours to take.

              The line that is still only true here is that the trader does
              the scoring: rules they wrote, confluences they chose, a state
              rating taken before the click rather than inferred after it.
              That is a discipline, not a detector, and it is what the daily
              process score actually measures.
            */}
            <h1 className="text-[26px] sm:text-5xl leading-[1.1] sm:leading-[1.08] font-semibold
              tracking-[-0.035em] text-white text-balance">
              {isFounder ? 'One plan. Everything in it.' : 'Start mastering your trading psychology.'}
            </h1>
            <p className="mt-2.5 sm:mt-4 text-[13.5px] sm:text-base leading-relaxed text-gray-400
              max-w-sm mx-auto text-balance">
              {isFounder
                ? 'Your founding member rate is applied below, and it never rises.'
                : (
                  <>
                    <span className="sm:hidden">
                      The one part of trading nothing else measures.
                    </span>
                    <span className="hidden sm:inline">
                      The one part of trading nothing else measures &mdash; and the part that
                      decides whether you keep the account.
                    </span>
                  </>
                )}
            </p>
          </div>

          {/*
            Three reassurances, each different. Two of these used to read
            "Cancel anytime" verbatim - one behind a gift icon, one behind a
            padlock - so the row said the same thing twice on the screen where
            someone decides to pay.
          */}
          <ul className="flex flex-wrap items-center justify-center gap-x-3.5 sm:gap-x-5 gap-y-2 mb-3.5 sm:mb-10">
            {[
              /* Each icon means its line. A shield said "secure" next to a
                 sentence about time, and a gift box said "present" next to
                 one about cancelling. */
              [CalendarClock, '3 days free'],
              [Lock, 'Card handled by Stripe'],
              [RotateCcw, 'Cancel in two clicks'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Lock;
              return (
                <li key={label as string} className="inline-flex items-center gap-1.5 text-[11.5px] sm:text-[12.5px] text-gray-400">
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
          {/*
            One column, because there is no longer a second one.

            This was a two-column desktop split - plans on the left, and the
            score, feature list and guarantee panels down the right. Cutting
            the page to one screen deleted all three and left the grid, so
            the right column went on reserving 0.85fr of the width with
            nothing in it: on a 1512px screen the plans were squeezed into
            480px, sat left of centre, and the three compare columns came out
            150px wide each with the prices clipped. An empty column is still
            a column.
          */}
          <div>
            <div>
          {/* ---------------------------------------------------------- */}
          {/* The plans. Two rows, not two tall cards - the choice here is
              monthly against annual, which is one decision, and a card each
              made it look like two products. */}
          {/*
            Monthly against annual, once, above the tiers - not repeated as a
            pair of cards inside every tier, which would turn one decision
            into six. Founders do not see it: their two rows already are the
            interval choice.

            Annual is preselected. It is the better deal in both directions
            and saying "2 months free" beside it is the argument, but the
            monthly option sits right there at the same size rather than
            being buried, because a toggle that hides the cheaper commitment
            is the kind people notice afterwards.
          */}
          {!isFounder && (
            <div className="flex justify-center mb-5 sm:mb-7">
              {/*
                The white pill slides between the two rather than the colour
                snapping across. framer-motion moves a single shared element
                by layoutId, so the thing that reads as "selected" travels the
                distance instead of teleporting - which is the difference
                between a control that feels considered and one that feels
                like a radio button.
              */}
              <div className="relative inline-flex rounded-full border border-white/10 bg-brand-surface p-1">
                {([
                  { id: 'monthly' as PlanType, label: 'Monthly' },
                  { id: 'annual' as PlanType, label: 'Annual' },
                ]).map((option) => {
                  const active = billing === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBilling(option.id)}
                      aria-pressed={active}
                      className="relative px-4 sm:px-5 py-1.5 sm:py-2 rounded-full
                        text-[12.5px] sm:text-[13px] font-medium"
                    >
                      {active && (
                        <motion.span
                          layoutId="billingPill"
                          className="absolute inset-0 rounded-full bg-white"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className={`relative z-10 transition-colors duration-200 ${
                        active ? 'text-black' : 'text-gray-400 hover:text-white'
                      }`}>
                        {option.label}
                        {option.id === 'annual' && (
                          <span className={`ml-2 text-[11px] transition-colors duration-200 ${
                            active ? 'text-black/60' : 'text-brand-blue-light'
                          }`}>
                            2 months free
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* One flag for both the layout and the list it lays out. */}
          {/*
            Rows on a phone, columns on a desktop - but only when there is
            something to compare.

            One plan is the normal case and it stays a single wide row. Three
            stacked rows is what the compare view was, and on a wide screen
            that put a 990px column down the middle of a 1700px window with
            the third plan below the fold: the two things a comparison needs -
            seeing the options at once, and not scrolling - both lost to a
            layout that had never been given a desktop case.
          */}
          <div className={`mb-6 sm:mb-8 ${
            showingAll
              ? 'grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4 lg:items-start'
              : 'flex flex-col gap-2.5 sm:gap-3'
          }`}>
            {(showingAll
              ? plans
              : plans.filter((pl) => pl.id === selectedPlan)
            ).map((plan) => {
              const isSelected = selectedPlan === plan.id;
              /* Present only on the annual tier rows, absent on the founder
                 cards, which carry their own two intervals as the choice. */
              const weekly = 'weeklyPrice' in plan ? plan.weeklyPrice : null;
              /* Nothing to choose between while one plan is showing, so the
                 row stops pretending to be a radio and just states the offer. */
              const choosable = isFounder || comparing;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    trackEvent('paywall_plan_selected', { plan: plan.id, billing });
                  }}
                  aria-pressed={isSelected}
                  className={`w-full text-left rounded-2xl p-3.5 sm:p-5 transition-colors ${
                    showingAll ? 'lg:h-full' : ''
                  } ${
                    isSelected
                      ? 'border border-brand-blue-light/40 bg-brand-blue/[0.07]'
                      : 'border border-white/[0.07] bg-brand-surface hover:border-white/20'
                  }`}
                >
                  <div className={`flex items-center justify-between gap-4 ${
                    showingAll ? 'lg:flex-col lg:items-start lg:gap-2.5' : ''
                  }`}>
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* The radio, drawn rather than a real input, so the
                          whole row is the target on a phone. */}
                      {choosable && (
                        <span
                          aria-hidden="true"
                          className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'border-brand-blue-light' : 'border-white/25'
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-brand-blue-light" />}
                        </span>
                      )}
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
                        {plan.savings && isFounder && (
                          <p className="text-[12px] text-gray-500 mt-0.5">{plan.savings}</p>
                        )}

                      </div>
                    </div>

                    <div className={`text-right flex-shrink-0 ${
                      showingAll ? 'lg:text-left lg:w-full' : ''
                    }`}>
                      <p className={`flex items-baseline justify-end gap-1 ${
                        showingAll ? 'lg:justify-start' : ''
                      }`}>
                        {plan.originalPrice && (
                          <span className={`text-[13px] text-gray-600 line-through tabular-nums ${
                            weekly ? 'hidden sm:inline' : ''
                          }`}>
                            {plan.originalPrice}
                          </span>
                        )}
                        {/* The weekly figure replaces the monthly one below
                            sm and only when there is one - swapped in CSS
                            rather than by measuring the viewport, so the
                            first paint is already right. */}
                        {weekly && (
                          <motion.span
                            key={`${plan.id}-${weekly}`}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="sm:hidden text-[20px] font-semibold text-white tabular-nums tracking-[-0.02em]"
                          >
                            {weekly}
                          </motion.span>
                        )}
                        {weekly && <span className="sm:hidden text-[12px] text-gray-500">/week</span>}
                        <motion.span
                          key={`${plan.id}-${plan.price}`}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className={`text-[20px] sm:text-[22px] font-semibold text-white tabular-nums tracking-[-0.02em] ${
                            weekly ? 'hidden sm:inline' : ''
                          }`}
                        >
                          {plan.price}
                        </motion.span>
                        <span className={`text-[12px] text-gray-500 ${weekly ? 'hidden sm:inline' : ''}`}>
                          {plan.period}
                        </span>
                      </p>
                      {plan.billedAs && (
                        <p className={`text-[11.5px] text-gray-600 mt-0.5 ${
                          ('billedAsMobileOnly' in plan && plan.billedAsMobileOnly) ? 'sm:hidden' : ''
                        }`}>
                          {plan.billedAs}
                        </p>
                      )}
                    </div>
                  </div>

                  {/*
                    The summary gets the whole width, under the name and the
                    price rather than beside them.

                    Sharing that row with the price is what it did first, and
                    at 375px "1 account - synced once a day" broke across
                    three lines against the number, which is the width a
                    phone actually has once a price in 22px type has taken
                    its half. Indented to clear the radio so it reads as
                    belonging to the name above it.
                  */}
                  {'summary' in plan && plan.summary && (
                    <p className={`mt-2 text-[12.5px] text-gray-400 leading-relaxed ${
                      choosable ? 'pl-[32px]' : ''
                    }`}>
                      {plan.summary}
                    </p>
                  )}

                  {/*
                    Detail for the selected row only.

                    Printing every feature of every tier turns a paywall into
                    a spreadsheet and pushes the button that takes the money
                    below the fold on a phone - and these pages do best when
                    they fit on one screen. The summary line above is what
                    the comparison actually needs; this is for the one plan
                    somebody has landed on.
                  */}
                  {isSelected && plan.features.length > 0 && (
                    <ul className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-white/[0.07] flex flex-col gap-1.5 sm:gap-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2.5 text-[12.5px] text-gray-300 leading-relaxed">
                          <CheckCircle2
                            className="mt-[2px] w-3.5 h-3.5 flex-shrink-0 text-brand-blue-light"
                            strokeWidth={2}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>

          {/*
            The way back to the full list, for the minority who want it.

            Deliberately quiet and deliberately below the plan rather than
            beside it: somebody who needs four accounts synced will look for
            this, and somebody who does not should never be asked to think
            about it. Opening the comparison also restores the monthly and
            annual toggle, because at that point the person IS comparing and
            the interval is part of what they are weighing.
          */}
          {!isFounder && !comparing && (
            <button
              type="button"
              onClick={() => {
                setComparing(true);
                trackEvent('paywall_compare_opened');
              }}
              className="mb-8 -mt-4 w-full text-center text-[12.5px] text-gray-500
                hover:text-gray-300 underline underline-offset-4 decoration-white/20
                transition-colors"
            >
              Running more than one account? Compare plans
            </button>
          )}

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
                : 'Start 3 days free'}
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

          {/*
            The hold, said before it happens.

            The card is authorised for the full plan price and released a
            moment later, which is what stops a dead card becoming a failed
            charge on day three. It still shows as pending on a statement for
            a few days, and an unexplained pending charge the size of the
            subscription is how you earn a chargeback from somebody who was
            about to become a customer. Cheaper to say it here.

            "Temporary hold" rather than a description of what we do to the
            card. It is the phrase banks, hotels and fuel pumps already use,
            so most people have met it before and do not need it explained -
            which is the whole job of a line this small. The first version
            said the same thing in thirty words across two sentences and read
            like terms nobody finishes.
          */}
          <p className="text-center text-[11.5px] text-gray-500">
            {/* The weekly figure is the headline on the card now, so this
                states the real charge and stops saying it twice. */}
            <>Then {chargeAmount}{isAnnual ? '/year' : '/month'} &middot; Cancel in two clicks</>
          </p>
          <p className="text-center text-[11px] text-gray-600 leading-relaxed mt-2 max-w-sm mx-auto">
            Nothing charged today. Your bank may show a brief hold, released straight away.
          </p>
        </div>

            </div>

            {/* The supporting column. Everything here is for somebody who has
                not decided yet; the decision itself is already made possible
                on the left. */}
            <div className="mt-8 lg:mt-0">
          {/* ---------------------------------------------------------- */}
          {/*
            The trial, given real weight.

            This block used to carry the 14-day money back guarantee, on the
            reasoning that TradeX had no trial and so the guarantee WAS the
            trial. The trial is back, and running both was the wrong answer:
            research puts a card-required auto-converting trial at 35-55%
            conversion against a guarantee's roughly 21% lift, so if only one
            can be the headline it is this one. Keeping both would also have
            meant three free days plus fourteen refundable ones for anyone who
            wanted them.

            The two objections worth answering are the ones a sceptical trader
            actually has: am I going to get charged without noticing, and what
            is this hold on my card. Both are answered here rather than left
            to the FAQ, because this is the screen where the card comes out.
          */}
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
          {/*
            Stacked full width rather than side by side, on a second look.

            Pairing them balanced the columns, which was the problem being
            solved at the time. What it cost is readability: the bullets
            became whole sentences when the list went from fourteen feature
            names to six outcomes, and a 444px column wrapped nearly every
            one of them onto two lines - 305px of block to hold six items.

            Full width lets the six sit two across on one line each, and
            gives the score panel room to put its dial beside its breakdown
            instead of under it. The page is taller and reads faster, which
            is the right trade below a fold nobody has to cross to decide.
          */}
          <div>


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
