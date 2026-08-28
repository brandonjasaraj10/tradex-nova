import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useAccount } from '../lib/accountContext';
import { useDateRange } from '../lib/dateRangeContext';
import { getTradeLog, type TradeLogRow } from '../services/trades';
import { valueColorClass } from '../utils/formatMetrics';
import { parseLocalDate } from '../utils/dateHelpers';
import Card from '../components/shared/Card';
import DateRangePicker from '../components/shared/DateRangePicker';
import AccountSelector from '../components/shared/AccountSelector';
import PageLoader from '../components/shared/PageLoader';

/*
  Every position in one list, searchable.

  Until now there was no page that simply showed the trades. The Dashboard
  carries a short "recent" strip, the Calendar shows days, and Analytics
  aggregates - so finding one particular trade meant hunting. This is the
  plain record.

  It reads getTradeLog, which merges the `trades` table with journal entries
  that carry a P&L. Listing only `trades` would look complete while hiding
  every journal-logged trade - the same omission that shipped three times
  elsewhere in this app.
*/

function formatDate(value: string): string {
  if (!value) return '--';
  // Journal dates are plain YYYY-MM-DD; parsing those as UTC shifts them a
  // day backwards for anyone behind UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDate(value) : new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export default function TradeLogs() {
  const { user } = useAuth();
  const { accounts, selectedAccount, setSelectedAccount, refreshAccounts } = useAccount();
  const { dateRange, setDateRange } = useDateRange();

  const [rows, setRows] = useState<TradeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await getTradeLog(
          [dateRange.startDate, dateRange.endDate],
          selectedAccount?.id
        );
        if (!cancelled) setRows(data);
      } catch (error) {
        console.error('Error loading trade log:', error);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // Follows the account and the shared date range, like every other page.
    // A list that ignored the picker sitting directly above it would read as
    // stale rather than deliberate.
  }, [user, selectedAccount, dateRange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.symbol.toLowerCase().includes(q) ||
      r.direction.toLowerCase().includes(q) ||
      (r.setup || '').toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [rows, search]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Trade Logs</h1>
            <p className="text-sm text-gray-400 mt-1">Every position, searchable</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <AccountSelector
              accounts={accounts}
              selectedAccount={selectedAccount}
              onAccountChange={setSelectedAccount}
              onAccountsUpdate={refreshAccounts}
            />
          </div>
        </div>

        <div className="relative mb-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by symbol, setup, tag or note"
            className="w-full bg-[#111] border border-white/10 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-400/60 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          /*
            Two different empty states. "You have no trades" and "your search
            matched nothing" need different words - collapsing them tells a
            searching user their account is empty, which is alarming and wrong.
          */
          <Card>
            <div className="p-10 text-center">
              <BookOpen size={40} className="mx-auto mb-4 text-gray-600" />
              {rows.length === 0 ? (
                <>
                  <h3 className="text-base font-semibold text-white mb-1">No trades in this period</h3>
                  <p className="text-sm text-gray-400">
                    Log a trade in your journal or import a statement, and it will show up here.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-white mb-1">Nothing matches &ldquo;{search}&rdquo;</h3>
                  <p className="text-sm text-gray-400">
                    {rows.length} {rows.length === 1 ? 'trade' : 'trades'} in this period, none matching that search.
                  </p>
                </>
              )}
            </div>
          </Card>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              {filtered.length} of {rows.length} {rows.length === 1 ? 'trade' : 'trades'}
            </p>
            <div className="space-y-2">
              {filtered.map((row, i) => {
                const isLong = row.direction.toUpperCase() === 'LONG';
                return (
                  <motion.div
                    key={`${row.source}-${row.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02 }}
                  >
                    <Card variant="default" className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${isLong ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
                          {isLong
                            ? <ArrowUpRight size={16} className="text-blue-400" />
                            : <ArrowDownRight size={16} className="text-gray-400" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{row.symbol || 'Unknown'}</span>
                            {row.direction && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isLong ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                {row.direction.toUpperCase()}
                              </span>
                            )}
                            {/*
                              Where the row came from. Blending an imported
                              trade with a journal-written one without saying
                              so makes the missing prices below look like a
                              bug rather than a different kind of record.
                            */}
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-gray-500">
                              {row.source === 'journal' ? 'Journal' : 'Imported'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {formatDate(row.entry_date)}
                            {row.setup && <span className="text-gray-600"> &middot; {row.setup}</span>}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold ${valueColorClass(row.pnl)}`}>{formatMoney(row.pnl)}</p>
                          {row.entry_price != null && row.exit_price != null && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {row.entry_price} &rarr; {row.exit_price}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
