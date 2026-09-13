import { useState, useRef } from 'react';
import NOVAScore from '../shared/NOVAScore';
import { CalendarGrid } from '../marketing/product';
import { EXAMPLE_SCORE } from '../marketing/exampleScore';

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

const cell = 'rounded-lg border border-white/[0.07] bg-brand-elevated px-3 py-2.5';

const PANELS: Panel[] = [
  {
    id: 'journal',
    label: 'Journal',
    caption: 'Every entry, written for you from what you said.',
    body: (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-white">EURUSD &middot; Short</span>
          <span className="text-[13px] text-brand-loss tabular-nums">-$180</span>
        </div>
        <p className="text-[12.5px] text-gray-400 leading-relaxed">
          Moved my stop twice chasing the retest. Same thing I did Tuesday.
          Should have been flat after the first one.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {['Moved stop', 'Revenge entry', 'London'].map((t) => (
            /* Blue outline: these are the tags Nova assigns, and the accent
               is what marks something TradeX worked out rather than recorded. */
            <span key={t} className="text-[11px] text-brand-blue-light/90 border border-brand-blue-light/30 bg-brand-blue/[0.07] rounded-full px-2.5 py-1">
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    caption: 'Your month in P&L, or the same month scored by how you traded it.',
    /*
      The real calendar's cell gradients, lifted from Calendar.tsx rather
      than approximated. This used to be flat coloured squares with no
      numbers - readable as "a calendar exists", but it looked nothing like
      the screen it was standing in for, which is the one job a product
      panel has.
    */
    body: <CalendarGrid compact />,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    caption: 'Five reports built from your trades, not a wall of ratios.',
    body: (
      <div className="flex flex-col gap-4">
        {/*
          The score first, then the reports it is built from. It is the one
          number somebody remembers from this page, and the real component
          is used rather than a picture of it - including its Score
          Breakdown dropdown, which is the part that shows the score is
          made of something rather than being a vanity figure.
        */}
        <NOVAScore breakdown={EXAMPLE_SCORE} size="sm" showBreakdown periodLabel="Last 30 days" />

        <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.06]">
        {[
          ['Cumulative P&L', 'Where the account actually went'],
          ['Win Rate Trend', 'Whether you are getting better'],
          ['P&L by Symbol', 'What you should stop trading'],
          ['Average P&L by Day of Week', 'Your worst day, named'],
          ['Trade Types', 'Long against short, side by side'],
        ].map(([name, what]) => (
          <div key={name} className={`${cell} flex items-baseline justify-between gap-3`}>
            <span className="text-[12px] text-gray-300">{name}</span>
            <span className="text-[11px] text-gray-600 text-right">{what}</span>
          </div>
        ))}
        </div>
      </div>
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
const SWIPE_THRESHOLD = 48;

export default function ProductTabs() {
  const [active, setActive] = useState(PANELS[0].id);
  const index = Math.max(0, PANELS.findIndex((p) => p.id === active));
  const panel = PANELS[index];

  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= PANELS.length) return;
    setActive(PANELS[next].id);
  };

  return (
    <div>
      {/* Three labels fit a 375px row, so it centres rather than scrolls. */}
      <div
        role="tablist"
        aria-label="What TradeX looks like"
        className="flex gap-1.5 justify-center"
      >
        {PANELS.map((p) => {
          const isActive = p.id === active;
          return (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`panel-${p.id}`}
              onClick={() => setActive(p.id)}
              /*
                Arrow keys move between tabs, which is what a tablist is
                expected to do and costs one handler.
              */
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

      <div
        id={`panel-${panel.id}`}
        role="tabpanel"
        /*
          Swipeable on a phone. The tabs are still the control and still the
          indicator - this only adds the gesture someone on a touchscreen
          already expects from a row of panels. touchAction stays default so
          vertical scrolling through the page is never captured.
        */
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
          go(dx < 0 ? 1 : -1);
        }}
        className="mt-5 rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7"
      >
        <p className="text-[12.5px] sm:text-sm text-gray-400 mb-5">{panel.caption}</p>
        <div className="rounded-xl border border-white/[0.06] bg-brand-elevated p-4 sm:p-5">
          {panel.body}
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
