import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Shield, CheckCircle2, Lock, AlertCircle, ArrowLeft, Zap, Crown, TrendingUp, Sparkles, Star, Gift, X } from 'lucide-react';
import TrialTimeline from '../components/payment/TrialTimeline';
import Button from '../components/shared/Button';
import { supabase } from '../lib/supabase';

const FloatingParticle = ({ delay, duration, x, size }: { delay: number; duration: number; x: number; size: number }) => (
  <motion.div
    className="absolute rounded-full bg-gold-400/30"
    style={{ width: size, height: size, left: `${x}%` }}
    initial={{ y: '100vh', opacity: 0 }}
    animate={{
      y: '-100vh',
      opacity: [0, 1, 1, 0],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: 'linear',
    }}
  />
);

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

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      delay: Math.random() * 10,
      duration: 15 + Math.random() * 10,
      x: Math.random() * 100,
      size: 2 + Math.random() * 4,
    })), []
  );

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
          features: ['7-day free trial', 'All Pro features', 'Your price never rises', 'Cancel anytime'],
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
          features: ['7-day free trial', 'All Pro features', 'Your price never rises', '2 months free vs monthly', 'Priority support'],
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
          features: ['7-day free trial', 'All Pro features', 'Cancel anytime'],
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
          features: ['7-day free trial', 'All Pro features', '2 months free vs monthly', 'Priority support'],
          highlight: true,
          savings: '2 months free',
          billedAs: '$249.90 billed annually',
          popular: true,
        },
      ];

  const testimonials = [
    { name: 'Alex M.', role: 'Day Trader', date: 'Jun 2026', text: 'Finally something that actually tracks my trades properly. Been using it for 3 months now and my win rate is up 12%.' },
    { name: 'Sarah K.', role: 'Swing Trader', date: 'May 2026', text: 'Tried like 5 different journals before this. The analytics here just make sense and I can actually see where I mess up.' },
    { name: 'Mike R.', role: 'Prop Trader', date: 'Apr 2026', text: 'NOVA called me out on revenge trading and honestly I needed to hear it lol. Worth it just for that.' },
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

  // pb-44 below sm clears the CTA bar that is pinned to the bottom there.
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 py-12 pb-44 sm:pb-12 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-400/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-400/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-gold-400/5 to-transparent rounded-full" />
        {particles.map((p) => (
          <FloatingParticle key={p.id} {...p} />
        ))}
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
        className="w-full max-w-5xl relative z-10"
      >
        {/*
          The way out is a corner X on a phone, as it is on every paywall
          worth copying. "Back to Dashboard" is a wide, prominent control
          pointing away from payment, and on mobile it sat above the fold
          while the button that matters sat below it. Unchanged from sm up.
        */}
        {!onSubscriptionComplete && (
          <>
            <motion.div variants={fadeInUp} className="mb-6 hidden sm:block">
              <Button
                variant="ghost"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => navigate('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </motion.div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Close and go back to the dashboard"
              className="sm:hidden absolute right-0 top-0 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </>
        )}

        {/*
          pt-10 leaves the close button a row to itself. At 360px the centred
          "Start your 7-day free trial today" pill is wide enough to reach the
          corner the X sits in, and the two overlapped. It costs nothing now
          the button is pinned to the bottom, so a taller header cannot push
          it out of view.
        */}
        <motion.div variants={fadeInUp} className="text-center pt-14 sm:pt-0 mb-6 sm:mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold-400/10 border border-gold-400/20 rounded-full mb-6"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Gift className="w-4 h-4 text-gold-400" />
            </motion.div>
            <span className="text-sm text-gold-400 font-medium">Start your 7-day free trial today</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 bg-gold-400 rounded-full"
            />
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
            Elevate Your Trading
          </h1>
          <p className="text-gray-400 text-lg mb-6">
            {isFounder
              ? 'Your founding member pricing is applied below.'
              : 'Choose the plan that fits your journey'}
          </p>

          {isFounder && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-blue-500/10 border border-blue-400/30"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">
                Founding member — your price never rises
              </span>
            </motion.div>
          )}

          {/*
            Replaced a "2,500+ traders trust TradeX" star-rating badge. There
            are no paying customers yet, so it was a fabricated number in the
            single most trust-sensitive spot on the site - right where someone
            is deciding whether to hand over a card. Reassurance that is
            actually true converts here; an invented one is only ever a
            liability. Founders additionally get the real deadline, which is
            genuine urgency rather than a manufactured countdown.
          */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-400"
          >
            <span className="inline-flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-blue-400" />
              7 days free
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-400" />
              Cancel anytime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-400" />
              No charge today
            </span>
          </motion.div>

          {isFounder && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-sm text-gray-400"
            >
              Founding member pricing closes Tuesday, August 25 at 10PM MDT.{' '}
              <span className="text-white font-medium">Lock it in and it never rises.</span>
            </motion.p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              variants={fadeInUp}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              onClick={() => setSelectedPlan(plan.id)}
              className="cursor-pointer relative"
            >
              {plan.highlight && (
                <motion.div
                  className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-gold-400 via-amber-500 to-gold-400 opacity-75"
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  style={{ backgroundSize: '200% 200%' }}
                />
              )}
              <div
                className={`relative rounded-2xl p-4 sm:p-6 transition-all duration-300 ${
                  selectedPlan === plan.id
                    ? 'bg-[#0A0A0A] border-2 border-gold-400'
                    : 'bg-[#0A0A0A] border border-white/10 hover:border-white/20'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-400/10 via-transparent to-gold-400/5 pointer-events-none" />
                )}

                {/*
                  One row on a phone: name on the left, price on the right.
                  The tall stacked card is what pushed the button off the
                  screen - both plans plus the CTA could not fit. From sm up
                  this is exactly the layout it always was.
                */}
                <div className="flex items-center sm:items-start justify-between gap-3 mb-0 sm:mb-4 mt-0 sm:mt-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <plan.icon className="w-6 h-6 text-gold-400 flex-shrink-0" />
                    <div className="min-w-0">
                      {/*
                        Name above badge on a phone. Side by side the pair
                        needs more width than a 360px row has, and the badge
                        ended up hard against the price; stacked, the column
                        is only as wide as the wider of the two. Unchanged
                        from sm up.
                      */}
                      <div className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                        <h3 className="font-semibold text-base sm:text-lg whitespace-nowrap">{plan.name}</h3>
                        {/*
                          Was "Popular" with a people icon - a claim about
                          other customers, of which there are currently none.
                          "Best Value" is the same badge slot but states a
                          fact about the price rather than about a crowd that
                          doesn't exist yet, so it can't be contradicted.
                          Worth revisiting once there's real usage data: a
                          truthful "Most Popular" outperforms it.
                        */}
                        {plan.popular && (
                          <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-blue-500/20 rounded-md whitespace-nowrap flex-shrink-0"
                          >
                            <Sparkles className="w-3 h-3 text-blue-400" />
                            <span className="text-xs font-medium text-blue-400">Best Value</span>
                          </motion.div>
                        )}
                      </div>
                      <p className="hidden sm:block text-sm text-gray-400">{plan.description}</p>
                    </div>
                  </div>
                  {/*
                    The phone's price display. The full block below carries
                    the struck-through original and the same figures; this is
                    the same information at a size that fits on one line.
                  */}
                  <div className="sm:hidden text-right ml-auto flex-shrink-0">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className={`text-xl font-bold ${plan.highlight ? 'text-gold-400' : 'text-white'}`}>
                        {plan.price}
                      </span>
                      <span className="text-xs text-gray-400">{plan.period}</span>
                    </div>
                    {/*
                      "$249.90/yr" rather than the full "billed annually"
                      string: the long form needed 122px of a 358px row and
                      shoved the Best Value badge into the price. The full
                      wording is still on the desktop card, and the timeline
                      directly below spells the charge out in a sentence.
                    */}
                    {plan.billedAs && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {plan.billedAs.split(' ')[0]}/yr
                      </p>
                    )}
                    {plan.savings && <p className="text-[11px] text-blue-400 mt-0.5">{plan.savings}</p>}
                  </div>

                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selectedPlan === plan.id
                      ? 'border-gold-400'
                      : 'border-gray-600'
                  }`}>
                    {selectedPlan === plan.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3 h-3 bg-white rounded-full"
                      />
                    )}
                  </div>
                </div>

                <div className="hidden sm:block mb-4">
                  <div className="flex items-baseline gap-2">
                    {plan.originalPrice && (
                      <span className="text-lg text-gray-500 line-through">{plan.originalPrice}</span>
                    )}
                    <span className={`text-4xl font-bold ${plan.highlight ? 'text-gold-400' : 'text-white'}`}>
                      {plan.price}
                    </span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                  {/*
                    Annual leads with its monthly-equivalent price and states
                    the real amount charged underneath. Headlining $249.90
                    against the monthly card's $24.99 made the better-value
                    plan look ten times more expensive at a glance; showing
                    per-month on both cards makes them directly comparable and
                    annual visibly cheaper. The full amount and billing
                    frequency stay right below it, so nothing is hidden.
                  */}
                  {plan.billedAs && (
                    <p className="text-sm text-gray-400 mt-1">{plan.billedAs}</p>
                  )}
                </div>

                {plan.savings && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4"
                  >
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-400">{plan.savings}</span>
                  </motion.div>
                )}

                {/*
                  Both cards repeat "7-day free trial", "All Pro features" and
                  "Cancel anytime", which the row at the top of the page has
                  already said. On a phone that repetition is what cost the
                  height; the two lines that actually differ are on the annual
                  card's own badge.
                */}
                <div className="hidden sm:block space-y-2">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${plan.highlight ? 'text-gold-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/*
          Phone only. It reads off the selected plan, so switching to annual
          changes the amount it says will be charged - a timeline quoting the
          monthly figure next to a selected annual plan would be worse than
          having none.
        */}
        <motion.div variants={fadeInUp} className="sm:hidden mb-6">
          <TrialTimeline
            amount={chargeAmount}
            billedAs={activeBilledAs ? 'billed annually' : undefined}
          />
        </motion.div>

        {/*
          The button is pinned to the bottom of a phone screen. Measured
          before this change: it sat 1079px down an 844px screen, so nobody
          reached it without scrolling past both plans. Static from sm up,
          where it has always been in view.
        */}
        <motion.div
          variants={fadeInUp}
          className="fixed inset-x-0 bottom-0 z-40 max-w-md mx-auto p-4 space-y-3 bg-black/95 backdrop-blur-sm border-t border-white/10 sm:static sm:z-auto sm:p-0 sm:space-y-4 sm:bg-transparent sm:backdrop-blur-none sm:border-0"
        >
          {!stripeConfigured && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-400 mb-1">Development Mode</p>
                <p className="text-blue-300/80">
                  Stripe is not configured. Use manual activation for testing.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">{error}</div>
            </div>
          )}

          {success && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">{success}</div>
            </div>
          )}

          {stripeConfigured ? (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="primary"
                fullWidth
                size="lg"
                icon={<Zap size={18} />}
                onClick={handleSubscribe}
                isLoading={loading}
              >
                {loading ? 'Processing...' : `Start Free Trial - ${selectedPlan === 'annual' ? 'Annual Plan' : 'Monthly Plan'}`}
              </Button>
            </motion.div>
          ) : (
            <>
              <Button
                variant="primary"
                fullWidth
                size="lg"
                icon={<CheckCircle2 size={16} />}
                onClick={handleManualActivation}
                isLoading={manualLoading}
              >
                {manualLoading ? 'Activating...' : 'Activate Subscription (Testing)'}
              </Button>
              <div className="text-xs text-center text-gray-500">
                This will activate a 30-day subscription for testing purposes
              </div>
            </>
          )}

          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Lock className="w-4 h-4" />
              <span>Secured by Stripe</span>
            </div>
            <div className="w-px h-4 bg-gray-700" />
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="mt-12 space-y-6">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold mb-6 text-center text-lg">Everything You Need to Succeed</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: TrendingUp,
                  title: 'Advanced Analytics',
                  description: 'Real-time performance metrics and insights'
                },
                {
                  icon: Sparkles,
                  title: 'NOVA AI Assistant',
                  description: 'AI-powered trading insights and recommendations'
                },
                {
                  icon: Shield,
                  title: 'Risk Management',
                  description: 'Protect your capital with advanced risk tools'
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="w-12 h-12 rounded-xl bg-gold-400/10 flex items-center justify-center mx-auto mb-3"
                  >
                    <feature.icon className="w-6 h-6 text-gold-400" />
                  </motion.div>
                  <h4 className="font-medium mb-1">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-gold-400/5 via-transparent to-gold-400/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Star className="w-5 h-5 text-blue-500 fill-blue-500" />
              <h3 className="font-semibold text-lg">What Traders Say</h3>
              <Star className="w-5 h-5 text-blue-500 fill-blue-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="bg-black/50 border border-white/10 rounded-xl p-4 relative overflow-hidden"
                >
                  <div className="absolute top-2 right-2 opacity-10">
                    <svg className="w-8 h-8 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-300 mb-3 italic">"{testimonial.text}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400/40 to-gold-400/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-gold-400">{testimonial.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{testimonial.name}</p>
                        <p className="text-xs text-gray-500">{testimonial.role}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-600">{testimonial.date}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            By subscribing, you agree to our{' '}
            {/*
              inline-block with vertical padding gives these a 44px tap
              height without moving the text - they were 20px, which is under
              the minimum on any phone and is the wrong place to make someone
              aim carefully, since this is the payment screen's only route to
              what they are agreeing to.
            */}
            <button
              onClick={() => navigate('/terms')}
              className="text-gold-400 hover:underline inline-block py-3 sm:py-0 align-middle"
            >
              Terms of Service
            </button>
            {' '}and{' '}
            <button
              onClick={() => navigate('/privacy')}
              className="text-gold-400 hover:underline inline-block py-3 sm:py-0 align-middle"
            >
              Privacy Policy
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
