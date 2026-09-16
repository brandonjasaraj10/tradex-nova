import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Clock } from 'lucide-react';
import Wordmark from '../components/shared/Wordmark';
import {
  QUESTIONS, ARCHETYPES, scoreAudit, type Archetype,
} from '../lib/auditContent';
import { recordAudit, attachEmail } from '../services/audit';
import { trackEvent } from '../lib/productAnalytics';

/*
  The free psychology audit. No account, no email, nothing asked for until
  something has been given.

  This exists because of a mismatch in the funnel: somebody taps an
  Instagram reel, lands on a site they have never heard of, and the ask is
  $24.99 a month. There is no free tier, so cold traffic meets a hard
  paywall with nothing in between. This is the something in between.

  The design follows what the numbers say rather than what is tidy:

  - Anonymous. Gating a quiz behind a signup "defeats the entire purpose";
    letting people start answering is what creates the motivation to finish.
  - The result is NOT gated. An email gate on the result is the steepest
    cliff in a quiz funnel, losing 30-50% of the people who finished - so
    the verdict is free, and the email buys depth rather than access.
  - The result is an archetype, not a score. "You scored 73%" gets closed;
    a name somebody recognises themselves in gets screenshotted, and for
    traffic arriving from Instagram a screenshot is distribution.
  - One calibrated CTA tied to their result, with a quiet fallback for the
    ones not ready. Two equal buttons is two decisions.
*/

type Stage = number | 'result';

function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {QUESTIONS.map((q, i) => (
        <span
          key={q.id}
          className={`h-1 rounded-full transition-all duration-300 ${
            i === step ? 'w-7 bg-brand-blue-light'
              : i < step ? 'w-3 bg-brand-blue-light/50'
              : 'w-3 bg-white/12'
          }`}
        />
      ))}
      <span className="ml-2.5 text-[11px] uppercase tracking-[0.14em] text-gray-500 tabular-nums">
        {step + 1}/{QUESTIONS.length}
      </span>
    </div>
  );
}

