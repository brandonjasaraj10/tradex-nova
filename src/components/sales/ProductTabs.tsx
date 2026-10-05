import { useState, useRef, useEffect, useCallback } from 'react';
import ProductShot from './ProductShot';

/*
  The product, explorable - placed mid-page on purpose.

  A switcher in the hero would be close to invisible: Notre Dame's carousel
  study found ~1% of visitors click one at all and 84% of those clicks land on
  the first panel, and an A/B test of carousel against static hero measured
  1.96% interaction versus 43.03%. Movement up there also reads as an advert
  and gets skipped.

  Down here the calculation is different. Someone still reading has already
  decided to care and now wants to see more, which is exactly where Hyros and
  TradeZella put their own tabs. So the hero keeps one static panel carrying
  one message, and this rewards the second kind of visitor.

  User-controlled, never auto-rotating: nothing moves unless somebody asks it
  to, and the first panel is the one that matters if they never do.

  Three panels, not four. Psychology had its own tab until the section
  directly below this one turned out to say the same thing better, and four
  labels forced the row to scroll sideways on a phone, which reads as
  unfinished. Three fit.
*/

type Panel = {
  id: string;
  label: string;
  caption: string;
  body: React.ReactNode;
};

/*
  Each panel is now a screenshot of the running app rather than a drawing of
  it. Three of these were hand-built HTML - careful, sourced from the real
  fields, and still a second version of the product that could drift away
  from the first. See ProductShot.

  The captions stay: an image says what a screen looks like, not what it is
  for, and the sentence under each one is the only place the page explains
  why that screen exists.
*/
const PANELS: Panel[] = [
  {
    id: 'journal',
    label: 'Journal',
    caption: 'Every entry, written for you from what you said.',
    body: (
      <ProductShot
        src="/product/journal.jpg"
        label="Journal"
        alt="A journal entry for a gold trade: symbol, direction, size, duration, the trade it is linked to, tags, and the written review underneath."
      />
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    caption: 'Your month in P&L, or the same month scored by how you traded it.',
    body: (
      <ProductShot
        src="/product/calendar.jpg"
        label="Calendar"
        alt="A month of trading laid out as a calendar, each day showing its profit or loss, with weekly totals down the side."
      />
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    caption: 'Five reports built from your trades, not a wall of ratios.',
    body: (
      <ProductShot
        src="/product/analytics.jpg"
        label="Analytics"
        alt="The analytics page: NOVA Score, total profit and loss, win rate, profit factor, and cumulative P&L and win-rate charts."
      />
    ),
  },
];

/*
  Swipe distance before a gesture counts as a tab change.

  48px, chosen so a vertical scroll that drifts sideways does not swap the
  panel under someone's thumb - which is the failure mode that makes swipeable
  carousels infuriating. The horizontal movement also has to beat the vertical
  movement, so a scroll is never mistaken for a swipe however far it drifts.
*/
/*
  Swipe tuning.

  The first version was a gesture detector, not a swipe: nothing moved until
  you let go, and then the content was simply replaced. That reads as a
  glitch, because the one thing a swipe promises is that the panel is
  attached to your thumb.

  Now the three panels sit side by side on a track that follows the finger
  and snaps on release. Two ways to commit, because people swipe two
  different ways: drag a fifth of the width, or flick fast and short. Only
  requiring distance makes quick flicks fail; only requiring velocity makes
  slow deliberate drags fail.
*/
const COMMIT_RATIO = 0.2;          // of panel width
const COMMIT_VELOCITY = 0.4;       // px per ms
const AXIS_LOCK = 8;               // px before we decide scroll vs swipe
const EDGE_RESISTANCE = 0.35;      // rubber band past the first/last panel
const SNAP = 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)';

export default function ProductTabs() {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [heights, setHeights] = useState<number[]>([]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gesture = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null } | null>(null);

  const panel = PANELS[index];
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /*
    The viewport is only as tall as the panel on screen, animated between
    them. Sizing it to the tallest instead would leave the Journal panel
    sitting in half a screen of empty box, and letting it jump instantly
    undoes the smoothness the swipe just bought.
  */
  useEffect(() => {
    const measure = () =>
      setHeights(panelRefs.current.map((el) => el?.offsetHeight ?? 0));
    measure();
    const observers = panelRefs.current.map((el) => {
      if (!el || typeof ResizeObserver === 'undefined') return null;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return ro;
    });
    window.addEventListener('resize', measure);
    return () => {
      observers.forEach((ro) => ro?.disconnect());
      window.removeEventListener('resize', measure);
    };
  }, []);

  const go = useCallback((delta: number) => {
    setIndex((i) => Math.min(PANELS.length - 1, Math.max(0, i + delta)));
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    gesture.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    /*
      Decide once, on the first meaningful movement, whether this is a scroll
      or a swipe - and then stick with it. Re-deciding every frame is what
      makes a carousel fight the page: a vertical scroll that drifts sideways
      starts dragging the panel halfway down the screen.
    */
    if (g.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.axis === 'x') setDragging(true);
    }
    if (g.axis !== 'x') return;

    const atStart = index === 0 && dx > 0;
    const atEnd = index === PANELS.length - 1 && dx < 0;
    setDrag(atStart || atEnd ? dx * EDGE_RESISTANCE : dx);
  };

  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    setDrag(0);
    if (!g || g.axis !== 'x') return;

    const width = viewportRef.current?.offsetWidth ?? 1;
    const elapsed = Math.max(1, Date.now() - g.t);
    const velocity = Math.abs(drag) / elapsed;

    if (Math.abs(drag) > width * COMMIT_RATIO || velocity > COMMIT_VELOCITY) {
      go(drag < 0 ? 1 : -1);
    }
  };

  const height = heights[index];

  return (
    <div>
      {/* Three labels fit a 375px row, so it centres rather than scrolls. */}
      <div
        role="tablist"
        aria-label="What TradeX looks like"
        className="flex gap-1.5 justify-center"
      >
        {PANELS.map((p, i) => {
          const isActive = i === index;
          return (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`panel-${p.id}`}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-[12.5px] transition-colors
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
                  isActive
                    ? 'bg-white text-black font-medium'
                    : 'text-gray-400 border border-white/10 hover:text-white hover:border-white/20'
                }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7">
        {/*
          The caption belongs to the active panel, so it cross-fades rather
          than sliding with the track - sliding it would double the motion
          for something only a few words long.
        */}
        <p
          key={panel.id}
          className="text-[12.5px] sm:text-sm text-gray-400 mb-5 motion-safe:animate-[fadeIn_260ms_ease-out]"
        >
          {panel.caption}
        </p>

        <div
          ref={viewportRef}
          className="overflow-hidden"
          /*
            pan-y hands vertical scrolling to the browser, which is what keeps
            the page itself smooth while a horizontal drag is in progress -
            far better than intercepting touchmove and calling preventDefault.
          */
          style={{
            touchAction: 'pan-y',
            height: height ? `${height}px` : undefined,
            transition: dragging || reduced ? 'none' : 'height 420ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endGesture}
          onTouchCancel={endGesture}
        >
          <div
            className="flex items-start"
            style={{
              transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`,
              transition: dragging || reduced ? 'none' : SNAP,
              willChange: 'transform',
            }}
          >
            {PANELS.map((p, i) => (
              <div
                key={p.id}
                id={`panel-${p.id}`}
                role="tabpanel"
                aria-hidden={i !== index}
                ref={(el) => { panelRefs.current[i] = el; }}
                className="w-full flex-shrink-0"
              >
                <div className="rounded-xl border border-white/[0.06] bg-brand-elevated p-4 sm:p-5">
                  {p.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {/* Dots, so the panel itself says there are three and which one you
              are on. Without them a swipe is a gesture nobody knows to try. */}
          {PANELS.map((p, i) => (
            <span
              key={p.id}
              aria-hidden="true"
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? 'w-5 bg-white/70' : 'w-1 bg-white/20'
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-gray-600">
          <span className="sm:hidden">Swipe or tap a tab &middot; </span>Example figures
        </p>
      </div>
    </div>
  );
}
