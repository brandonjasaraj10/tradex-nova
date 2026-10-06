import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, Loader2, Check, X } from 'lucide-react';
import { processVoiceJournalEntry, type VoiceJournalData } from '../../services/voiceJournal';
import { useVoice } from '../../hooks/useVoice';
import { trackEvent } from '../../lib/productAnalytics';
import MascotSays from '../shared/MascotSays';
import type { StarterItem } from '../../lib/onboardingChecklist';

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
  THEIR OWN THREE RATINGS, ONE TAP EACH, BEFORE THEY SAY ANYTHING.

  Nova used to infer these from the text, which meant most first entries had
  none - people describe what the trade did, not how they felt going in - and
  the ones it did fill were Nova's guess rather than the trader's answer.
  The ratings are the part of this product nobody else has, so the first
  entry should have them, and they should be the trader's own.

  One per screen and auto-advancing on the tap, the way Duolingo asks
  everything: no "next" button, nothing to read twice, a large target. Each
  option carries its own word as well as its number, so nobody has to
  remember which end of a 1-5 scale is good. The dots beside each row are the
  same dots the journal uses, so the control they meet inside is already
  familiar.

  Same three scales, same keys, same 1-5 range as the journal's
  PreTradeScales - these land in the same columns.
*/
type RatingKey = 'pre_trade_emotional_state' | 'pre_trade_focus' | 'pre_trade_confidence';

const RATINGS: { key: RatingKey; question: string; words: [string, string, string, string, string] }[] = [
  { key: 'pre_trade_emotional_state', question: 'Going in, how steady were you?', words: ['Rattled', 'Uneasy', 'Okay', 'Calm', 'Steady'] },
  { key: 'pre_trade_focus', question: 'How focused were you?', words: ['Scattered', 'Distracted', 'Okay', 'Focused', 'Sharp'] },
  { key: 'pre_trade_confidence', question: 'How sure were you about it?', words: ['Unsure', 'Doubtful', 'Okay', 'Confident', 'Certain'] },
];

