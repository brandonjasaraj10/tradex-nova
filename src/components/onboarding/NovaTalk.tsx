import { Fragment, useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import NovaClip, { type NovaAction } from '../shared/NovaClip';

/*
  Nova saying something - and moving through the flow like a guide.

  Brandon's brief, from Duolingo: the whole onboarding should feel like one
  journey, not a stack of screens, with the character doing the moving.
  So Nova has two places to be:

  - 'hero': centre stage, bigger, the bubble above him - for the moments
    that are a story beat (hello, the gap, thinking, your pattern, the
    celebration).
  - 'side': beside the question, the bubble to his right - for the run of
    questions.

  Going from one to the other, he GLIDES there: the figure and the bubble
  carry shared layout ids, so framer animates the same Nova from where he
  was to where he is going, even across screens and components. Nothing
  else on the page moves.

  And on the very first screen he walks in from the side before he speaks.

  PACE: slow and unhurried at Brandon's request - soft word fades,
  long glides.
*/

/*
  How a line appears. Letter-by-letter typing, with the typing dots and a
  bubble that grew as it went, looked cheap to Brandon ("way more clean,
  simple, on brand"). Now the bubble arrives at its full size and the words
  fade up in one soft sweep - quick, quiet, nothing jumping.
*/
const WORD_STEP_MS = 45;
const WORD_FADE_S = 0.4;
const GLIDE = { duration: 1.1, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

/* How long the words take to finish appearing. */
function revealMs(text: string) {
  return text.split(/\s+/).length * WORD_STEP_MS + WORD_FADE_S * 1000;
}

/* True once the whole line is showing, so the subtitle can follow it. */
function useRevealed(text: string, startDelayMs = 0) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    const t = window.setTimeout(() => setDone(true), startDelayMs + revealMs(text));
    return () => window.clearTimeout(t);
  }, [text, startDelayMs]);
  return done;
}

/* How long a reply should stay up: the words appearing, then time to actually read it. */
export function replyHoldMs(text: string) {
  return revealMs(text) + 2200;
}

/* How long the walk-in takes, so the bubble can wait for it. */
const WALK_MS = 1100;

