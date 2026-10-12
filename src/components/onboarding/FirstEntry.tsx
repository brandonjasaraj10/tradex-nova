import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mic, Loader2, Check, Trophy } from 'lucide-react';
import { processVoiceJournalEntry, type VoiceJournalData } from '../../services/voiceJournal';
import { useVoice } from '../../hooks/useVoice';
import { useRecorder } from '../../hooks/useRecorder';
import { trackEvent } from '../../lib/productAnalytics';
import NovaTalk from './NovaTalk';
import NovaClip from '../shared/NovaClip';
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

/* Confetti pieces for the day-one celebration - fixed, so every render throws the same burst. */
const CONFETTI_COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#FFFFFF', '#2563EB'];
export const CONFETTI = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    x: r(1) * 100,
    w: 4 + r(2) * 4,
    h: 7 + r(3) * 6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    spin: (r(4) - 0.5) * 720,
    drift: (r(5) - 0.5) * 60,
    dur: 1.6 + r(6) * 0.9,
    delay: r(7) * 0.35,
  };
});

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

/* Nova's first line on the entry screens - the onboarding shows it before this screen mounts. */
export const FIRST_ENTRY_QUESTION = 'Going in, how steady were you?';
export const FIRST_ENTRY_SUBTITLE = 'Think of your last losing trade — they teach the most.';

const RATINGS: { key: RatingKey; question: string; words: [string, string, string, string, string] }[] = [
  { key: 'pre_trade_emotional_state', question: FIRST_ENTRY_QUESTION, words: ['Rattled', 'Uneasy', 'Okay', 'Calm', 'Steady'] },
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

/* Nova's write-up as notes: short blue headings, every line on a blue bullet. Used live and on the result. */
function NotesList({ lines }: { lines: Line[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) =>
        line.heading ? (
          <p key={i} className="text-[10px] uppercase tracking-[0.12em] text-blue-400 mt-1.5 first:mt-0">{line.text}</p>
        ) : (
          <p key={i} className="flex gap-2.5 text-[13px] leading-snug text-gray-200">
            <span className="flex-shrink-0 mt-[6px] w-1.5 h-1.5 rounded-full bg-blue-400" aria-hidden="true" />
            <span>{line.text}</span>
          </p>
        ),
      )}
    </div>
  );
}

