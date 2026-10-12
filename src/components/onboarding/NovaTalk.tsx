import { Fragment, useEffect, useState } from 'react';
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

  PACE: slower again at Brandon's request - longer typing dots, slower
  typing, unhurried glides.
*/

const TYPE_STEP_MS = 40; /* per two characters */
const DOTS_MS = 700;
const GLIDE = { duration: 1.1, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

export function useTyped(text: string, startDelayMs = 0) {
  const [shown, setShown] = useState(text);
  const [phase, setPhase] = useState<'dots' | 'typing' | 'done'>('done');
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      setPhase('done');
      return;
    }
    setShown('');
    setPhase('dots');
    let i = 0;
    let id = 0;
    const start = window.setTimeout(() => {
      setPhase('typing');
      id = window.setInterval(() => {
        i += 2;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(id);
          setPhase('done');
        }
      }, TYPE_STEP_MS);
    }, DOTS_MS + startDelayMs);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [text, startDelayMs]);
  return { shown, phase };
}

/* How long a reply should stay up: the dots, the typing, then time to actually read it. */
export function replyHoldMs(text: string) {
  return DOTS_MS + (text.length / 2) * TYPE_STEP_MS + 2000;
}

/* How long the walk-in takes, so the bubble can wait for it. */
const WALK_MS = 1900;

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
  const { shown, phase } = useTyped(text, walked ? WALK_MS : 0);
  const hero = variant === 'hero';
  const size = hero ? 136 : 96;

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
      <motion.div
        initial={walked ? { x: -240, opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: WALK_MS / 1000, ease: [0.25, 0.8, 0.3, 1] }}
      >
        <motion.div
          initial={false}
          animate={walking ? { y: [0, -7, 0, -7, 0, -7, 0, -4, 0], rotate: [0, -3, 0, 3, 0, -3, 0, 1, 0] } : { y: 0, rotate: 0 }}
          transition={{ duration: WALK_MS / 1000, ease: 'easeInOut' }}
        >
          <motion.div
            className="origin-bottom"
            animate={phase === 'typing' ? { y: [0, -1.5, 0] } : { y: 0 }}
            transition={phase === 'typing' ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.5 }}
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
      transition={GLIDE}
      className={`relative rounded-2xl border border-white/10 bg-brand-elevated px-4 py-3 ${
        hero ? 'w-full max-w-sm min-h-[88px] text-center mb-3' : 'mt-2 flex-1 min-h-[108px]'
      }`}
    >
      <p className="text-[16px] sm:text-[18px] leading-snug font-semibold text-white" aria-hidden="true">
        {phase === 'dots' ? (
          <span className="inline-flex items-center gap-1 h-[1.4em]">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gray-400"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </span>
        ) : (
          shown
        )}
      </p>
      <span className="sr-only">{text}</span>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'done' ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          className="mt-1.5 text-[12.5px] text-gray-500"
        >
          {subtitle}
        </motion.p>
      )}
      {/* The tail points at Nova: down when he is below the bubble, left when he is beside it. */}
      <span
        aria-hidden="true"
        className={`absolute w-3 h-3 rotate-45 bg-brand-elevated ${
          hero
            ? 'left-1/2 -ml-1.5 -bottom-[6px] border-r border-b border-white/10'
            : '-left-[6px] top-8 border-l border-b border-white/10'
        }`}
      />
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
      transition={GLIDE}
      className={hero ? 'flex flex-col items-center mb-6' : 'flex items-start gap-3 mb-6'}
    >
      {hero ? [<Fragment key="bubble">{bubble}</Fragment>, <Fragment key="figure">{figure}</Fragment>]
            : [<Fragment key="figure">{figure}</Fragment>, <Fragment key="bubble">{bubble}</Fragment>]}
    </motion.div>
  );
}
