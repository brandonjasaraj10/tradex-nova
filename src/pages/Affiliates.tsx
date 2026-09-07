import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, TrendingUp, Users, Wallet } from 'lucide-react';
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

export default function Affiliates() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [promoUrl, setPromoUrl] = useState('');
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Silently accepted, never stored. Telling a bot it failed just teaches
    // whoever wrote it to try again without the trap.
    if (website.trim()) {
      setSubmitted(true);
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
          promo_url: promoUrl.trim(),
          audience_size: audienceSize,
          why: why.trim() || null,
        });

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err) {
      console.error('Affiliate application failed:', err);
      setError('Something went wrong sending that. Please try again, or email tradenovaai@gmail.com.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-brand-blue/10 border border-brand-blue-light/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-7 h-7 text-brand-blue-light" />
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
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 bg-brand-surface border border-white/10 rounded-lg text-white placeholder-gray-600 ' +
    'focus:outline-none focus:border-brand-blue-light/50 focus:ring-1 focus:ring-brand-blue-light/30 transition-colors';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to TradeX
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold mb-4">Become a TradeX affiliate</h1>
        <p className="text-lg text-gray-300 mb-10">
          Earn <span className="text-brand-blue-light font-semibold">20% recurring commission
          for 12 months</span> on every trader you refer.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {[
            { Icon: Wallet, title: '20% recurring', body: 'On every payment they make, for their first 12 months.' },
            { Icon: TrendingUp, title: 'Paid monthly', body: 'Commission arrives as long as your referral stays subscribed.' },
            { Icon: Users, title: 'Any audience', body: 'YouTube, Discord, newsletter, a trading community - all welcome.' },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="p-4 rounded-xl bg-brand-surface border border-white/10">
              <Icon className="w-5 h-5 text-brand-blue-light mb-3" />
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
            </div>
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
            <label htmlFor="aff-url" className="block text-sm font-medium mb-2">
              Where would you promote TradeX?
            </label>
            <input id="aff-url" required value={promoUrl} onChange={(e) => setPromoUrl(e.target.value)}
              className={inputClass} placeholder="youtube.com/@yourchannel" />
            <p className="text-xs text-gray-500 mt-1.5">
              A channel, profile, community or site &mdash; wherever your audience is.
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
            The honeypot. Hidden from people and from screen readers, left in
            the tab order's blind spot - a bot filling every field will fill
            this one, which is the entire signal.
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