export default function NovaTalk({
  text,
  subtitle,
  action,
  actionKey,
  reacting = false,
  variant = 'side',
  entrance,
}: {
  text: string;
  subtitle?: string;
  /* A one-off movement over his idle loop (wave on the first screens, nod on a reply). */
  action?: NovaAction;
  actionKey?: string | number;
  /* True while Nova is answering back: a gentle bounce. */
  reacting?: boolean;
  variant?: 'hero' | 'side';
  /* 'walk': he walks in from the left before speaking. Only on first appearance. */
  entrance?: 'walk';
}) {
  const [walked] = useState(entrance === 'walk');
  /* True only while the walk is happening, so the step-bob runs once and never again. */
  const [walking, setWalking] = useState(entrance === 'walk');
  useEffect(() => {
    if (!walking) return;
    const t = window.setTimeout(() => setWalking(false), WALK_MS);
    return () => window.clearTimeout(t);
  }, [walking]);
  const startDelay = walked ? WALK_MS : 0;
  const revealed = useRevealed(text, startDelay);
  const hero = variant === 'hero';
  /*
    Smaller than before. The animation frames are 320px; drawn much bigger
    than that they soften, and Brandon noticed Nova looking low-quality at
    the larger sizes. At these sizes every frame is shown sharper than 1:1.
  */
  const size = hero ? 104 : 72;

  /* The bubble glides with Nova only when he changes places; otherwise it just grows with the words. */
  const prevVariant = useRef(variant);
  const changedPlace = prevVariant.current !== variant;
  useEffect(() => {
    prevVariant.current = variant;
  }, [variant]);

  /* A slow settle when he says something new; a gentle bounce when he replies. */
  const body = useAnimationControls();
  useEffect(() => {
    if (reacting) {
      void body.start({ y: [0, -10, 0, -4, 0], transition: { duration: 1.6, ease: 'easeInOut' } });
    } else {
      void body.start({ y: [3, 0], transition: { duration: 0.9, ease: 'easeOut' } });
    }
  }, [text, reacting, body]);

  const figure = (
    <motion.div layoutId="nova-figure" layout transition={GLIDE} className="relative flex-shrink-0">
      {/* The walk: in from the left, a step-bob as he comes, then settled. */}
      {/*
        'walk' is now a soft appear: Brandon found the walk in from the side
        looked bad. He fades up in place with a slight rise, then speaks.
      */}
      <motion.div
        initial={walked ? { opacity: 0, scale: 0.92, y: 8 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: WALK_MS / 1000, ease: [0.25, 0.8, 0.3, 1] }}
      >
        <motion.div
          initial={false}
          animate={{ y: 0, rotate: 0 }}
          transition={{ duration: WALK_MS / 1000, ease: 'easeInOut' }}
        >
          <motion.div
            className="origin-bottom"
          >
            <motion.div animate={body} className="relative origin-bottom">
              <NovaClip height={size} action={walking ? undefined : action} actionKey={actionKey} />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );

  const bubble = (
    <motion.div
      layoutId="nova-bubble"
      layout
      /* Sized to the whole line from the start; it eases to the new size when the line changes. */
      transition={{ layout: changedPlace ? GLIDE : { duration: 0.35, ease: 'easeOut' } }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ originX: hero ? 0.5 : 0, originY: hero ? 1 : 0.5 }}
      className={`relative z-10 rounded-2xl border border-white/10 bg-brand-elevated px-4 py-3 w-fit ${
        hero ? 'max-w-sm text-center mb-3' : 'mt-3 max-w-[calc(100%-6rem)]'
      }`}
    >
      <p className="text-[16px] sm:text-[18px] leading-snug font-semibold text-white" aria-hidden="true">
        {/* Keyed by the line, so each new line sweeps in fresh. */}
        <span key={text}>
          {text.split(' ').map((word, w) => (
            <motion.span
              key={w}
              className="inline-block"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (startDelay + w * WORD_STEP_MS) / 1000, duration: WORD_FADE_S, ease: 'easeOut' }}
            >
              {word}
              {w < text.split(' ').length - 1 ? '\u00a0' : ''}
            </motion.span>
          ))}
        </span>
      </p>
      <span className="sr-only">{text}</span>
      {/*
        Follows once the line is showing - a quieter second beat.
      */}
      {subtitle && revealed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-1.5 text-[12.5px] text-gray-500"
        >
          {subtitle}
        </motion.p>
      )}
      {/*
        The tail points at Nova: down when he is below the bubble, left when
        he is beside it. Drawn as one shape, filled with the bubble's own
        colour and outlined on its two outside edges only, so it joins the
        bubble cleanly. It was a rotated square with a border, which showed
        its own corner and edge inside the bubble on Brandon's phone.
      */}
      {hero ? (
        <svg
          aria-hidden="true"
          width="18"
          height="10"
          viewBox="0 0 18 10"
          className="absolute left-1/2 -ml-[9px] -bottom-[9px] overflow-visible"
        >
          <path d="M0 -1.5 L9 8.5 L18 -1.5 Z" fill="#111111" />
          <path d="M0.5 0 L9 8.5 L17.5 0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="10"
          height="18"
          viewBox="0 0 10 18"
          className="absolute -left-[9px] top-[15px] overflow-visible"
        >
          <path d="M11.5 0 L1.5 9 L11.5 18 Z" fill="#111111" />
          <path d="M10 0.5 L1.5 9 L10 17.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      )}
    </motion.div>
  );

  /*
    Keyed, so when the order flips (bubble above him vs beside him) React
    MOVES the two pieces instead of reusing one's box for the other - which
    made Nova start his glide from the bubble's shape, stretched.
  */
  return (
    <motion.div
      layout
      /* Slow only when he is changing places; a new line on the same spot just resizes. */
      transition={changedPlace ? GLIDE : { duration: 0.35, ease: 'easeOut' }}
      className={hero ? 'flex flex-col items-center mb-6' : 'flex items-start gap-3 mb-6'}
    >
      {hero ? [<Fragment key="bubble">{bubble}</Fragment>, <Fragment key="figure">{figure}</Fragment>]
            : [<Fragment key="figure">{figure}</Fragment>, <Fragment key="bubble">{bubble}</Fragment>]}
    </motion.div>
  );
}
