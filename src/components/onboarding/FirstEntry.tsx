import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, Loader2 } from 'lucide-react';
import { processVoiceJournalEntry, type VoiceJournalData } from '../../services/voiceJournal';
import { useVoice } from '../../hooks/useVoice';
import { trackEvent } from '../../lib/productAnalytics';
import MascotSays from '../shared/MascotSays';

/*
  The aha, and the only screen in onboarding where the product actually runs.

  Everything before this is an argument. This is the demonstration: they
  describe their last losing trade in their own words, and Nova turns it into
  a real entry in front of them - symbol, direction, size, result pulled out,
  what happened in bullets, their state scored.

  WHY IT IS HERE AND NOT AFTER THE PAYWALL

  Users who experience value before entering payment details convert at
  roughly 2.5x those asked to pay first, and activated users convert at
  35-65% against 2-8% for the un-activated - a gap an order of magnitude
  wider than the difference between any two pricing models. 28 of this
  product's 762 signups have ever written an entry. The paywall is currently
  asking people to pay for something they have never once seen work.

  TYPED FIRST, VOICE ONLY IF IT REALLY WORKS

  Most of this traffic arrives from an Instagram link, which opens in
  Instagram's in-app browser - a WKWebView on iOS, where speech recognition
  is unavailable, and unreliable on Android. Leading with the microphone
  would put the single best thing this product does behind a button that
  does nothing for most of the people who see it. So the box is the default
  and the mic appears only when the browser actually supports it.

  SKIPPABLE ON PURPOSE

  This is the one screen that asks somebody to type, which makes it the most
  expensive screen in the flow. Somebody who will not type should reach the
  price anyway rather than be stuck behind a textarea, and the skip rate is
  worth measuring in its own right.
*/

const PLACEHOLDER =
  'Shorted euro dollar half a lot, got stopped out for about a hundred and eighty bucks. Moved my stop twice again, same as Tuesday.';

/*
  Nova returns formatted HTML. Rendering it with dangerouslySetInnerHTML
  would put model output straight into the page, so the text is pulled out of
  the markup instead and rendered as React - the structure survives, the
  injection surface does not.
*/
function toLines(html: string | undefined): string[] {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = [...doc.querySelectorAll('li, p, h1, h2, h3')];
    const lines = nodes
      .map((n) => (n.textContent ?? '').trim())
      .filter((t) => t.length > 0);
    /* No list markup at all - fall back to the plain text of the whole thing. */
    if (lines.length === 0) {
      const text = (doc.body.textContent ?? '').trim();
      return text ? [text] : [];
    }
    return lines;
  } catch {
    return [];
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">{label}</p>
      <p className="text-[14px] text-white mt-0.5">{value}</p>
    </div>
  );
}

