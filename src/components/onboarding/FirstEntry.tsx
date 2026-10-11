import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, Loader2, Check, X, Trophy } from 'lucide-react';
import { processVoiceJournalEntry, type VoiceJournalData } from '../../services/voiceJournal';
import { useVoice } from '../../hooks/useVoice';
import { trackEvent } from '../../lib/productAnalytics';
import MascotSays from '../shared/MascotSays';
import Mascot from '../shared/Mascot';
import type { StarterItem } from '../../lib/onboardingChecklist';
import { calculateChecklistScore, combinePsychologyScores } from '../../services/psychologyScore';

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

/*
  About three minutes of talking. The server refuses more than 2,000
  characters from an account that has not paid (process-voice-journal);
  this keeps the box under that so nobody types a paragraph only to be told
  it is too long.
*/
const MAX_CHARS = 1500;

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

export default function FirstEntry({
  onDone,
  rules,
  psychChecks,
  goalDays = null,
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
  /* The 7 / 14 / 30 / 66 they committed to, for the celebration's "1 of N". */
  goalDays?: number | null;
}) {
  /* 0-2 are the three ratings, 3 is the text box. */
  const [phase, setPhase] = useState(0);
  const advancing = useRef(false);
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [text, setText] = useState('');
  const [writing, setWriting] = useState(false);
  const [entry, setEntry] = useState<VoiceJournalData | null>(null);
  const [failed, setFailed] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const { isSupported, isListening, startListening, stopListening } = useVoice({
    onTranscript: (t: string) => setText((prev) => (prev ? `${prev} ${t}` : t).slice(0, MAX_CHARS)),
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

  /*
    DAY ONE, CELEBRATED - BEFORE THE ENTRY IS SHOWN.

    Duolingo ends every lesson on a celebration screen, and the research
    behind it is solid: small wins that are noticed are the strongest
    day-to-day motivator people report (Amabile & Kramer's progress
    principle), and a goal that already shows progress gets finished faster
    than one starting from zero - the coffee-card study where two free
    stamps made people fill the card sooner (Kivetz, Urminsky & Zheng's
    goal-gradient effect). So the screen says the first entry is done and
    puts it on their own goal as day 1 of N, already filled in.
  */
  if (entry && !writing && !celebrated) {
    const target = goalDays && goalDays > 0 ? goalDays : null;
    return (
      <div className="text-center">
        <div className="relative mx-auto mb-2 w-fit">
          <Mascot pose="arms" height={110} className="mx-auto" />
          {/* A small burst behind the trophy - drawn, not an emoji. */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
            className="absolute -right-16 top-6 w-12 h-12 rounded-full bg-blue-500/15 border border-blue-400/40
              flex items-center justify-center"
          >
            <Trophy size={22} className="text-blue-400" strokeWidth={2} />
          </motion.div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute -right-[42px] top-[46px] w-1.5 h-1.5 rounded-full bg-blue-400"
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.cos((i / 6) * Math.PI * 2) * 38,
                y: Math.sin((i / 6) * Math.PI * 2) * 38,
              }}
              transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
            />
          ))}
        </div>

        <h1 className="text-[28px] sm:text-[34px] leading-[1.12] font-semibold tracking-[-0.035em] text-white">
          Day one, done.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-gray-400 max-w-xs mx-auto">
          Your first entry is written. That&rsquo;s the hardest one.
        </p>

        {target && (
          <div className="mt-7 max-w-xs mx-auto">
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: Math.min(target, 30) }).map((_, i) => (
                <motion.span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-blue-400' : 'bg-white/10'}`}
                  initial={i === 0 ? { scaleX: 0 } : false}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  style={{ originX: 0 }}
                />
              ))}
            </div>
            <p className="mt-2.5 text-[12.5px] text-gray-500">
              <span className="text-white font-medium">1</span> of your {target} trading days
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            trackEvent('onboarding_entry_celebrated');
            setCelebrated(true);
          }}
          className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full
            bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
        >
          See my entry
          <ArrowRight size={17} />
        </button>
      </div>
    );
  }

  if (entry && !writing) {
    const pnl = entry.manual_pnl;
    const facts = [
      entry.symbol,
      entry.direction,
      entry.position_size,
    ].filter(Boolean) as string[];

    /*
      THEIR NOTES, ORGANISED - NOT A SUMMARY OF THEM.

      An earlier version led with one "Nova noticed" sentence and hid the rest
      behind a tap. Brandon's call: the point of this screen is that their
      messy sentence came back as a tidy journal entry, so show the entry -
      Nova's sections, as short headings, each line on a blue bullet - exactly
      what lands in their journal. The first version's problem was density,
      not content: full-width grey paragraphs. Bullets and spacing fix that.
    */
    /*
      One point per bullet, not one paragraph per bullet.

      Nova writes each section as a couple of full sentences, which on this
      screen read like the transcript they had just typed. Here every
      sentence becomes its own short bullet under its heading; the opening
      summary line is dropped, because the facts row above already says it;
      rule lines Nova marks with a tick or a cross get a real check or X; and
      no section runs past two points. The full text still lands in their
      journal untouched - this is only how the first one is shown.
    */
    const splitSentences = (t: string) =>
      t.split(/(?<=[.!?])\s+(?=[A-Z"“(])/).map((x) => x.trim().replace(/[.]$/, '')).filter(Boolean);
    type Item = { text: string; mark: 'kept' | 'broke' | null };
    const sections: { heading: string; items: Item[] }[] = [];
    for (const line of lines) {
      if (line.heading) {
        sections.push({ heading: line.text, items: [] });
        continue;
      }
      if (!sections.length) continue; /* the unheaded summary - the facts row covers it */
      const mark = /^[✓✔]/.test(line.text) ? 'kept' : /^[✗✘×]/.test(line.text) ? 'broke' : null;
      const body = line.text.replace(/^[✓✔✗✘×]\s*/, '');
      const current = sections[sections.length - 1];
      for (const sentence of mark ? [body] : splitSentences(body)) {
        if (current.items.length < 2) current.items.push({ text: sentence, mark });
      }
    }
    if (!sections.length && lines.length) {
      sections.push({ heading: 'What happened', items: lines.flatMap((l) => splitSentences(l.text)).slice(0, 3).map((text) => ({ text, mark: null })) });
    }

    const ratings = RATINGS.map((r) => ({ r, value: entry[r.key] })).filter(
      (x): x is { r: (typeof RATINGS)[number]; value: number } => typeof x.value === 'number',
    );


    /*
      The trade's psychology score - the same calculation the journal runs
      on a saved entry (calculateChecklistScore, then combinePsychologyScores
      with no written template yet), from the same inputs: their three
      ratings and whichever pre-trade checks Nova could answer. So the number
      shown here is the number they find on this entry inside the app.
    */
    const answeredChecks = (entry.psychology_status ?? []).filter((c) => c.confirmed !== null && c.confirmed !== undefined).length;
    const psychScore = combinePsychologyScores(
      null,
      calculateChecklistScore(answeredChecks, [entry.pre_trade_emotional_state, entry.pre_trade_focus, entry.pre_trade_confidence]),
    );

    return (
      <div>
        <h1 className="text-[26px] sm:text-[32px] leading-[1.14] font-semibold tracking-[-0.035em]
          text-white text-center text-balance mb-2">
          That took you thirty seconds.
        </h1>
        <p className="text-center text-[14px] text-gray-400 leading-relaxed max-w-md mx-auto mb-6">
          Other journals log the numbers. This one logged what you were like.
        </p>

        <div className="rounded-2xl border border-white/10 bg-brand-surface overflow-hidden">
          {/* The trade, as one line of facts. */}
          <div className="px-4 py-3.5 border-b border-white/[0.06] bg-brand-elevated flex items-center justify-between gap-3">
            <p className="text-[13.5px] text-white font-medium truncate">
              {facts.length ? facts.join(' · ') : entry.title || 'Your trade'}
            </p>
            {pnl !== undefined && pnl !== null && (
              /* Blue for a gain, grey for a loss - the app's own convention, not green/red. */
              <p className={`text-[14px] font-medium tabular-nums flex-shrink-0 ${pnl >= 0 ? 'text-brand-blue-light' : 'text-gray-400'}`}>
                {pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toLocaleString()}
              </p>
            )}
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Going in - their own three taps, drawn the way the journal draws them, under the score they add up to. */}
            {ratings.length > 0 && (
              <div className="flex flex-col gap-2">
                {psychScore !== null && (
                  <div className="mb-1.5 flex items-center gap-3.5">
                    <div className="relative w-14 h-14 flex-shrink-0" aria-hidden="true">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                        <motion.circle
                          cx="18" cy="18" r="15.5" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={97.4}
                          initial={{ strokeDashoffset: 97.4 }}
                          animate={{ strokeDashoffset: 97.4 * (1 - psychScore / 100) }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-white tabular-nums">
                        {psychScore}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-blue-400">Psychology score</p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-gray-400">
                        Out of 100, for this trade &mdash; from how you were going in.
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">Going in</p>
                {ratings.map(({ r, value }) => (
                  <div key={r.key} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-gray-300">{r.words[value - 1]}</span>
                    <span className="flex items-center gap-1.5" aria-label={`${value} of 5`}>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <span key={d} className={`w-2 h-2 rounded-full ${d <= value ? 'bg-blue-400' : 'bg-white/10'}`} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {sections.length > 0 && (
              <div className="flex flex-col gap-3.5">
                {/* Two sections, two points each: this screen has to fit one phone screen. */}
                {sections.filter((sec) => sec.items.length > 0).slice(0, 2).map((sec, si) => (
                  <div key={si}>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-blue-400 mb-1.5">{sec.heading}</p>
                    <ul className="flex flex-col gap-1.5">
                      {sec.items.map((item, ii) => (
                        <li key={ii} className="flex gap-2.5 text-[13px] leading-snug text-gray-200">
                          {item.mark === 'kept' ? (
                            <Check size={14} className="flex-shrink-0 mt-[2px] text-blue-400" strokeWidth={2.75} />
                          ) : item.mark === 'broke' ? (
                            <X size={14} className="flex-shrink-0 mt-[2px] text-gray-500" strokeWidth={2.75} />
                          ) : (
                            <span className="flex-shrink-0 mt-[6px] w-1.5 h-1.5 rounded-full bg-blue-400" aria-hidden="true" />
                          )}
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/*
              The starter checklist used to be listed here too. Dropped to keep
              this screen to one phone screen - it is still created in their
              journal (onboardingWriteBack), and the plan screens already
              told them what it is for.
            */}
          </div>
        </div>

        {/*
          THE HAND-OFF TO THE PRICE.

          Was "That is one. The pattern needs thirty." over "Start 14 days
          free" - true, but it pointed at the twenty-nine entries still to
          write rather than at the one they just made. People value what
          they have just built far above what it would cost to get (the
          endowment and IKEA effects - Kahneman, Knetsch & Thaler; Norton,
          Mochon & Ariely), and this entry genuinely is held until they
          subscribe (see onboardingWriteBack). So the button offers to keep
          it, in their own voice: "my", which in Aagaard's widely cited CTA
          test beat "your" on the same free-trial button.
        */}
        <p className="mt-6 text-center text-[15px] sm:text-[16px] leading-[1.5] text-white text-balance max-w-lg mx-auto">
          Your first entry is ready to save.
        </p>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => onDone(entry, text.trim())}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full
              bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
          >
            Save it &amp; start my 14 days free
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
        {/* No mascot here: with it this screen was 618px and scrolled on most iPhones. */}
        <p className="text-center text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-3">
          Your first entry &middot; {phase + 1} of {RATINGS.length + 1}
        </p>
        {phase === 0 && (
          <p className="text-center text-[14px] text-gray-400 mb-1.5">Think of your last losing trade.</p>
        )}
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
      <MascotSays pose="lean" height={56} side="above" className="mb-4">
        {writing ? 'Reading it now…' : 'Messy is fine. I’ll sort it out.'}
      </MascotSays>

      <p className="text-center text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-3">
        Your first entry &middot; {RATINGS.length + 1} of {RATINGS.length + 1}
      </p>
      <h1 className="text-[26px] sm:text-[31px] leading-[1.15] font-semibold tracking-[-0.032em]
        text-white text-center text-balance mb-2">
        Now tell Nova what happened.
      </h1>
      {/*
        Says "type" first on purpose. Most of this traffic arrives in
        Instagram's in-app browser, where there is no mic at all - so the
        box is the main way in, and somebody who only saw "tell" and "say"
        would go looking for a record button that is not there.
      */}
      <p className="text-center text-[13.5px] text-gray-500 mb-6">
        {isSupported
          ? 'Type it or tap the mic. A sentence or two, messy is fine.'
          : 'Type it like you’d text a friend. A sentence or two, messy is fine.'}
      </p>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          maxLength={MAX_CHARS}
          disabled={writing}
          rows={4}
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

      {text.length > MAX_CHARS - 200 && (
        <p className="mt-2 text-right text-[11.5px] text-gray-500 tabular-nums">
          {MAX_CHARS - text.length} characters left
        </p>
      )}

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
