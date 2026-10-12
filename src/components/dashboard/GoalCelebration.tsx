import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import NovaClip from '../shared/NovaClip';
import { CONFETTI } from '../onboarding/FirstEntry';
import { MILESTONES, type Milestone } from '../../services/goalProgress';

/*
  The milestone moment on the dashboard - 7, 14, 30 and 66 journaled trading
  days.

  Same language as the day-one celebration at the end of onboarding: Nova
  appears and celebrates, blue confetti falls once, the days are shown
  filled in. Shown once per milestone, the first time they open the
  dashboard after reaching it; the goal card itself leaves the dashboard
  after 7, so this is how the later milestones are noticed at all.

  66 because that is the average time a new behaviour took to become
  automatic in Lally et al.'s habit study - the one number on the ladder
  with a reason behind it.
*/




const COPY: Record<Milestone, { title: string; body: string }> = {
  7: {
    title: '7 trading days, journaled.',
    body: 'The habit’s started — and that’s enough for me to start spotting your patterns.',
  },
  14: {
    title: '14 days. Two full weeks.',
    body: 'Two weeks in, your entries start showing what you do on the bad days too — not just the good ones.',
  },
  30: {
    title: '30 trading days.',
    body: 'A month of you on paper. Your patterns aren’t guesses anymore — they’re in your own entries.',
  },
  66: {
    title: '66 days. It’s a habit now.',
    body: 'That’s about how long a new habit takes to stick. This one’s yours.',
  },
};

export default function GoalCelebration({
  milestone,
  open,
  onClose,
}: {
  milestone: Milestone;
  open: boolean;
  onClose: () => void;
}) {
  const next = MILESTONES[MILESTONES.indexOf(milestone) + 1];
  const copy = COPY[milestone];
  /* Seven dots at most; the bigger milestones show the last seven, all filled. */
  const dots = Math.min(milestone, 7);

  /*
    Straight onto the page, not inside the dashboard: the dashboard's
    sections animate in with transforms, and a full-screen layer inside a
    transformed parent is positioned against that parent, not the screen.
  */
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          role="dialog"
          aria-modal="true"
          aria-label={copy.title}
        >
          {/* Confetti once, over the whole screen, then gone. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <motion.span
                key={i}
                className="absolute top-0 rounded-[1px]"
                style={{ left: `${c.x}%`, width: c.w, height: c.h, backgroundColor: c.color }}
                initial={{ y: -20, opacity: 0, rotate: 0 }}
                animate={{ y: [-20, 700], opacity: [0, 1, 1, 0], rotate: c.spin, x: [0, c.drift] }}
                transition={{ duration: c.dur + 0.6, delay: 0.3 + c.delay, ease: 'easeIn' }}
              />
            ))}
          </div>

          <motion.div
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-black px-6 pt-6 pb-6 text-center
              shadow-[0_0_60px_rgba(59,130,246,0.18)]"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: [0.25, 0.8, 0.3, 1] }}
          >
            <motion.div
              className="mx-auto w-fit"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <NovaClip action="celebrate" actionKey={milestone} height={104} />
            </motion.div>

            <p className="mt-1 text-[10.5px] uppercase tracking-[0.16em] text-blue-400">Goal reached</p>
            <h2 className="mt-2 text-[24px] leading-tight font-semibold tracking-[-0.02em] text-white text-balance">
              {copy.title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-400 text-balance">{copy.body}</p>

            <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
              {Array.from({ length: dots }, (_, i) => (
                <motion.span
                  key={i}
                  className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.6 + i * 0.08 }}
                >
                  <Check size={15} strokeWidth={3} className="text-white" />
                </motion.span>
              ))}
            </div>

            {next && (
              <p className="mt-5 text-[13px] text-gray-500">
                Next stop: <span className="text-white font-medium">{next} trading days</span>
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full inline-flex items-center justify-center px-8 py-3.5 rounded-full
                bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
            >
              Keep going
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
