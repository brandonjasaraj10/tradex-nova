import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Plus, X } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import { Section, Steps, ClosingCta } from '../components/marketing/blocks';
import { Frame, PullQuote, StatBand, EquityPanel } from '../components/marketing/product';
import { supabase } from '../lib/supabase';

/*
  The public affiliate application.

  Deliberately does not require an account. Signing up leads to the paywall, so
  "make an account to apply" would mean asking someone to enter a card before
  they can ask about promoting us - a bad trade with the very people whose
  value is an audience rather than a subscription. Identity gets verified at
  approval instead, which is when a referral link and money actually exist.

  Nothing written here can be read back through the API: the table is
  write-only, and applications reach the owner by email.
*/

const AUDIENCE_SIZES = [
  'Under 1,000',
  '1,000 - 10,000',
  '10,000 - 50,000',
  '50,000+',
] as const;

/*
  The starting rate, and deliberately only the starting rate.

  The tiers above it - a higher percentage and a discount code for your
  audience once you have actually referred people - are real, but they are
  not on this page. Publishing a full tier ladder to an audience of nobody
  invites haggling over a rung you have not built yet, and it sets terms in
  public before there is any retention data to set them against. The page
  says the rate grows; what it grows to is settled with each partner.

  Kept as constants so the headline, the cards and the earnings figures can
  never drift apart - the rate used to be written out by hand in three
  places, which is exactly how a page ends up advertising two numbers.
*/
const COMMISSION_RATE = 0.15;
const MONTHLY_PRICE = 24.99;
const COMMISSION_MONTHS = 12;
const RATE_LABEL = `${Math.round(COMMISSION_RATE * 100)}%`;

// The glow used on the NOVA score and the weekly summary card. Reused rather
// than invented so this page reads as the same product.
const BRAND_GLOW = '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)';

/*
  The pitch, as something you can move.

  This replaced three fixed figures - $450 / $1,125 / $2,249 at 10, 25 and 50
  referrals. They were accurate and inert: a reader with an audience of 8,000
  has no row to see themselves in, and three numbers on a card is a claim
  rather than a calculation.

  A slider is the right interaction here specifically because the answer lands
  instantly and the reader supplies the input that matters - their own guess at
  how many people they can bring. That is the whole argument for an affiliate
  programme, and no paragraph makes it as well as watching the number move.

  Every figure derives from the constants above, so the headline rate, the
  steps and this can never drift apart.
*/
function EarningsCalculator() {
  const [referrals, setReferrals] = useState(25);

  const monthly = referrals * MONTHLY_PRICE * COMMISSION_RATE;
  const total = monthly * COMMISSION_MONTHS;
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  return (
    <Frame label="What you would earn" note="Try it — drag the slider">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <label htmlFor="aff-referrals" className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
          Traders you refer
        </label>
        <span className="text-[20px] font-semibold text-white tabular-nums">{referrals}</span>
      </div>

      <input
        id="aff-referrals"
        type="range"
        min={1}
        max={200}
        value={referrals}
        onChange={(e) => setReferrals(Number(e.target.value))}
        className="w-full accent-brand-blue-light cursor-pointer"
      />

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-xl border border-white/[0.07] bg-brand-elevated px-4 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">Every month</p>
          <p className="mt-1.5 text-[22px] sm:text-[26px] font-semibold text-white tabular-nums">
            {money(monthly)}
          </p>
        </div>
        <div
          className="rounded-xl border border-brand-blue-light/30 bg-brand-blue/[0.07] px-4 py-3.5"
          style={{ boxShadow: BRAND_GLOW }}
        >
          <p className="text-[10px] uppercase tracking-[0.12em] text-brand-blue-light">Over 12 months</p>
          <p className="mt-1.5 text-[22px] sm:text-[26px] font-semibold text-brand-blue-light tabular-nums">
            {money(total)}
          </p>
        </div>
      </div>

      <p className="text-[11.5px] text-gray-600 mt-4 leading-relaxed">
        {RATE_LABEL} of the ${MONTHLY_PRICE}/month plan, for each referral&rsquo;s first
        12 months, if they stay subscribed. Partners who refer consistently move
        to a higher rate than this.
      </p>
    </Frame>
  );
}

