import { useState } from 'react';

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
    body: (
      <div>
        <div className="grid grid-cols-7 gap-1.5">
          {[
            0, 0, 1, -1, 1, 0, 0,
            1, 1, -1, 1, 0, 0, 0,
            -1, 1, 1, 1, -1, 0, 0,
            1, -1, 1, 1, 1, 0, 0,
          ].map((v, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`aspect-square rounded-[3px] ${
                v === 1
                  ? 'bg-brand-blue-light/60'
                  : v === -1
                    ? 'bg-gray-600/50'
                    : 'bg-white/[0.04]'
              }`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-brand-blue-light/60" /> Green day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-gray-600/50" /> Red day
          </span>
          <span className="ml-auto text-gray-600">Switch to psychology view</span>
        </div>
      </div>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    caption: 'Five reports built from your trades, not a wall of ratios.',
    body: (
      <div className="flex flex-col gap-2">
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
    ),
  },
];

export default function ProductTabs() {
  const [active, setActive] = useState(PANELS[0].id);
  const panel = PANELS.find((p) => p.id === active) ?? PANELS[0];

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
              onClick={() => setActive(p.id)}
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
        <p className="text-[12.5px] sm:text-sm text-gray-400 mb-5">{panel.caption}</p>
        <div className="rounded-xl border border-white/[0.06] bg-brand-elevated p-4 sm:p-5">
          {panel.body}
        </div>
        <p className="mt-4 text-center text-[11px] text-gray-600">Example figures</p>
      </div>
    </div>
  );
}
