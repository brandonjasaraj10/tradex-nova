import { useEffect, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import NovaClip, { type NovaAction } from '../shared/NovaClip';

/*
  Nova saying something: the animated character on the left, a speech bubble
  on the right, the words typing in.

  One component for every screen where Nova speaks - the name screen, the
  welcome screen and every question - because Brandon spotted that the first
  screens used a different layout (Nova above a small bubble) from the
  questions and read as a different product. Now they are the same thing.

  PACE. Slower than it was, on purpose: Duolingo's flow feels smooth largely
  because nothing rushes - Duo "types" for a moment, the words come in at a
  readable speed, and a reply sits long enough to be read.
*/

const TYPE_STEP_MS = 32; /* per two characters */
const DOTS_MS = 550;

export function useTyped(text: string) {
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
    }, DOTS_MS);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [text]);
  return { shown, phase };
}

/* How long a reply should stay up: the dots, the typing, then time to actually read it. */
export function replyHoldMs(text: string) {
  return DOTS_MS + (text.length / 2) * TYPE_STEP_MS + 1600;
}

export default function NovaTalk({
  text,
  subtitle,
  action,
  actionKey,
  reacting = false,
  size = 96,
}: {
  text: string;
  subtitle?: string;
  /* A one-off movement to play over his idle loop (wave on the first screens, nod on a reply). */
  action?: NovaAction;
  actionKey?: string | number;
  /* True while Nova is answering back: a gentle bounce and a slow blue burst. */
  reacting?: boolean;
  size?: number;
}) {
  const { shown, phase } = useTyped(text);

  /* A slow, soft settle each time he says something new; a gentle bounce when he replies. */
  const body = useAnimationControls();
  useEffect(() => {
    if (reacting) {
      void body.start({ y: [0, -9, 0, -3, 0], transition: { duration: 1.4, ease: 'easeInOut' } });
    } else {
      void body.start({ y: [4, 0], transition: { duration: 0.7, ease: 'easeOut' } });
    }
  }, [text, reacting, body]);

  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="relative flex-shrink-0">
        <motion.div
          className="origin-bottom"
          animate={phase === 'typing' ? { y: [0, -1.5, 0] } : { y: 0 }}
          transition={phase === 'typing' ? { duration: 0.45, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
        >
          <motion.div animate={body} className="relative origin-bottom">
            <NovaClip height={size} action={action} actionKey={actionKey} />
          </motion.div>
        </motion.div>

        {/*
          The burst - small blue sparks out from his head when he hears an
          answer. Brought back over the rings Brandon tried in between, and
          slowed down: it drifts out over about a second and a half.
        */}
        {reacting && [0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute left-1/2 top-[18%] w-1.5 h-1.5 rounded-full bg-brand-blue-light pointer-events-none"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
            animate={{
              opacity: [0, 0.9, 0],
              x: Math.cos((i / 7) * Math.PI * 2) * 32,
              y: Math.sin((i / 7) * Math.PI * 2) * 28,
              scale: [0.5, 1.1, 0.7],
            }}
            transition={{ duration: 1.5, delay: 0.2, ease: 'easeOut' }}
          />
        ))}
      </div>

      {/* One fixed-size bubble everywhere, so it never grows and shrinks between lines. */}
      <div className="relative mt-2 flex-1 min-h-[108px] rounded-2xl border border-white/10 bg-brand-elevated px-4 py-3">
        <p className="text-[16px] sm:text-[18px] leading-snug font-semibold text-white" aria-hidden="true">
          {phase === 'dots' ? (
            <span className="inline-flex items-center gap-1 h-[1.4em]">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-400"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
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
            transition={{ duration: 0.4 }}
            className="mt-1.5 text-[12.5px] text-gray-500"
          >
            {subtitle}
          </motion.p>
        )}
        <span
          aria-hidden="true"
          className="absolute -left-[6px] top-8 w-3 h-3 rotate-45 bg-brand-elevated border-l border-b border-white/10"
        />
      </div>
    </div>
  );
}
