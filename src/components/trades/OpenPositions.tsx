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

export default function OpenPositions({ connectionId, accountName }: Props) {
  const [result, setResult] = useState<OpenPositionsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    setResult(await getOpenPositions(connectionId));
    setLoading(false);
  }, [connectionId]);

  useEffect(() => { load(); }, [load]);

  /* Nothing to say for a manual account. */
  if (!connectionId) return null;

  /*
    Hidden entirely when there is nothing open and nothing wrong. An empty
    panel on every dashboard, every day, teaches people to stop looking at
    the spot where a warning will one day appear.
  */
  if (result && !result.error && result.count === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Activity size={18} className="text-brand-blue-light" />
          Open now
          {result && result.count > 0 && (
            <span className="text-sm text-gray-400">({result.count})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="Refresh open positions"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {result?.error && (
        <p className="text-sm text-gray-400">
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
          {result.without_a_stop > 0 && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg border border-brand-blue-light/30 bg-brand-blue/10">
              <AlertTriangle size={16} className="text-brand-blue-light flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white">
                {result.without_a_stop === 1
                  ? 'One of these has no stop loss set.'
                  : `${result.without_a_stop} of these have no stop loss set.`}
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
                    {p.volume ?? '--'} &middot; {p.direction === 'LONG' ? 'Long' : 'Short'}
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