export default function Affiliates() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  /*
    Several links, not one. Someone with a channel, a Discord and a newsletter
    should not have to pick their favourite - and which platforms they reach
    people on is most of what makes an application worth accepting.
  */
  const [promoUrls, setPromoUrls] = useState<string[]>(['']);
  const [audienceSize, setAudienceSize] = useState<string>(AUDIENCE_SIZES[0]);
  const [why, setWhy] = useState('');
  /*
    Honeypot. A real person never sees this field, so anything in it came from
    a bot filling every input on the page. Cheaper than a CAPTCHA and it costs
    a genuine applicant nothing - which matters here, because the people worth
    recruiting are the least likely to work through a puzzle to reach you.
  */
  const [website, setWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUrl = (index: number, value: string) =>
    setPromoUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  const addUrl = () => setPromoUrls((prev) => [...prev, '']);
  const removeUrl = (index: number) =>
    setPromoUrls((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Silently accepted, never stored. Telling a bot it failed just teaches
    // whoever wrote it to try again without the trap.
    if (website.trim()) {
      setSubmitted(true);
      return;
    }

    const links = promoUrls.map((u) => u.trim()).filter(Boolean);
    if (links.length === 0) {
      setError('Please add at least one link to where you would promote TradeX.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('affiliate_applications')
        .insert({
          name: name.trim(),
          email: email.trim(),
          promo_urls: links,
          audience_size: audienceSize,
          why: why.trim() || null,
        });

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err) {
      /*
        The daily cap raises a message written for a person to read, so show
        it rather than burying it under a generic failure - being told "you
        have already applied today" is useful, "something went wrong" is not.
      */
      const raw = (err as { message?: string })?.message ?? '';
      console.error('Affiliate application failed:', err);
      setError(
        raw.includes('already applied')
          ? raw
          : 'Something went wrong sending that. Please try again, or email tradenovaai@gmail.com.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PageShell>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full text-center py-8 sm:py-16"
        >
          <div
            className="w-16 h-16 rounded-full bg-brand-blue/10 border border-brand-blue-light/30 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: BRAND_GLOW }}
          >
            <CheckCircle2 className="w-8 h-8 text-brand-blue-light" />
          </div>
          <h1 className="text-[28px] sm:text-3xl font-semibold tracking-[-0.03em] text-white mb-3">
            Application received
          </h1>
          <p className="text-[14.5px] sm:text-base leading-relaxed text-gray-400 mb-8">
            Thanks for applying. We read every application and will get back to you
            by email &mdash; usually within a few days.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full
              bg-white text-black text-[14px] font-medium hover:bg-gray-200 transition-colors"
          >
            Back to TradeX
          </Link>
        </motion.div>
      </PageShell>
    );
  }

  const inputClass =
    'w-full px-4 py-3 bg-brand-elevated border border-white/10 rounded-xl text-[14px] text-white placeholder-gray-600 ' +
    'focus:outline-none focus:border-brand-blue-light/50 focus:ring-1 focus:ring-brand-blue-light/30 transition-colors';

  return (
    <PageShell
      width="wide"
      eyebrow="Affiliate program"
      title="Get paid to share TradeX"
      subtitle={`Earn ${RATE_LABEL} recurring commission for 12 months on every trader you refer — and that is where you start, not where you finish.`}
    >
      <EarningsCalculator />

      <div className="my-12 sm:my-16">
        <StatBand
          items={[
            { value: RATE_LABEL, label: 'Recurring, on every payment they make' },
            { value: '12', label: 'Months you keep earning per referral' },
            { value: '0', label: 'Cost to apply, and no account needed' },
          ]}
        />
      </div>

      <Section
        eyebrow="How it works"
        title="Four steps, and none of them cost you anything"
        lead="You do not need a TradeX account to apply. Identity gets verified at approval, which is when a link and money actually exist."
      >
        <Steps
          items={[
            {
              title: 'Apply with the form below',
              body: 'Tell us where you would promote it and roughly who you reach. Takes about a minute.',
            },
            {
              title: 'We read it and reply by email',
              body: 'Every application gets read by a person. Usually within a few days.',
            },
            {
              title: 'You get your referral link',
              body: 'Create your account at that point, and the link is yours. Every signup through it is tracked to you.',
            },
            {
              title: 'You get paid every month they stay',
              body: `${RATE_LABEL} of each payment, for their first 12 months. Not a one-off bounty on signup.`,
            },
          ]}
        />
      </Section>

      <PullQuote>
        A one-off bounty pays you for a signup. This pays you for a year of
        someone actually sticking with it.
      </PullQuote>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center py-8 sm:py-12 border-t border-white/[0.06]">
        <div>
          <EquityPanel />
        </div>
        <div>
          <p className="text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-3.5">What you are sending them to</p>
          <h2 className="text-[26px] leading-[1.12] sm:text-[32px] font-semibold tracking-[-0.032em] text-white text-balance">
            A product that survives the recommendation
          </h2>
          <p className="mt-3.5 text-[14.5px] sm:text-base leading-relaxed text-gray-400 text-balance">
            Recurring commission only works if people stay, so it is worth knowing
            what your audience gets. TradeX is a trading journal built around
            psychology &mdash; talk through the trade, and it writes the entry and
            finds the pattern costing them money.
          </p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {[
              'Voice journaling, so the habit survives past week three',
              'Nova reads every entry together and names the repeated mistake',
              'Three days free before anyone is charged, so nobody you send feels tricked',
              'Never touches their broker account or their money',
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[13.5px] sm:text-[14px] leading-relaxed text-gray-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue-light flex-shrink-0 mt-[3.5px]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/features"
            className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] text-gray-300 hover:text-white transition-colors
              underline underline-offset-2"
          >
            See everything it does
          </Link>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}

      <div id="apply" className="scroll-mt-24 pt-12 mt-4 border-t border-white/[0.06] max-w-xl">
        <p className="text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-3.5">Apply</p>
        <h2 className="text-[26px] leading-[1.12] sm:text-[32px] font-semibold tracking-[-0.032em] text-white text-balance mb-3.5">
          Tell us where you would share it
        </h2>
        <p className="text-[14.5px] sm:text-base leading-relaxed text-gray-400 mb-8">
          Which platforms you reach people on is most of what makes an
          application worth accepting, so add as many as you have.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="aff-name" className="block text-[13px] font-medium text-gray-300 mb-2">Your name</label>
            <input id="aff-name" required value={name} onChange={(e) => setName(e.target.value)}
              className={inputClass} placeholder="Alex Morgan" />
          </div>

          <div>
            <label htmlFor="aff-email" className="block text-[13px] font-medium text-gray-300 mb-2">Email</label>
            <input id="aff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputClass} placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="aff-url-0" className="block text-[13px] font-medium text-gray-300 mb-2">
              Where would you promote TradeX?
            </label>
            <div className="space-y-2">
              {promoUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    id={`aff-url-${i}`}
                    value={url}
                    onChange={(e) => updateUrl(i, e.target.value)}
                    className={inputClass}
                    placeholder={i === 0 ? 'youtube.com/@yourchannel' : 'another link'}
                  />
                  {promoUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrl(i)}
                      aria-label={`Remove link ${i + 1}`}
                      className="flex-shrink-0 px-3 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addUrl}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-brand-blue-light hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another link
            </button>
            <p className="text-[11.5px] text-gray-500 mt-2 leading-relaxed">
              A channel, profile, community or site &mdash; add as many as you have.
            </p>
          </div>

          <div>
            <label htmlFor="aff-size" className="block text-[13px] font-medium text-gray-300 mb-2">Audience size</label>
            <select id="aff-size" value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)}
              className={inputClass}>
              {AUDIENCE_SIZES.map((size) => (
                <option key={size} value={size} className="bg-brand-surface">{size}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="aff-why" className="block text-[13px] font-medium text-gray-300 mb-2">
              Why TradeX? <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea id="aff-why" rows={4} value={why} onChange={(e) => setWhy(e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="What makes it a fit for your audience?" />
          </div>

          {/*
            The honeypot. Hidden from people and from screen readers, left out
            of the tab order - a bot filling every field will fill this one,
            which is the entire signal.
          */}
          <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
            <label htmlFor="aff-website">Website</label>
            <input id="aff-website" tabIndex={-1} autoComplete="off"
              value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 text-[13.5px] leading-relaxed text-gray-200">
              {error}
            </div>
          )}

          {/* The white pill every other CTA on the site uses. A blue
              rectangle here made the one action on the page look like it
              belonged to a different product. */}
          <button type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-full font-medium text-[14.5px] bg-white text-black
              hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Sending…' : 'Apply to join'}
          </button>

          <p className="text-[11.5px] text-gray-500 text-center leading-relaxed">
            No account needed to apply. If you&rsquo;re approved, you&rsquo;ll create one then
            to get your referral link.
          </p>
        </form>
      </div>

      <ClosingCta
        title="Or just try it yourself first"
        body="The easiest thing to recommend is something you already use."
      />
    </PageShell>
  );
}
