import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, TrendingUp, Users, Wallet, Plus, X } from 'lucide-react';
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div
            className="w-16 h-16 rounded-full bg-brand-blue/10 border border-brand-blue-light/30 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: BRAND_GLOW }}
          >
            <CheckCircle2 className="w-8 h-8 text-brand-blue-light" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Application received</h1>
          <p className="text-gray-400 mb-8">
            Thanks for applying. We read every application and will get back to you
            by email &mdash; usually within a few days.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-brand-blue-light hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to TradeX
          </Link>
        </motion.div>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 bg-brand-surface border border-white/10 rounded-lg text-white placeholder-gray-600 ' +
    'focus:outline-none focus:border-brand-blue-light/50 focus:ring-1 focus:ring-brand-blue-light/30 transition-colors';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Same soft blue wash the paywall and dashboard use, so the page does
          not read as a different product. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-blue/[0.07] rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to TradeX
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-brand-blue/10 text-brand-blue-light border border-brand-blue-light/30 mb-5">
            Affiliate program
          </span>

          {/* leading-normal, not leading-tight: a clipped descender on a
              gradient heading is the exact bug fixed on the landing page. */}
          <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-normal bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
            Get paid to share TradeX
          </h1>
          <p className="text-lg text-gray-300 mb-10">
            Earn{' '}
            <span className="text-brand-blue-light font-semibold">
              {RATE_LABEL} recurring commission for 12 months
            </span>{' '}
            on every trader you refer &mdash; and that is where you start, not
            where you finish.
          </p>
        </motion.div>

        {/* What the rate actually means in money. A percentage is abstract;
            "ten referrals is $600 over the year" is not. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-brand-blue-light/30 bg-brand-surface p-5 sm:p-6 mb-6"
          style={{ boxShadow: BRAND_GLOW }}
        >
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">What that looks like</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[10, 25, 50].map((referrals) => (
              <div key={referrals}>
                <p className="text-xl sm:text-2xl font-bold text-brand-blue-light tabular-nums">
                  ${Math.round(referrals * MONTHLY_PRICE * COMMISSION_RATE * COMMISSION_MONTHS).toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {referrals} referrals
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
            Over 12 months at {RATE_LABEL}, if they stay subscribed. Based on the
            ${MONTHLY_PRICE}/month plan. Partners who refer consistently move to a
            higher rate.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {[
            { Icon: Wallet, title: `${RATE_LABEL} recurring`, body: 'On every payment they make, for their first 12 months.' },
            { Icon: TrendingUp, title: 'It grows with you', body: 'The rate goes up as you bring more traders in. We work that out with you.' },
            { Icon: Users, title: 'Any audience', body: 'YouTube, Discord, newsletter, a trading community - all welcome.' },
          ].map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + i * 0.05 }}
              className="p-4 rounded-xl bg-brand-surface border border-white/10 hover:border-brand-blue-light/30 transition-colors"
            >
              <Icon className="w-5 h-5 text-brand-blue-light mb-3" />
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="aff-name" className="block text-sm font-medium mb-2">Your name</label>
            <input id="aff-name" required value={name} onChange={(e) => setName(e.target.value)}
              className={inputClass} placeholder="Alex Morgan" />
          </div>

          <div>
            <label htmlFor="aff-email" className="block text-sm font-medium mb-2">Email</label>
            <input id="aff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputClass} placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="aff-url-0" className="block text-sm font-medium mb-2">
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
                      className="flex-shrink-0 px-3 rounded-lg border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-colors"
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
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-blue-light hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another link
            </button>
            <p className="text-xs text-gray-500 mt-2">
              A channel, profile, community or site &mdash; add as many as you have.
            </p>
          </div>

          <div>
            <label htmlFor="aff-size" className="block text-sm font-medium mb-2">Audience size</label>
            <select id="aff-size" value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)}
              className={inputClass}>
              {AUDIENCE_SIZES.map((size) => (
                <option key={size} value={size} className="bg-brand-surface">{size}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="aff-why" className="block text-sm font-medium mb-2">
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
            <div className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/30 text-sm text-gray-200">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-lg font-semibold bg-brand-blue hover:bg-brand-blue/90
              text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Sending...' : 'Apply to join'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            No account needed to apply. If you&rsquo;re approved, you&rsquo;ll create one then
            to get your referral link.
          </p>
        </form>
      </div>
    </div>
  );
}