export default function FirstEntry({
  onDone,
}: {
  /* Hands back whatever Nova produced, or null if they skipped or it failed. */
  onDone: (entry: VoiceJournalData | null, transcript: string) => void;
}) {
  const [text, setText] = useState('');
  const [writing, setWriting] = useState(false);
  const [entry, setEntry] = useState<VoiceJournalData | null>(null);
  const [failed, setFailed] = useState(false);

  const { isSupported, isListening, startListening, stopListening } = useVoice({
    onTranscript: (t: string) => setText((prev) => (prev ? `${prev} ${t}` : t)),
  });

  const lines = useMemo(() => toLines(entry?.content), [entry?.content]);

  const run = async () => {
    const transcript = text.trim();
    if (!transcript || writing) return;

    setWriting(true);
    setFailed(false);
    trackEvent('onboarding_entry_started', { chars: transcript.length });

    try {
      /*
        Streamed, so the fields appear as Nova writes them rather than after
        a spinner. The call takes eight to ten seconds whatever happens; the
        difference is whether that time looks like work or like waiting.
      */
      const result = await processVoiceJournalEntry(
        transcript,
        undefined,
        [],
        [],
        undefined,
        [],
        'trade',
        (partial) => setEntry((prev) => ({ ...(prev ?? {}), ...partial })),
      );
      setEntry(result);
      trackEvent('onboarding_entry_written', {
        symbol: result.symbol ?? null,
        hasPnl: result.manual_pnl !== undefined && result.manual_pnl !== null,
      });
    } catch (err) {
      console.error('Could not write the first entry:', err);
      setFailed(true);
      trackEvent('onboarding_entry_failed');
    } finally {
      setWriting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* The result                                                        */
  /* ---------------------------------------------------------------- */

  if (entry && !writing) {
    const pnl = entry.manual_pnl;
    const mood = entry.template_data?.pre_trade_mindset?.mood_rating;

    return (
      <div>
        <h1 className="text-[26px] sm:text-[32px] leading-[1.14] font-semibold tracking-[-0.035em]
          text-white text-center text-balance mb-3">
          That took you thirty seconds.
        </h1>
        <p className="text-center text-[14.5px] text-gray-400 leading-relaxed max-w-md mx-auto mb-6">
          Every journal you have tried would have logged the numbers. This one logged what
          you were like.
        </p>

        <div className="rounded-2xl border border-white/10 bg-brand-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-brand-elevated">
            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
              {entry.title || 'Your entry'}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {(entry.symbol || entry.direction || entry.position_size || pnl !== undefined) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 mb-4 border-b border-white/[0.06]">
                {entry.symbol && <Field label="Symbol" value={entry.symbol} />}
                {entry.direction && <Field label="Direction" value={entry.direction} />}
                {entry.position_size && <Field label="Size" value={entry.position_size} />}
                {pnl !== undefined && pnl !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">Result</p>
                    {/*
                      Blue for a gain, grey for a loss - the app's own
                      convention, deliberately not the green/red every other
                      journal uses.
                    */}
                    <p className={`text-[14px] mt-0.5 ${pnl >= 0 ? 'text-brand-blue-light' : 'text-gray-400'}`}>
                      {pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {lines.length > 0 && (
              <ul className="flex flex-col gap-2">
                {lines.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-gray-300">
                    <span className="flex-shrink-0 mt-[7px] w-1 h-1 rounded-full bg-brand-blue-light" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}

            {mood !== undefined && mood !== null && (
              <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
                  Going in
                </p>
                <p className="text-[13px] text-gray-300">{mood} out of 5</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[15px] sm:text-[16px] leading-[1.5] text-white
          text-balance max-w-lg mx-auto">
          That is one. The pattern needs thirty.
        </p>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onDone(entry, text.trim())}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full
              bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
          >
            Start 14 days free
            <ArrowRight size={17} />
          </button>
          <p className="mt-3 text-[12.5px] text-gray-500">
            Nothing charged today &middot; Cancel in two clicks
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* The ask                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div>
      <MascotSays pose="lean" height={80} side="above" className="mb-6">
        {writing ? 'Reading it now…' : 'One trade. However you’d say it out loud.'}
      </MascotSays>

      <h1 className="text-[26px] sm:text-[31px] leading-[1.15] font-semibold tracking-[-0.032em]
        text-white text-center text-balance mb-2">
        Think of your last losing trade.
      </h1>
      <p className="text-center text-[13.5px] text-gray-500 mb-6">
        A sentence or two is plenty. Rambling is fine.
      </p>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={writing}
          rows={5}
          placeholder={PLACEHOLDER}
          className="w-full rounded-xl border border-white/10 bg-brand-surface px-4 py-3.5
            text-[15px] leading-relaxed text-gray-100 placeholder:text-gray-600
            focus:outline-none focus:border-brand-blue-light/50 disabled:opacity-60 resize-none"
        />
        {/*
          Only rendered where speech recognition genuinely exists. In the
          Instagram in-app browser - where most of this traffic arrives - it
          does not, and a mic that does nothing is worse than no mic.
        */}
        {isSupported && !writing && (
          <button
            type="button"
            onClick={() => (isListening ? stopListening() : startListening())}
            aria-label={isListening ? 'Stop recording' : 'Record instead of typing'}
            className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center
              justify-center transition-colors ${
              isListening
                ? 'bg-brand-blue text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            {isListening ? (
              <motion.span
                className="block w-3 h-3 rounded-sm bg-white"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
            ) : (
              <Mic size={17} />
            )}
          </button>
        )}
      </div>

      {failed && (
        <p className="mt-3 text-[13px] text-gray-400">
          That did not go through. Try again, or skip and do it inside.
        </p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={!text.trim() || writing}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 px-8 py-3.5
          rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-200
          transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        {writing ? (
          <>
            <Loader2 size={17} className="animate-spin" />
            Writing it up
          </>
        ) : (
          <>
            Write it up
            <ArrowRight size={17} />
          </>
        )}
      </button>

      {!writing && (
        <button
          type="button"
          onClick={() => {
            trackEvent('onboarding_entry_skipped');
            onDone(null, '');
          }}
          className="mt-3 w-full text-center text-[13px] text-gray-500 hover:text-gray-300
            transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
