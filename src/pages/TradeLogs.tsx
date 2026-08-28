import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, X, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../lib/accountContext';
import { useDateRange } from '../lib/dateRangeContext';
import { getTradeLog, type TradeLogRow } from '../services/trades';
import { valueColorClass } from '../utils/formatMetrics';
import { parseLocalDate } from '../utils/dateHelpers';
import Card from '../components/shared/Card';
import DateRangePicker from '../components/shared/DateRangePicker';
import AccountSelector from '../components/shared/AccountSelector';
import PageLoader from '../components/shared/PageLoader';
import TradeTrendGlyph from '../components/trades/TradeTrendGlyph';
import TradeCardVisual from '../components/trades/TradeCardVisual';

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

const VIEW_STORAGE_KEY = 'tradex_trade_log_view';

export default function TradeLogs() {
  const { user } = useAuth();
  const { accounts, selectedAccount, setSelectedAccount, refreshAccounts } = useAccount();
  const navigate = useNavigate();

  /*
    Open a trade where it actually lives: that day in the journal.

    The journal is account-scoped, so jumping straight to the date while a
    different account is selected lands on an empty day - the trade would
    look like it had vanished. Switch the account first when it differs, then
    navigate. Rows whose account was deleted keep account_id null and are
    left on whatever is selected, since there is nothing to switch to.
  */
  const openInJournal = async (row: TradeLogRow) => {
    if (row.account_id && row.account_id !== selectedAccount?.id) {
      const target = accounts.find((a) => a.id === row.account_id);
      if (target) await setSelectedAccount(target);
    }
    navigate(`/journal?date=${row.entry_date.slice(0, 10)}`);
  };

  // Only worth labelling rows by account when they can actually differ.
  const showAccountLabel = !selectedAccount;
  const { dateRange, setDateRange } = useDateRange();

  const [rows, setRows] = useState<TradeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  /*
    Remembered between visits, the same as the account and date range. A
    layout choice that resets on every navigation is worse than not offering
    one, because the user has to keep re-making it.
  */
  const [view, setView] = useState<'cards' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  });

  const chooseView = (next: 'cards' | 'list') => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* private mode */ }
  };

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

    /*
      P&L is searchable, because "I made about 4000 on one of these, which
      one?" is a real way people look for a trade they half-remember - and
      the amount is often the only thing they do remember.

      Matching needs a few spellings of the same number. The value is stored
      as 4000 but shown as "+$4,000.00", so someone typing 4000, 4,000, $4000
      or 4000.00 should all land on it. Comparing against several rendered
      forms is simpler and more predictable than parsing what they typed.

      The sign is deliberately included: typing "-" finds every loser, since
      only losses carry a minus. Searching the absolute value as well means
      "500" still finds a -$500 trade, because someone recalling the size of
      a loss rarely types the sign.
    */
    const money = (r: TradeLogRow) => {
      const abs = Math.abs(r.pnl);
      return [
        String(r.pnl),                                    // -500.5
        r.pnl.toFixed(2),                                 // -500.50
        String(abs),                                      // 500.5
        abs.toFixed(2),                                   // 500.50
        abs.toLocaleString('en-US'),                      // 4,000
        abs.toLocaleString('en-US', { minimumFractionDigits: 2 }), // 4,000.00
        `${r.pnl < 0 ? '-' : '+'}$${abs.toFixed(2)}`,     // +$4000.00
      ].join(' ').toLowerCase();
    };

    // "$4,000" and "4000" should behave the same, so punctuation the user
    // types is ignored on both sides of the comparison.
    const stripped = q.replace(/[$,\s]/g, '');

    return rows.filter((r) =>
      r.symbol.toLowerCase().includes(q) ||
      r.direction.toLowerCase().includes(q) ||
      (r.setup || '').toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q) ||
      (r.account_name || '').toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q)) ||
      (stripped.length > 0 && money(r).replace(/[$,\s]/g, '').includes(stripped))
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

        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by symbol, amount, setup, tag or note"
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

          {/* Layout switch, next to the thing it changes. */}
          <div className="flex items-center gap-1 bg-[#111] border border-white/10 rounded-xl p-1 flex-shrink-0">
            {([
              { id: 'list' as const, icon: List, label: 'List view' },
              { id: 'cards' as const, icon: LayoutGrid, label: 'Card view' },
            ]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => chooseView(id)}
                aria-label={label}
                aria-pressed={view === id}
                title={label}
                className={`p-2 rounded-lg transition-colors ${
                  view === id ? 'bg-blue-400/15 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
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

            {view === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((row, i) => {
                  const isLong = row.direction.toUpperCase() === 'LONG';
                  return (
                    <motion.div
                      key={`${row.source}-${row.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.03 }}
                      onClick={() => openInJournal(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInJournal(row); } }}
                      className="rounded-xl overflow-hidden border border-white/10 bg-[#0A0A0A] hover:border-blue-400/30 transition-colors cursor-pointer text-left focus:outline-none focus-visible:border-blue-400/60"
                    >
                      <TradeCardVisual screenshot={row.screenshot} symbol={row.symbol} pnl={row.pnl} />

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold truncate ${row.symbol ? 'text-white' : 'text-gray-500'}`}>{row.symbol || 'No symbol'}</span>
                              {row.direction && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isLong ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                  {row.direction.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{formatDate(row.entry_date)}</p>
                            {showAccountLabel && (
                              <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                                {row.account_name ?? 'Account removed'}
                              </p>
                            )}
                          </div>
                          <p className={`font-bold whitespace-nowrap ${valueColorClass(row.pnl)}`}>
                            {formatMoney(row.pnl)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-gray-500">
                            {row.source === 'journal' ? 'Journal' : 'Imported'}
                          </span>
                          {row.entry_price != null && row.exit_price != null ? (
                            <span className="text-[10px] text-gray-500">
                              {row.entry_price} &rarr; {row.exit_price}
                            </span>
                          ) : (
                            /* Journal trades have no fill prices; say so rather
                               than leaving a gap that reads as a loading state. */
                            <span className="text-[10px] text-gray-600">No fill prices</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((row, i) => {
                  const isLong = row.direction.toUpperCase() === 'LONG';
                  return (
                    <motion.div
                      key={`${row.source}-${row.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02 }}
                      onClick={() => openInJournal(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInJournal(row); } }}
                      className="focus:outline-none focus-visible:rounded-xl focus-visible:ring-1 focus-visible:ring-blue-400/60"
                    >
                      <Card variant="default" className="p-4 cursor-pointer hover:border-blue-400/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg flex-shrink-0 bg-white/[0.03] flex items-center justify-center">
                            <TradeTrendGlyph pnl={row.pnl} size={20} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold ${row.symbol ? 'text-white' : 'text-gray-500'}`}>{row.symbol || 'No symbol'}</span>
                              {row.direction && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isLong ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                  {row.direction.toUpperCase()}
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-gray-500">
                                {row.source === 'journal' ? 'Journal' : 'Imported'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {formatDate(row.entry_date)}
                              {showAccountLabel && (
                                <span className="text-gray-600"> &middot; {row.account_name ?? 'Account removed'}</span>
                              )}
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
