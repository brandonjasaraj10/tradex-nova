import { useState, ReactNode } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';

/*
  Real interface, not descriptions of it.

  The first version of the product pages was four pages of the same bordered
  card in a row - accurate, and unreadable on a phone, where it came out as
  text box after text box. The research is blunt about why that fails:
  high-converting product pages lead with real screenshots, embedded previews
  and generated output, and interactive demos draw roughly twice the
  engagement of a static image - provided the point lands in under a minute.

  So each panel here is a piece of the actual product, drawn with the app's
  own colours and labels, not a mock invented for marketing. Where the real
  component is already prop-driven - the NOVA Score, the pre-trade scales -
  the pages import the real one rather than a copy, so it cannot drift.

  Figures are examples throughout, and every panel says so.
*/

/* ------------------------------------------------------------------ */
/* The app window the product sits inside.                             */
/* ------------------------------------------------------------------ */

export function Frame({
  label,
  children,
  note = 'Example figures',
}: {
  label: string;
  children: ReactNode;
  note?: string | null;
}) {
  return (
    <div>
      <div className="rounded-2xl border border-white/10 bg-brand-surface overflow-hidden shadow-[0_0_60px_-15px_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-brand-elevated">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <span className="ml-2 text-[11px] text-gray-600 tracking-wide">{label}</span>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
      {note && <p className="mt-2.5 text-[11px] text-gray-600">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A full-width band of numbers. Breaks the card rhythm.               */
/* ------------------------------------------------------------------ */

export function StatBand({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07]">
      {items.map(({ value, label }) => (
        <div key={label} className="px-3 py-6 sm:py-8 text-center">
          <p className="text-[26px] sm:text-4xl font-semibold tracking-[-0.03em] text-white tabular-nums">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] sm:text-[12px] text-gray-500 leading-snug text-balance">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

/*
  One sentence, set large, with nothing else on screen.

  Its job is rhythm. Four sections of cards in a row read as one long section;
  a line of type at display size resets the eye and gives the next section a
  fresh start. It also happens to be where the sharpest line on each page
  goes, which is not a coincidence - this is the only treatment on these
  pages that a skimming reader cannot scroll past without reading.
*/
export function PullQuote({ children, cite }: { children: ReactNode; cite?: string }) {
  return (
    <div className="py-10 sm:py-14 text-center">
      <p className="text-[24px] leading-[1.22] sm:text-[34px] sm:leading-[1.18] font-semibold tracking-[-0.03em] text-white text-balance max-w-2xl mx-auto">
        {children}
      </p>
      {cite && <p className="mt-4 text-[12px] text-gray-600">{cite}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard: the stat row and equity curve.                           */
/* ------------------------------------------------------------------ */

export function EquityPanel() {
  return (
    <Frame label="Dashboard">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total P&L', value: '+$4,812', tone: 'text-brand-profit' },
          { label: 'Win Rate', value: '58%', tone: 'text-white' },
          { label: 'Profit Factor', value: '1.94', tone: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.07] bg-brand-elevated px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">{s.label}</p>
            <p className={`mt-1.5 text-lg sm:text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3.5 rounded-xl border border-white/[0.07] bg-brand-elevated p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-600">Equity</p>
          <p className="text-[11px] text-gray-600">Last 30 days</p>
        </div>
        <svg viewBox="0 0 320 72" className="w-full h-16 sm:h-20" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="mktEquityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 60 L32 55 L64 58 L96 44 L128 47 L160 33 L192 36 L224 22 L256 26 L288 14 L320 8 L320 72 L0 72 Z" fill="url(#mktEquityFill)" />
          <path d="M0 60 L32 55 L64 58 L96 44 L128 47 L160 33 L192 36 L224 22 L256 26 L288 14 L320 8" fill="none" stroke="#60A5FA" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar: the real cell colours from src/pages/Calendar.tsx.        */
/* ------------------------------------------------------------------ */

const WIN = 'bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-blue-600/15 border-blue-400/40';
const LOSS = 'bg-gradient-to-br from-slate-600/20 via-gray-600/15 to-zinc-600/10 border-slate-500/40';
const JOURNAL_ONLY = 'bg-white/5 border-blue-400/70';
const EMPTY = 'bg-white/[0.03] border-white/10';

/* day -> [state, amount]. Shaped like a real month: weekends blank, a
   losing run mid-month, a recovery after it. */
const MONTH: Record<number, [string, string]> = {
  1: [WIN, '+180'], 2: [LOSS, '-95'], 3: [WIN, '+240'], 6: [WIN, '+120'],
  7: [JOURNAL_ONLY, ''], 8: [LOSS, '-310'], 9: [LOSS, '-220'], 10: [LOSS, '-140'],
  13: [WIN, '+95'], 14: [WIN, '+410'], 15: [LOSS, '-60'], 16: [WIN, '+275'], 17: [WIN, '+150'],
  20: [WIN, '+330'], 21: [JOURNAL_ONLY, ''], 22: [WIN, '+185'], 23: [LOSS, '-120'], 24: [WIN, '+520'],
  27: [WIN, '+240'], 28: [WIN, '+160'], 29: [LOSS, '-85'], 30: [WIN, '+390'],
};

export function CalendarPanel() {
  return (
    <Frame label="Calendar">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <p key={i} className="text-center text-[9px] uppercase tracking-wider text-gray-600">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
          const [cell, amount] = MONTH[day] ?? [EMPTY, ''];
          const isWin = cell === WIN;
          return (
            <div
              key={day}
              className={`aspect-square rounded-md border p-1 flex flex-col justify-between ${cell}`}
            >
              <span className={`text-[9px] sm:text-[10px] font-semibold leading-none
                ${cell === EMPTY ? 'text-gray-700' : 'text-gray-300'}`}>
                {day}
              </span>
              {amount && (
                <span className={`text-[7.5px] sm:text-[9px] font-medium leading-none tabular-nums
                  ${isWin ? 'text-brand-blue-light' : 'text-gray-400'}`}>
                  {amount}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-[3px] border ${WIN}`} />Winning day
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-[3px] border ${LOSS}`} />Losing day
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-[3px] border ${JOURNAL_ONLY}`} />Journal only
        </span>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Pre-trade checklist. Actually tickable, with the app's three states. */
/* ------------------------------------------------------------------ */

const CHECKS = [
  'I have my invalidation marked before entry',
  'This is on my plan, not a setup I found looking',
  'Risk is 1% or less of the account',
  'I am not trying to win back this morning',
];

/*
  Three states, not two, because that is what the product does.

  Journal.tsx cycles each rule unset -> followed -> not followed -> unset, and
  renders them as a blue CheckSquare, a grey X and an empty Square. A
  marketing panel that only toggled on and off would be teaching the wrong
  interaction - and it would lose the point of the feature, which is that
  "I broke this one" is a thing you record deliberately rather than the
  absence of a tick. The counts underneath are the app's own pair, Followed
  and Not Followed, for the same reason.
*/
type RuleState = null | true | false;

const NEXT_STATE: Record<string, RuleState> = {
  null: true,
  true: false,
  false: null,
};

export function ChecklistPanel() {
  /*
    Interactive rather than a picture of a checklist. It is the cheapest
    honest demo on the site - the point lands in about three seconds, which
    is the condition under which an interactive demo beats a screenshot at
    all. The last item starts on "not followed" rather than unset: that is
    the one nobody keeps honestly, and showing it already marked broken is
    the whole argument for the feature.
  */
  const [states, setStates] = useState<RuleState[]>([true, true, true, false]);

  const cycle = (i: number) =>
    setStates((prev) =>
      prev.map((v, j) => (j === i ? NEXT_STATE[String(v)] : v)),
    );

  const followed = states.filter((v) => v === true).length;
  const broken = states.filter((v) => v === false).length;

  return (
    <Frame label="Pre-trade checklist" note="Try it — tap twice to mark one broken">
      <p className="text-[11px] text-gray-600 mb-3">
        Blue = followed &middot; grey = not followed &middot; empty = not marked
      </p>

      <div className="flex flex-col gap-2">
        {CHECKS.map((check, i) => {
          const state = states[i];
          return (
            <button
              key={check}
              type="button"
              onClick={() => cycle(i)}
              aria-label={`${check} — ${
                state === true ? 'followed' : state === false ? 'not followed' : 'not marked'
              }`}
              className={`group flex items-start gap-3 text-left rounded-xl border px-3.5 py-3 transition-colors
                ${state === true
                  ? 'border-brand-blue-light/40 bg-brand-blue-light/10'
                  : state === false
                    ? 'border-gray-500/50 bg-gray-400/10'
                    : 'border-white/[0.07] bg-brand-elevated hover:border-white/20'}`}
            >
              <span className="mt-[1px] flex-shrink-0" aria-hidden="true">
                {state === true ? (
                  <CheckSquare size={18} className="text-brand-blue-light" />
                ) : state === false ? (
                  <X size={18} className="text-gray-400" />
                ) : (
                  <Square size={18} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                )}
              </span>
              <span
                className={`text-[13px] leading-snug
                  ${state === true
                    ? 'text-gray-300'
                    : state === false
                      ? 'text-gray-400 line-through decoration-gray-600'
                      : 'text-gray-500'}`}
              >
                {check}
              </span>
            </button>
          );
        })}
      </div>

      {/* The app's own pair of counts, in the app's own wording. */}
      <div className="mt-3.5 pt-3.5 border-t border-white/[0.07] flex flex-col gap-1">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-500">Followed</span>
          <span className="text-brand-blue-light font-medium tabular-nums">
            {followed} / {CHECKS.length}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-500">Not followed</span>
          <span className="text-gray-400 font-medium tabular-nums">
            {broken} / {CHECKS.length}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] text-gray-600 leading-relaxed">
        {broken > 0
          ? 'That is the part a spreadsheet never records — and the number the weekly report counts.'
          : followed === CHECKS.length
            ? 'All four followed. Take the trade.'
            : 'Mark each one honestly. The gap is the whole point.'}
      </p>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* The weekly report, written rather than charted.                     */
/* ------------------------------------------------------------------ */

export function WeeklyReportPanel() {
  return (
    <Frame label="Weekly report">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[13px] font-medium text-white">Week of 8 September</p>
        <p className="text-[11px] text-gray-600">14 trades</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: 'P&L', value: '+$1,240', tone: 'text-brand-profit' },
          { label: 'Win rate', value: '64%', tone: 'text-white' },
          { label: 'Rules kept', value: '9/14', tone: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.07] bg-brand-elevated px-2.5 py-2">
            <p className="text-[9.5px] uppercase tracking-[0.1em] text-gray-600">{s.label}</p>
            <p className={`mt-1 text-[15px] font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-brand-blue-light/20 bg-brand-blue/[0.06] p-3.5">
        <p className="text-[10px] uppercase tracking-[0.12em] text-brand-blue-light mb-2">What changed</p>
        <p className="text-[12.5px] leading-relaxed text-gray-300">
          Your best week since July, and it was not the setups &mdash; your win rate
          on them is flat. You held losers 40% less time than last week, and you
          took no trade after 2pm. Both of those were rules you wrote in June and
          had been ignoring.
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-account switching.                                            */
/* ------------------------------------------------------------------ */

const ACCOUNTS = [
  { name: 'FTMO Challenge', sub: '$100k · Phase 1', pnl: '+$3,210', win: true },
  { name: 'Funded — Alpha', sub: '$50k · Live', pnl: '+$1,602', win: true },
  { name: 'Personal', sub: 'IC Markets', pnl: '-$284', win: false },
];

export function AccountsPanel() {
  const [active, setActive] = useState(0);
  return (
    <Frame label="Accounts" note="Try it — this one is live">
      <div className="flex flex-col gap-2">
        {ACCOUNTS.map((a, i) => (
          <button
            key={a.name}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors
              ${active === i
                ? 'border-brand-blue-light/35 bg-brand-blue/[0.07]'
                : 'border-white/[0.07] bg-brand-elevated hover:border-white/15'}`}
          >
            <div className="min-w-0">
              <p className={`text-[13px] font-medium truncate ${active === i ? 'text-white' : 'text-gray-400'}`}>
                {a.name}
              </p>
              <p className="text-[11px] text-gray-600 truncate">{a.sub}</p>
            </div>
            <p className={`text-[13px] font-semibold tabular-nums flex-shrink-0
              ${a.win ? 'text-brand-profit' : 'text-gray-400'}`}>
              {a.pnl}
            </p>
          </button>
        ))}
      </div>
      <p className="mt-3.5 text-[11.5px] text-gray-600 leading-relaxed">
        Every metric on every screen follows the one you pick. {ACCOUNTS[active].name}&rsquo;s
        numbers are never averaged in with the others.
      </p>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Security: what TradeX can and cannot reach.                         */
/* ------------------------------------------------------------------ */

export function PermissionsPanel() {
  const rows: [string, boolean][] = [
    ['Read your closed trade history', true],
    ['Read your account balance', true],
    ['Place a trade', false],
    ['Close or modify a trade', false],
    ['Withdraw or move funds', false],
    ['See your broker password', false],
  ];
  return (
    <Frame label="What TradeX can reach" note="Read-only sync, when it ships">
      <div className="flex flex-col divide-y divide-white/[0.06]">
        {rows.map(([label, allowed]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={`text-[13px] ${allowed ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
            {allowed ? (
              <span className="flex-shrink-0 text-[10.5px] font-medium uppercase tracking-[0.1em]
                text-brand-blue-light bg-brand-blue-light/10 rounded-full px-2.5 py-1">
                Read only
              </span>
            ) : (
              <span className="flex-shrink-0 text-[10.5px] font-medium uppercase tracking-[0.1em]
                text-gray-500 border border-white/10 rounded-full px-2.5 py-1">
                Never
              </span>
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}