function RatingRow({ n, word, picked, onPick }: { n: number; word: string; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full px-5 py-3.5 rounded-xl border text-[15px] transition-colors flex items-center justify-between gap-3
        focus-visible:outline-none focus-visible:border-brand-blue-light/60 ${
        picked
          ? 'border-brand-blue-light/60 bg-brand-blue/[0.12] text-white'
          : 'border-white/10 bg-brand-surface text-gray-200 hover:border-brand-blue-light/40 hover:bg-brand-blue/[0.07] hover:text-white'
      }`}
    >
      <span>{word}</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((d) => (
          <span key={d} className={`w-2.5 h-2.5 rounded-full ${d <= n ? 'bg-blue-400' : 'bg-white/10'}`} />
        ))}
      </span>
    </button>
  );
}

/*
  Nova returns formatted HTML. Rendering it with dangerouslySetInnerHTML
  would put model output straight into the page, so the text is pulled out of
  the markup instead and rendered as React - the structure survives, the
  injection surface does not.
*/
interface Line {
  text: string;
  heading: boolean;
}

function toLines(html: string | undefined): Line[] {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = [...doc.querySelectorAll('li, p, h1, h2, h3, h4')];
    const lines: Line[] = nodes
      .map((n) => ({
        text: (n.textContent ?? '').trim(),
        /*
          Nova writes real headings - "What happened", "Psychology" - and
          flattening them into the bullet list made them read as two
          mysteriously short bullets among the long ones. They are labels,
          so they are rendered as labels.
        */
        heading: /^H[1-4]$/.test(n.tagName),
      }))
      .filter((l) => l.text.length > 0);

    /* No markup at all - fall back to the plain text of the whole thing. */
    if (lines.length === 0) {
      const text = (doc.body.textContent ?? '').trim();
      return text ? [{ text, heading: false }] : [];
    }
    return lines;
  } catch {
    return [];
  }
}

/*
  One checklist line, in the two states that matter.

  Kept is a blue tick and broken is a grey cross, which is the app's own
  convention everywhere else - deliberately not the green/red every other
  journal uses. A rule Nova said nothing about is neither: it renders unmarked
  rather than being quietly counted as kept, because "not mentioned" and
  "followed" are not the same claim and only one of them is true.
*/
function CheckRow({ name, state }: { name: string; state: boolean | null }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex-shrink-0 w-4 h-4 mt-[2px] flex items-center justify-center">
        {state === true ? (
          <Check size={14} className="text-brand-blue-light" strokeWidth={2.5} />
        ) : state === false ? (
          <X size={14} className="text-gray-500" strokeWidth={2.5} />
        ) : (
          <span className="block w-1.5 h-1.5 rounded-full bg-white/15" />
        )}
      </span>
      <span className={`text-[13px] leading-relaxed ${state === false ? 'text-white' : 'text-gray-400'}`}>
        {name}
      </span>
    </li>
  );
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
  rules,
  psychChecks,
}: {
  /* Hands back whatever Nova produced, or null if they skipped or it failed. */
  onDone: (entry: VoiceJournalData | null, transcript: string) => void;
  /*
    Their starter checklist, built from the eight answers. Handed to Nova so
    she can mark which ones this trade kept and which it broke - which is
    what makes this look like a real entry rather than a demo of one, and
    what makes the checklist the plan screen promised actually exist.
  */
  rules: StarterItem[];
  psychChecks: StarterItem[];
}) {
  /* 0-2 are the three ratings, 3 is the text box. */
  const [phase, setPhase] = useState(0);
  const advancing = useRef(false);
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
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
        /*
          Confluences stay empty on purpose. They are the trader's own setup
          and nothing in the eight questions asks about it, so there is
          nothing honest to hand over.
        */
        [],
        rules,
        undefined,
        psychChecks,
        'trade',
        (partial) => setEntry((prev) => ({ ...(prev ?? {}), ...partial, ...ratings })),
      );
      /* What they tapped beats anything Nova read into the text. */
      const merged = { ...result, ...ratings };
      setEntry(merged);
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
    const scales: [string, number][] = (
      [
        ['Emotional state', entry.pre_trade_emotional_state],
        ['Focus', entry.pre_trade_focus],
        ['Confidence', entry.pre_trade_confidence],
      ] as [string, number | null | undefined][]
    )
      .filter((pair) => typeof pair[1] === 'number')
      .map((pair) => [pair[0], pair[1] as number]);

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
              <div className="flex flex-col gap-2">
                {lines.map((line, i) =>
                  line.heading ? (
                    <p
                      key={i}
                      className="text-[10px] uppercase tracking-[0.12em] text-gray-600 mt-2 first:mt-0"
                    >
                      {line.text}
                    </p>
                  ) : (
                    <div key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-gray-300">
                      <span className="flex-shrink-0 mt-[7px] w-1 h-1 rounded-full bg-brand-blue-light" />
                      <span>{line.text}</span>
                    </div>
                  ),
                )}
              </div>
            )}

            {(rules.length > 0 || psychChecks.length > 0) && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] grid sm:grid-cols-2 gap-5">
                {rules.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 mb-2.5">
                      Your rules
                    </p>
                    <ul className="flex flex-col gap-2">
                      {rules.map((r) => (
                        <CheckRow
                          key={r.id}
                          name={r.name}
                          state={entry.rules_status?.find((x) => x.id === r.id)?.followed ?? null}
                        />
                      ))}
                    </ul>
                  </div>
                )}

                {psychChecks.length > 0 && (
                  <div>
                    {/*
                      Forward-looking, not a verdict.

                      These are ticked BEFORE a trade, and this trade already
                      happened - so Nova has nothing to judge them against and
                      every one of them rendered blank, which read as three
                      failures rather than as three things that did not exist
                      yet. They are what the next entry starts with, so that
                      is what the label says.
                    */}
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 mb-2.5">
                      Before your next one
                    </p>
                    <ul className="flex flex-col gap-2">
                      {psychChecks.map((c) => (
                        <CheckRow
                          key={c.id}
                          name={c.name}
                          state={entry.psychology_status?.find((x) => x.id === c.id)?.confirmed ?? null}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/*
              The three scales, as the real control shows them. Nova returns
              these only when the trader actually said something about how
              they felt, so an omitted one stays omitted rather than being
              drawn as a zero.
            */}
            {(scales.length > 0 || (mood !== undefined && mood !== null)) && (
              <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex flex-wrap gap-x-6 gap-y-2">
                {scales.map(([label, value]) => (
                  <div key={label} className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">{label}</p>
                    <p className="text-[13px] text-gray-300">{value} / 5</p>
                  </div>
                ))}
                {scales.length === 0 && mood !== undefined && mood !== null && (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">Going in</p>
                    <p className="text-[13px] text-gray-300">{mood} / 5</p>
                  </div>
                )}
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

  if (phase < RATINGS.length) {
    const r = RATINGS[phase];
    const pick = (n: number) => {
      /* A double tap would otherwise skip the next question unseen. */
      if (advancing.current) return;
      advancing.current = true;
      setRatings((prev) => ({ ...prev, [r.key]: n }));
      trackEvent('onboarding_entry_rating', { scale: r.key, value: n });
      /* Long enough to see the row light up, short enough not to feel like waiting. */
      window.setTimeout(() => {
        advancing.current = false;
        setPhase((p) => p + 1);
      }, 220);
    };
    return (
      <div>
        {phase === 0 && (
          <MascotSays pose="lean" height={80} side="above" className="mb-6">
            Think of your last losing trade.
          </MascotSays>
        )}
        <p className="text-center text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-3">
          Your first entry &middot; {phase + 1} of {RATINGS.length + 1}
        </p>
        <h1 className="text-[26px] sm:text-[31px] leading-[1.15] font-semibold tracking-[-0.032em]
          text-white text-center text-balance mb-6">
          {r.question}
        </h1>
        <div key={r.key} className="flex flex-col gap-2.5">
          {r.words.map((word, i) => (
            <RatingRow key={word} n={i + 1} word={word} picked={ratings[r.key] === i + 1} onPick={() => pick(i + 1)} />
          ))}
        </div>
        {/* Skippable from the first question too - see SKIPPABLE ON PURPOSE above. */}
        <button
          type="button"
          onClick={() => {
            if (phase > 0) return setPhase((p) => p - 1);
            trackEvent('onboarding_entry_skipped', { at: 'ratings' });
            onDone(null, '');
          }}
          className="mt-4 w-full text-center text-[13px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          {phase > 0 ? 'Back' : 'Skip for now'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <MascotSays pose="lean" height={80} side="above" className="mb-6">
        {writing ? 'Reading it now…' : 'However you’d say it out loud.'}
      </MascotSays>

      <p className="text-center text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-3">
        Your first entry &middot; {RATINGS.length + 1} of {RATINGS.length + 1}
      </p>
      <h1 className="text-[26px] sm:text-[31px] leading-[1.15] font-semibold tracking-[-0.032em]
        text-white text-center text-balance mb-2">
        Now tell Nova what happened.
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
