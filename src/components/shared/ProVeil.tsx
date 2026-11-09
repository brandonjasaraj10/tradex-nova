import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

/*
  Free plan: Pro screens open for free users, but every section sits behind
  its own veil. The page is real - their own layout, their own data where they
  have some - frosted and hatched like a redacted document, with a small lock
  in the middle. Hovering a section "decrypts" the lock's label into
  "Unlock with Pro"; clicking anywhere on it opens the plans.

  A route marks itself locked with <ProLockProvider>; shared Card picks that up
  and veils its own body, so most sections need no change. Pages also read
  useProLocked() to skip the AI calls (tips, insights, reports) a free user
  isn't getting.
*/

const ProLockContext = createContext(false);

export function ProLockProvider({ locked, children }: { locked: boolean; children: ReactNode }) {
  return <ProLockContext.Provider value={locked}>{children}</ProLockContext.Provider>;
}

export function useProLocked() {
  return useContext(ProLockContext);
}

const LABEL = 'Unlock with Pro';
const GLYPHS = '0123456789$%.,+-';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* Rolls random figures, then settles letter by letter into the label. */
function useDecode(active: boolean) {
  const [text, setText] = useState('PRO');
  const timer = useRef<number>();

  useEffect(() => {
    window.clearInterval(timer.current);
    if (!active) { setText('PRO'); return; }
    if (prefersReducedMotion()) { setText(LABEL); return; }
    let frame = 0;
    timer.current = window.setInterval(() => {
      frame += 1;
      const settled = Math.floor(frame / 1.6);
      setText(
        LABEL.split('').map((ch, i) =>
          i < settled || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        ).join('')
      );
      if (settled >= LABEL.length) window.clearInterval(timer.current);
    }, 35);
    return () => window.clearInterval(timer.current);
  }, [active]);

  return text;
}

export default function ProVeil({ children, className = '', compact = false, frame = false, side = false }: {
  children: ReactNode;
  className?: string;
  /* Smaller lock for tight spots, like the dashboard's NOVA Score tile. */
  compact?: boolean;
  /*
    Keep the layout sharp and frost only the parts marked data-veil. For a
    grid like the calendar, where blurring everything melted the day boxes
    into one grey slab and the shape of the screen was lost.
  */
  frame?: boolean;
  /*
    For small stat panels: no hatch film (inside a padded panel it drew a
    second box within the box), and the lock sits at the right edge so the
    sharp title on the left stays clear.
  */
  side?: boolean;
}) {
  const locked = useProLocked();
  if (!locked) return <>{children}</>;
  return <Veiled className={className} compact={compact} frame={frame} side={side}>{children}</Veiled>;
}

/*
  Two ways to frost, both keeping the layout sharp:
  - default: headings stay readable and everything else - figures, text,
    charts, the score ring - is frosted (the .pro-veil-auto rule). The lock
    sits small at the right edge. Used by Card and the Nova panels.
  - frame: only what's marked data-veil is frosted, for layouts like the
    calendar where the day numbers should stay. The lock sits centred over
    the hatch film unless side is set.
  A full blur of the whole section was tried first and read as zoomed in:
  titles became smudges and the frosted block drew a box inside the card.
*/
export function Veiled({ children, className = '', compact = false, frame = false, side = false }: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  frame?: boolean;
  side?: boolean;
}) {
  const lockAtSide = side || !frame;
  compact = compact || lockAtSide;
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const label = useDecode(hover);
  /* Each section's sweep starts at its own moment, so they don't pulse in step. */
  const [delay] = useState(() => `${(Math.random() * 6).toFixed(2)}s`);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Part of Pro. Unlock with Pro"
      onClick={() => navigate('/payment')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/payment'); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={`pro-veil relative isolate cursor-pointer outline-none
        focus-visible:ring-2 focus-visible:ring-brand-blue/60 ${className}`}
    >
      <div aria-hidden="true" ref={(el) => el?.setAttribute('inert', '')} className={`${frame ? 'pro-veil-frame' : 'pro-veil-auto'} pointer-events-none select-none`}>
        {children}
      </div>
      {!lockAtSide && <div aria-hidden="true" className="pro-veil-film absolute inset-0 opacity-60" />}
      {/*
        The sweep clips itself, so in frame mode the container doesn't have
        to - clipping there cut the frosted numbers off with a hard edge on
        the left, since a blur spreads a few pixels past the text.
      */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="pro-veil-sweep absolute inset-0" style={{ animationDelay: delay }} />
      </div>
      <div className={`absolute inset-0 flex items-center ${lockAtSide ? 'justify-end' : 'justify-center p-3'}`}>
        <span
          className={`inline-flex items-center gap-2 rounded-full border transition-colors duration-200
            ${hover ? 'border-brand-blue/60 bg-black/70' : 'border-white/15 bg-black/55'}
            backdrop-blur-md shadow-lg shadow-black/40
            ${compact ? 'px-2.5 py-1 text-[10.5px]' : 'px-3.5 py-1.5 text-[11.5px]'}`}
        >
          <Lock className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${hover ? 'text-brand-blue-light' : 'text-gray-300'}`} />
          <span className="font-mono tracking-[0.14em] uppercase text-white whitespace-nowrap tabular-nums">{label}</span>
        </span>
      </div>
    </div>
  );
}