export default function Audit() {
  const [stage, setStage] = useState<Stage>(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ primary: Archetype; secondary: Archetype | null } | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const choose = (questionId: string, optionIndex: number) => {
    const next = { ...answers, [questionId]: optionIndex };
    setAnswers(next);

    const step = stage as number;
    if (step + 1 < QUESTIONS.length) {
      setStage(step + 1);
      return;
    }

    /*
      Last answer: score, show, and record - in that order. The write is not
      awaited, because somebody who has answered six questions is owed their
      answer immediately and a slow insert is not their problem.
    */
    const scored = scoreAudit(next);
    setResult(scored);
    setStage('result');
    trackEvent('audit_completed', { archetype: scored.primary, secondary: scored.secondary });

    const source = new URLSearchParams(window.location.search).get('src') ?? undefined;
    void recordAudit(scored.primary, next, source).then(setAuditId);
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditId || emailState === 'saving') return;
    setEmailState('saving');
    const ok = await attachEmail(auditId, email);
    setEmailState(ok ? 'done' : 'error');
    if (ok) trackEvent('audit_email_captured', { archetype: result?.primary });
  };

  const card = result ? ARCHETYPES[result.primary] : null;

  return (
    <div className="min-h-screen bg-black text-white px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex justify-center mb-8">
          <Link to="/" aria-label="TradeX home" className="text-white/90 hover:text-white transition-colors">
            <Wordmark className="text-[22px]" />
          </Link>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={String(stage)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {stage !== 'result' && (
              <>
                {/*
                  The promise, above the first question only. Somebody
                  arriving cold needs to know what they are about to get
                  before they answer anything - and "60 seconds, no signup"
                  is the objection they actually have.
                */}
                {stage === 0 && (
                  <div className="text-center mb-9">
                    <h1 className="text-[30px] sm:text-[40px] leading-[1.08] font-semibold
                      tracking-[-0.035em] text-white text-balance">
                      What is your trading psychology actually costing you?
                    </h1>
                    <p className="mt-3.5 text-[14.5px] sm:text-[15px] leading-relaxed text-gray-400 text-balance">
                      Six questions about how you behave around a trade — not what you trade.
                    </p>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-gray-500">
                      <Clock size={13} />
                      About 60 seconds &middot; No signup, no email required
                    </p>
                  </div>
                )}

                <Progress step={stage as number} />

                <h2 className="text-[21px] sm:text-[25px] leading-[1.2] font-semibold tracking-[-0.02em]
                  text-white text-balance text-center mb-7">
                  {QUESTIONS[stage as number].prompt}
                </h2>

                <div className="flex flex-col gap-2.5">
                  {QUESTIONS[stage as number].options.map((opt, i) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => choose(QUESTIONS[stage as number].id, i)}
                      className="w-full text-left px-5 py-4 rounded-xl border border-white/10 bg-brand-surface
                        text-[14.5px] leading-relaxed text-gray-200 transition-colors
                        hover:border-brand-blue-light/40 hover:bg-brand-blue/[0.07] hover:text-white
                        focus-visible:outline-none focus-visible:border-brand-blue-light/60"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {stage === 'result' && card && result && (
              <>
                {/*
                  The verdict, first and free. Nothing above it, nothing
                  gating it - the payoff has to be visible without scrolling
                  or the attention already spent goes unpaid.
                */}
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-3">
                    Your trading psychology
                  </p>
                  <h1 className="text-[34px] sm:text-[46px] leading-[1.03] font-semibold
                    tracking-[-0.04em] text-white text-balance">
                    {card.name}
                  </h1>
                  <p className="mt-4 text-[16px] sm:text-[17px] leading-relaxed text-gray-200 text-balance">
                    {card.headline}
                  </p>
                </div>

                <div className="mt-7 rounded-2xl border border-brand-blue-light/25 bg-brand-blue/[0.06] p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-brand-blue-light mb-2.5">
                    Where it happens
                  </p>
                  <p className="text-[15px] text-white mb-4">{card.moment}</p>
                  <p className="text-[13.5px] leading-relaxed text-gray-300">{card.costsYou}</p>
                </div>

                {/*
                  Named only when it is genuinely close. A verdict that
                  admits its own nuance reads as a diagnosis; one that
                  insists you are exactly one thing reads as a horoscope.
                */}
                {result.secondary && (
                  <p className="mt-3.5 text-[13px] text-gray-500 leading-relaxed text-center">
                    There is a strong second pattern here too:{' '}
                    <span className="text-gray-300">{ARCHETYPES[result.secondary].name}</span>.
                  </p>
                )}

                <div className="mt-7 rounded-2xl border border-white/10 bg-brand-surface p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 mb-4">
                    What catches it
                  </p>
                  <ul className="flex flex-col gap-4">
                    {card.whatHelps.map((h) => (
                      <li key={h.title} className="flex gap-3">
                        <Check className="mt-[3px] w-4 h-4 flex-shrink-0 text-brand-blue-light" strokeWidth={2.5} />
                        <div>
                          <p className="text-[14px] font-medium text-white">{h.title}</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-gray-400">{h.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* One loud ask, written for this result rather than for everybody. */}
                <div className="mt-8 text-center">
                  <Link
                    to="/auth?mode=signup"
                    onClick={() => trackEvent('audit_cta_clicked', { archetype: result.primary })}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5
                      rounded-full bg-white text-black text-[15px] font-medium
                      hover:bg-gray-200 transition-colors"
                  >
                    {card.cta}
                    <ArrowRight size={17} />
                  </Link>
                  <p className="mt-3 text-[12px] text-gray-500">
                    14-day money-back guarantee &middot; Cancel anytime
                  </p>
                </div>

                {/*
                  And the quiet landing for everybody else, which is most of
                  cold traffic. The email buys the full written breakdown -
                  a thing they receive, not a list they join.
                */}
                <div className="mt-9 pt-7 border-t border-white/[0.07]">
                  {emailState === 'done' ? (
                    <p className="text-center text-[13.5px] text-gray-300">
                      Sent. Check your inbox for the full breakdown of {card.name}.
                    </p>
                  ) : (
                    <>
                      <p className="text-center text-[13.5px] text-gray-400 mb-3.5 text-balance">
                        Not ready? We&rsquo;ll email you the full breakdown — what to watch for,
                        and how to fix it.
                      </p>
                      <form onSubmit={submitEmail} className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="flex-1 px-4 py-3 rounded-xl bg-brand-surface border border-white/10
                            text-[14px] text-white placeholder:text-gray-600
                            focus:outline-none focus:border-brand-blue-light/50 transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={emailState === 'saving' || !auditId}
                          className="px-6 py-3 rounded-xl border border-white/15 text-[14px] text-white
                            hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          {emailState === 'saving' ? 'Sending…' : 'Send it'}
                        </button>
                      </form>
                      {/*
                        Said here rather than only in the email footer. We do
                        keep the address and we will email it again, so "no
                        spam" would be a small lie told at the exact moment
                        somebody decides whether to trust us.
                      */}
                      <p className="mt-2.5 text-center text-[11.5px] text-gray-600">
                        One email now, and the occasional one after. Unsubscribe in a click.
                      </p>
                      {emailState === 'error' && (
                        <p className="mt-2.5 text-[12.5px] text-gray-400">
                          That didn&rsquo;t save. Try again, or just start a journal above.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
