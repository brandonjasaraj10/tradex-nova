import { useEffect, useState, useCallback } from 'react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { getOpenPositions, type OpenPositionsResult } from '../../services/openPositions';
import { valueColorClass } from '../../utils/formatMetrics';

/*
  The one screen in the app that is about now rather than about what
  happened.

  Everything else here is closed trades, and a trade belongs to the day it
  closed - so somebody three weeks into a swing position sees nothing at all
  until they exit. This is the answer to "what am I actually in?".

  Deliberately not stored anywhere. A position's value moves every tick, and
  a cached one is a wrong number wearing a timestamp. The cost is that this
  needs the account running, which is why "not running" is a state this
  component draws rather than an error it swallows.
*/

interface Props {
  connectionId: string | null;
  accountName?: string | null;
}

const fmtPrice = (n: number | null) =>
  n === null ? '--' : n.toLocaleString(undefined, { maximumFractionDigits: 5 });

/*
  Lots, said out loud.

  The number alone was "10", which is the same slip that had closed trades
  reading "33.33 shares" for 33.33 lots - and on a currency pair those differ
  by around a hundred thousand to one. This panel only ever draws MetaTrader
  accounts, and MetaTrader reports volume in lots, so the word can be stated
  rather than guessed. The one account type that would break that - an MT5
  account on a stock exchange, quoting shares or contracts - cannot reach
  this panel today, and would need the same quantity_unit treatment the
  closed trades already carry.
*/
const fmtVolume = (n: number | null) => (n === null ? '--' : `${n} lots`);

export default function OpenPositions({ connectionId, accountName }: Props) {
  const [result, setResult] = useState<OpenPositionsResult | null>(null);
  const [loading, setLoading] = useState(false);

  /*
    Retries before giving up, because the failure is nearly always momentary.

    A MetaTrader terminal drops its connection and picks it up again - while
    it is down, MetaApi answers this with a 400 and the panel said "couldn't
    read your open positions" until somebody pressed refresh. Which worked,
    every time, and that is the whole diagnosis: if one more attempt fixes
    it, the panel should be making that attempt rather than asking the
    trader to.

    Three tries roughly two seconds apart. Long enough to cover a reconnect,
    short enough that a genuinely stopped account still reports itself
    quickly instead of spinning. The spinner stays up in between, because
    "still trying" is the truth and a flash of an error that then fixes
    itself is worse than a moment of waiting.
  */
  const load = useCallback(async (attempt = 0) => {
    if (!connectionId) return;
    setLoading(true);

    const next = await getOpenPositions(connectionId);

    if (next.error && attempt < 2) {
      setTimeout(() => { void load(attempt + 1); }, 2000);
      return;
    }

    setResult(next);
    setLoading(false);
  }, [connectionId]);

  useEffect(() => { load(); }, [load]);

  /* Nothing to say for a manual account. */
  if (!connectionId) return null;

  /*
    Nothing at all until the answer is known.

    This used to draw the frame while the first request was in flight and
    then remove it when the answer came back "no positions" - so on every
    load the panel appeared for about a second and vanished, which reads as
    a glitch rather than as a deliberately empty state. Reported as exactly
    that: "it pops up for a second and disappears."

    Waiting costs nothing, because there is nothing worth showing yet. A
    later refresh does not flicker either: `result` holds the previous
    answer until the new one replaces it.
  */
  if (!result) return null;

  /*
    Hidden entirely when there is nothing open and nothing wrong. An empty
    panel on every dashboard, every day, teaches people to stop looking at
    the spot where a warning will one day appear.
  */
  if (!result.error && result.count === 0) return null;

  /*
    Which ones, by name.

    This counted instead: "One of these has no stop loss set" above a list
    the reader then had to scan to work out which. The warning exists to be
    acted on, and acting on it means knowing the symbol - so it says
    "AUDNZD has no stop loss set", and lists them when there is more than
    one. Counting was easier to write and left the work to the reader.
  */
  const unprotected = (result.positions ?? []).filter((p) => p.stop_loss === null);
  const names = unprotected.map((p) => p.symbol).filter(Boolean);
  const namesWithoutAStop =
    names.length <= 1
      ? names[0] ?? ''
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return (
    /*
      mt-6 because every other block on this page has it and this one did
      not, so it sat flush against the metrics above with no gap at all -
      reported as "touching the sections above".

      Lighter than those metric cards on purpose. This is a footnote to the
      account, not a seventh headline statistic, and it was drawn heavier
      than any of them: a full-weight border and an 18px lead icon under a
      text-lg heading.
    */
    <div className="mt-6 mb-6 rounded-2xl border border-white/[0.07] bg-[#0A0A0A] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <h2 className="text-[13px] uppercase tracking-[0.12em] text-gray-400 flex items-center gap-2">
          <Activity size={14} className="text-brand-blue-light" />
          Open now
          {result && result.count > 0 && (
            <span className="text-gray-500">({result.count})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => { void load(); }}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="Refresh open positions"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/*
        One line, not a card's worth of empty space around one grey
        sentence - which is what it looked like on screen when the account
        could not answer, and reads as the panel itself being broken.
      */}
      {result?.error && (
        <p className="text-[13px] text-gray-500 leading-relaxed">
          {result.accountNotRunning
            ? `Live positions need ${accountName ?? 'this account'} to be running. It starts again on its own when syncing resumes.`
            : result.error}
        </p>
      )}

      {result && !result.error && result.count > 0 && (
        <>
          {/*
            The loudest thing on the panel, because it is the one that costs
            money. A position with no stop is not a style choice to report
            neutrally alongside the others.
          */}
          {unprotected.length > 0 && (
            <div className="flex items-start gap-2 mb-3.5 p-3 rounded-lg border border-brand-blue-light/30 bg-brand-blue/10">
              <AlertTriangle size={15} className="text-brand-blue-light flex-shrink-0 mt-0.5" />
              <p className="text-[13.5px] text-white leading-relaxed">
                {namesWithoutAStop} {unprotected.length === 1 ? 'has' : 'have'} no stop loss set.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {result.positions.map((p) => (
              <div
                key={p.position_id ?? `${p.symbol}-${p.opened_at}`}
                className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    p.direction === 'LONG' ? 'bg-blue-400' : 'bg-gray-400'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.symbol}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {fmtPrice(p.open_price)} &rarr; {fmtPrice(p.current_price)}
                      {p.stop_loss === null && (
                        <span className="text-brand-blue-light"> &middot; no stop</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-medium ${valueColorClass(p.unrealised_pnl ?? 0)}`}>
                    {(p.unrealised_pnl ?? 0) >= 0 ? '+' : ''}
                    ${(p.unrealised_pnl ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmtVolume(p.volume)} &middot; {p.direction === 'LONG' ? 'Long' : 'Short'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Unrealised, not counted in any P&amp;L above &mdash; these are still open.
          </p>
        </>
      )}
    </div>
  );
}