/* Five bars moving while the mic is on - so it plainly looks like it is hearing you. */
function Waveform() {
  return (
    <span className="flex items-center gap-[3px] h-4" aria-hidden="true">
      {[0.9, 0.6, 1.1, 0.7, 0.95].map((d, i) => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-full bg-brand-blue-light"
          animate={{ height: [4, 14, 6, 12, 4] }}
          transition={{ duration: d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
        />
      ))}
    </span>
  );
}

export default function FirstEntry({
  onDone,
  rules,
  psychChecks,
  goalDays = null,
  onTalk,
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
  /*
    When given, the onboarding's own Nova says these lines instead of this
    screen drawing a second one. Swapping Nova for a new one between the
    plan and the first question is what made him vanish for a moment
    (Brandon: "Nova disappears and it's just the 3 benefits for a second").
    Null means no line: the celebration and the finished entry.
  */
  onTalk?: (t: { text: string; subtitle?: string } | null) => void;
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

  /*
    VOICE THAT WORKS LIKE NOVA'S VOICE INPUT IN THE APP.

    Brandon: the whole point is that you tap the mic and watch it come up as
    you talk. So, as in the journal: the browser's own speech recognition,
    with every word shown live in the box as it is heard (onInterim), and the
    moment they stop - by tapping, or by pausing for three seconds - Nova
    starts writing it up with no extra tap, the notes building on screen as
    they stream in.

    Where the browser has no speech recognition at all (Instagram's in-app
    browser, most notably) it falls back to recording the clip and
    transcribing it on the server (transcribe-audio), then writes it up the
    same way.

    The text already in the box when they start talking is kept: live words
    are added after it rather than replacing it.
  */
  /*
    LIVE, LIKE THE REAL JOURNAL.

    Talking: the words show in the box as they are heard, and every few
    sentences Nova re-organises everything said so far into notes that
    build underneath - the same live organise the journal does. When they
    stop (tap, or a three-second pause) the last pass finishes and the
    screen moves on by itself. The first version only organised after they
    stopped, then showed a spinner and a half-drawn preview; on a phone that
    read as laggy, and it did not always move on.

    Typing still uses the button: there is no moment of "finished talking"
    to wait for.

    One pass at a time. A pass asked for while one is running is remembered,
    and only the newest is run when the current one lands, so a fast talker
    never stacks up requests. If the last pass already covered every word,
    its result is the entry - no extra call.
  */
  const NEW_CHARS_PER_PASS = 70;
  const baseTextRef = useRef('');
  const join = (a: string, b: string) => `${a} ${b}`.trim().slice(0, MAX_CHARS);
  const [live, setLive] = useState<VoiceJournalData | null>(null);
  const [finishing, setFinishing] = useState(false);
  const inflightRef = useRef<Promise<VoiceJournalData | null> | null>(null);
  const organizedTextRef = useRef('');
  const pendingRef = useRef<string | null>(null);
  const lastResultRef = useRef<VoiceJournalData | null>(null);

  const organize = (transcript: string): Promise<VoiceJournalData | null> => {
    if (inflightRef.current) {
      pendingRef.current = transcript;
      return inflightRef.current;
    }
    organizedTextRef.current = transcript;
    const p = processVoiceJournalEntry(
      transcript,
      undefined,
      /* Confluences stay empty: they are the trader's own setup and nothing in onboarding asks about it. */
      [],
      rules,
      undefined,
      psychChecks,
      'trade',
      /*
        Partial results are NOT painted. A new pass streams its write-up from
        the start, so showing it meant the notes on screen blanked and
        rebuilt every few sentences - and once more on finishing, which is
        what Brandon saw as the notes disappearing and coming back. The last
        finished version stays up until the next one has fully landed.
      */
      undefined,
    )
      .then((result) => {
        lastResultRef.current = result;
        setLive(result);
        return result;
      })
      .catch((err) => {
        console.error('Live organise failed:', err);
        return null;
      })
      .finally(() => {
        inflightRef.current = null;
        const next = pendingRef.current;
        pendingRef.current = null;
        if (next && next !== organizedTextRef.current) void organize(next);
      });
    inflightRef.current = p;
    return p;
  };

  /* End of speaking: let the running pass land, run one more only if words were added since, then move on. */
  const finishingRef = useRef(false);
  const finishSpoken = async (transcript: string) => {
    /* Once only: the pause and a tap on the button can both ask to finish. */
    if (!transcript.trim() || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setFailed(false);
    trackEvent('onboarding_entry_started', { chars: transcript.length, via: 'voice' });
    try {
      if (inflightRef.current) await inflightRef.current;
      pendingRef.current = null;
      /* Within a few characters (punctuation, a trailing word) the last pass already IS the entry. */
      const covered = lastResultRef.current && transcript.length - organizedTextRef.current.length <= 25
        && transcript.startsWith(organizedTextRef.current.slice(0, Math.max(0, organizedTextRef.current.length - 5)));
      let result = covered ? lastResultRef.current : null;
      if (!result) result = await organize(transcript);
      if (!result) throw new Error('no entry');
      const merged = { ...result, ...ratings };
      setEntry(merged);
      trackEvent('onboarding_entry_written', { symbol: result.symbol ?? null, via: 'voice' });
    } catch (err) {
      console.error('Could not write the first entry:', err);
      setFailed(true);
      trackEvent('onboarding_entry_failed');
    } finally {
      setFinishing(false);
      finishingRef.current = false;
    }
  };

  const onHeard = (t: string) => {
    const full = join(baseTextRef.current, t);
    setText(full);
    if (full.length - organizedTextRef.current.length >= NEW_CHARS_PER_PASS) void organize(full);
  };
  const finishRef = useRef(finishSpoken);
  finishRef.current = finishSpoken;
  const speech = useVoice({
    onInterim: onHeard,
    onTranscript: (t: string) => {
      const full = join(baseTextRef.current, t);
      setText(full);
      void finishRef.current(full);
    },
  });
  const recorder = useRecorder((t: string) => {
    const full = join(baseTextRef.current, t);
    setText(full);
    void finishRef.current(full);
  });
  const useSpeech = speech.isSupported;
  const isSupported = useSpeech || recorder.isSupported;
  const isListening = useSpeech ? speech.isListening : recorder.isRecording;
  const transcribing = !useSpeech && recorder.isTranscribing;
  /* True once they have spoken; typing into the box clears it. */
  const spokenRef = useRef(false);
  const toggleMic = () => {
    if (isListening) return useSpeech ? speech.stopListening() : recorder.stop();
    spokenRef.current = true;
    baseTextRef.current = text;
    setLive(null);
    organizedTextRef.current = '';
    lastResultRef.current = null;
    return useSpeech ? speech.startListening() : void recorder.start();
  };

  const lines = useMemo(() => toLines(entry?.content), [entry?.content]);
  const liveLines = useMemo(() => toLines(live?.content), [live?.content]);

  /* Typed path: one organise, on the button. */
  const run = async () => {
    const transcript = text.trim();
    if (!transcript || writing || finishing) return;
    /* Spoken, then the button tapped before the pause ended it: finish the spoken entry, never redo it. */
    if (spokenRef.current) return void finishSpoken(transcript);
    setWriting(true);
    setFailed(false);
    trackEvent('onboarding_entry_started', { chars: transcript.length, via: 'typed' });
    try {
      const result = await processVoiceJournalEntry(
        transcript, undefined, [], rules, undefined, psychChecks, 'trade',
        (partial) => setLive((prev) => ({ ...(prev ?? {}), ...partial })),
      );
      setLive(result);
      setEntry({ ...result, ...ratings });
      trackEvent('onboarding_entry_written', { symbol: result.symbol ?? null, via: 'typed' });
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
  const busy = writing || finishing;

  const talkText =
    phase < RATINGS.length
      ? RATINGS[phase].question
      : busy
        ? 'Finishing up your entry…'
        : isListening
          ? 'Keep going. What were you thinking?'
          : isSupported ? 'Now talk me through what happened.' : 'Now tell me what happened.';
  const talkSubtitle =
    phase < RATINGS.length
      ? phase === 0 ? FIRST_ENTRY_SUBTITLE : undefined
      : busy || isListening
        ? undefined
        : isSupported
          /* Voice first: people say far more than they type, and more is what Nova needs. */
          ? 'Tap the mic and just talk. The more you say, the more I spot.'
          : 'Type it like you’d text a friend. Messy is fine.';
  const talking = !(entry && !busy);
  useEffect(() => {
    onTalk?.(talking ? { text: talkText, subtitle: talkSubtitle } : null);
  }, [onTalk, talking, talkText, talkSubtitle]);

  if (entry && !busy && !celebrated) {
    const target = goalDays && goalDays > 0 ? goalDays : null;
    /* This week, Sunday first, the way Duolingo's streak row reads. */
    const now = new Date();
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => ({
      label,
      today: i === now.getDay(),
      tomorrow: i === (now.getDay() + 1) % 7,
    }));
    return (
      <motion.div
        className="relative text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/*
          Confetti, once, in the brand's blues and white - Duolingo throws
          confetti at exactly this moment. Small rectangles that fall and
          tumble over about two seconds, then are gone; nothing loops.
        */}
        <div className="pointer-events-none absolute inset-x-0 -top-16 h-[420px] overflow-hidden" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <motion.span
              key={i}
              className="absolute top-0 rounded-[1px]"
              style={{ left: `${c.x}%`, width: c.w, height: c.h, backgroundColor: c.color }}
              initial={{ y: -20, opacity: 0, rotate: 0 }}
              animate={{ y: [ -20, 380 ], opacity: [0, 1, 1, 0], rotate: c.spin, x: [0, c.drift] }}
              transition={{ duration: c.dur, delay: c.delay, ease: 'easeIn' }}
            />
          ))}
        </div>
        <div className="relative mx-auto mb-2 w-fit">
          {/*
            Nova appears here and celebrates - no glide in from the screen
            before; Brandon preferred him simply showing up.
          */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.8, 0.3, 1] }}
          >
            <NovaClip action="celebrate" height={104} className="mx-auto" />
          </motion.div>
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

        {/*
          "Tomorrow is day 2", Duolingo's streak screen: this week, today
          ticked, tomorrow waiting. It turns one entry into the start of a
          run and gives them a reason to come back tomorrow specifically.
        */}
        <div className="mt-7 max-w-xs mx-auto">
          <p className="text-[15px] font-semibold text-white">Tomorrow is day 2{target ? ` of ${target}` : ''}.</p>
          <div className="mt-3.5 flex justify-between" aria-hidden="true">
            {weekDays.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10.5px] text-gray-500">{d.label}</span>
                {d.today ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.5 }}
                    className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center"
                  >
                    <Check size={15} className="text-white" strokeWidth={3} />
                  </motion.span>
                ) : d.tomorrow ? (
                  <span className="w-7 h-7 rounded-full border-2 border-dashed border-blue-400/60" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-white/[0.07]" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-gray-500">Journal your next trade to keep it going.</p>
        </div>

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
      </motion.div>
    );
  }

  if (entry && !busy) {
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

            {/*
              The notes exactly as they looked while they were talking - same
              headings, same blue bullets. Brandon noticed this breakdown used
              to look less clean than the live version, because it re-cut
              Nova's text into sentence fragments; it now shows what Nova
              wrote, which is also exactly what lands in their journal.
            */}
            {lines.length > 0 && <NotesList lines={lines} />}

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

  /*
    Nova asks every question on these screens too, in the same layout as the
    rest of onboarding - and as the first child of each screen below, so
    React keeps the same Nova from question to question and his idle
    animation carries on rather than restarting.
  */
  const header = onTalk ? null : <NovaTalk text={talkText} subtitle={talkSubtitle} />;

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
      }, 550);
    };
    return (
      <div>
        {header}
        {/*
          Best at the top, 5 down to 1 - Brandon's call; it reads like a
          scale you go down rather than a list.

          And the three questions look alike, so the change has to be seen:
          the answers fade down and out, Nova bounces as he asks the next one,
          and the new set comes in one row at a time.
        */}
        <AnimatePresence mode="wait">
          <motion.div
            key={r.key}
            className="flex flex-col gap-2.5"
            exit={{ opacity: 0, y: 10, transition: { duration: 0.35, ease: 'easeIn' } }}
          >
            {r.words.map((word, i) => ({ word, n: i + 1 })).reverse().map(({ word, n }, row) => (
              <motion.div
                key={word}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + row * 0.1, duration: 0.45, ease: 'easeOut' }}
              >
                <RatingRow n={n} word={word} picked={ratings[r.key] === n} onPick={() => pick(n)} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
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
      {header}

      {/*
        VOICE FIRST. Brandon wanted people talking rather than typing - they
        say far more out loud, which is what Nova needs to spot anything -
        and the old mic was a small grey circle in the corner of the box that
        read as a text tool. Now it is the main control: a big blue mic, a
        live waveform while it listens. Typing still works, underneath.
      */}
      {isSupported && !busy && (
        <div className="flex flex-col items-center mb-5">
          <button
            type="button"
            disabled={transcribing}
            onClick={toggleMic}
            aria-label={isListening ? 'Stop recording' : 'Tap to talk'}
            className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-white text-black'
                : 'bg-brand-blue text-white shadow-[0_0_28px_rgba(59,130,246,0.45)] hover:bg-brand-blue-light'
            }`}
          >
            {transcribing ? (
              <Loader2 size={26} className="animate-spin" />
            ) : isListening ? (
              <span className="block w-5 h-5 rounded-[5px] bg-black" />
            ) : (
              <Mic size={28} strokeWidth={2.2} />
            )}
          </button>
          <div className="mt-3 h-5 flex items-center gap-2.5 text-[13px]">
            {isListening ? (
              <>
                <Waveform />
                <span className="text-gray-300 tabular-nums">
                  {useSpeech
                    ? 'Listening, keep talking'
                    : `Recording ${Math.floor(recorder.seconds / 60)}:${String(recorder.seconds % 60).padStart(2, '0')}`}
                </span>
              </>
            ) : transcribing ? (
              <span className="text-gray-400">Turning that into text…</span>
            ) : (
              <span className="text-gray-400">Tap and talk it through</span>
            )}
          </div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          spokenRef.current = false;
          setText(e.target.value.slice(0, MAX_CHARS));
        }}
        maxLength={MAX_CHARS}
        disabled={busy || isListening}
        rows={isSupported ? 3 : 4}
        placeholder={isSupported ? 'Or type it here. Messy is fine.' : PLACEHOLDER}
        className="w-full rounded-xl border border-white/10 bg-brand-surface px-4 py-3.5
          text-[15px] leading-relaxed text-gray-100 placeholder:text-gray-600
          focus:outline-none focus:border-brand-blue-light/50 disabled:opacity-60 resize-none"
      />

      {recorder.error && !useSpeech && <p className="mt-2 text-[12.5px] text-gray-400">{recorder.error}</p>}

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
        disabled={!text.trim() || busy || isListening}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 px-8 py-3.5
          rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-200
          transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        {busy ? (
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

      {/* Nova's notes building as they talk - only finished passes, so they never blank and rebuild. */}
      {(isListening || busy) && liveLines.some((l) => !l.heading) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="mt-4 rounded-xl border border-white/10 bg-brand-surface px-4 py-3.5">
          <NotesList lines={liveLines} />
        </motion.div>
      )}

      {!busy && !isListening && (
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
