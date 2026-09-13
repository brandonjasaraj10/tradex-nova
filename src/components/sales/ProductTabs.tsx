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
            <span key={t} className="text-[11px] text-gray-400 border border-white/10 rounded-full px-2.5 py-1">
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
    caption: 'Your month at a glance, coloured by result or by state of mind.',
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
        </div>
      </div>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    caption: 'The numbers behind the habit, not just the balance.',
    body: (
      <div className="grid grid-cols-2 gap-2.5 text-[12px]">
        {[
          ['Best session', 'London'],
          ['Worst weekday', 'Friday'],
          ['Avg hold', '42 min'],
          ['Stop moved', '9 trades'],
          ['Win rate', '58%'],
          ['Profit factor', '1.94'],
        ].map(([k, v]) => (
          <div key={k} className={`${cell} flex items-baseline justify-between gap-2`}>
            <span className="text-gray-600">{k}</span>
            <span className="text-gray-300 tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'psychology',
    label: 'Psychology',
    caption: 'How you felt going in, scored against what happened.',
    body: (
      <div className="flex flex-col gap-3">
        {[
          ['Focus', 7],
          ['Confidence', 4],
          ['Discipline', 6],
        ].map(([label, value]) => (
          <div key={label as string} className="flex items-center gap-3">
            <span className="w-[76px] flex-shrink-0 text-[12px] text-gray-500">{label}</span>
            <span className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <span
                className="block h-full rounded-full bg-brand-blue-light/70"
                style={{ width: `${(value as number) * 10}%` }}
              />
            </span>
            <span className="w-8 text-right text-[12px] text-gray-300 tabular-nums">{value}/10</span>
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
      {/*
        Scrollable on a phone so four labels never wrap into two ragged rows.
        No scrollbar, but the row still moves by touch.
      */}
      <div
        role="tablist"
        aria-label="What TradeX looks like"
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:justify-center
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] transition-colors
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
