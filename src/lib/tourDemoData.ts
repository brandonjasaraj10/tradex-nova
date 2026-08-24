import { supabase } from './supabase';
import { generateReport } from '../services/reports';

export interface TourDemoDataIds {
  tradeIds: string[];
  journalEntryId: string | null;
}

const EMPTY_IDS: TourDemoDataIds = { tradeIds: [], journalEntryId: null };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// `.toISOString().split('T')[0]` gives the UTC date, not the local one -
// for anyone west of UTC that can silently land a "today" entry on
// tomorrow's date once it's past 6pm or so local time. Journal.tsx's own
// default date (formatLocalDate) is local, so seeded entries need to match.
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Seeds a handful of realistic-looking trades (plus one journal entry and a
// generated weekly report) so a brand new account isn't a wall of empty
// panels during the onboarding tour. Only runs for accounts with zero real
// trades, so this never touches an account with actual trading history.
// Always paired with cleanupTourDemoData() once the tour ends.
export async function seedTourDemoData(userId: string): Promise<TourDemoDataIds> {
  // Sweep up anything a previous interrupted tour left behind before
  // seeding again, so demo rows can never accumulate across runs.
  await cleanupTourDemoData(userId);

  // Real trades only - demo rows are excluded by the sweep above, but be
  // explicit so a leftover row can never make this think the account has
  // genuine trading history.
  const { count } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_tour_demo', false);

  const hasRealTrades = !!count && count > 0;

  let tradeIds: string[] = [];

  // Fake trades and a pre-warmed report only make sense for a truly empty
  // account - never inject these into an account with real trading
  // history. The journal-entry seed below is a separate concern (it only
  // ever adds content when today is otherwise blank) so it runs
  // regardless of trade history.
  if (!hasRealTrades) {
    const demoTrades = [
      { symbol: 'EURUSD', direction: 'LONG', entry_price: 1.0850, exit_price: 1.0891, quantity: 1, pnl: 410, setup: 'Breakout', daysAgo: 1 },
      { symbol: 'NAS100', direction: 'SHORT', entry_price: 18420, exit_price: 18395, quantity: 0.5, pnl: 125, setup: 'Reversal', daysAgo: 2 },
      { symbol: 'AAPL', direction: 'LONG', entry_price: 218.40, exit_price: 216.90, quantity: 10, pnl: -150, setup: 'Trend Continuation', daysAgo: 3 },
      { symbol: 'GBPUSD', direction: 'SHORT', entry_price: 1.2740, exit_price: 1.2695, quantity: 1, pnl: 450, setup: 'Support/Resistance', daysAgo: 5 },
      { symbol: 'BTCUSD', direction: 'LONG', entry_price: 61200, exit_price: 62050, quantity: 0.1, pnl: 85, setup: 'Breakout', daysAgo: 6 },
      { symbol: 'XAUUSD', direction: 'SHORT', entry_price: 2410, exit_price: 2418, quantity: 1, pnl: -80, setup: 'Reversal', daysAgo: 8 },
    ];

    const tradeRows = demoTrades.map(t => {
      const exitDate = daysAgo(t.daysAgo);
      const entryDate = new Date(exitDate);
      entryDate.setHours(entryDate.getHours() - 1);
      return {
        user_id: userId,
        symbol: t.symbol,
        direction: t.direction,
        entry_price: t.entry_price,
        exit_price: t.exit_price,
        quantity: t.quantity,
        pnl: t.pnl,
        entry_date: entryDate.toISOString(),
        exit_date: exitDate.toISOString(),
        setup: t.setup,
        timeframe: '15m',
        is_tour_demo: true,
      };
    });

    const { data: insertedTrades, error: tradesError } = await supabase
      .from('trades')
      .insert(tradeRows)
      .select('id');

    if (tradesError) {
      console.error('Error seeding tour demo trades:', tradesError);
    } else {
      tradeIds = (insertedTrades || []).map(t => t.id);
    }

    try {
      // Pre-warm this week's report so the Weekly Review tour step has
      // something ready immediately, with a forced fresh computation
      // rather than whatever Calendar's own (non-forced) load might have
      // cached already.
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      await generateReport(
        userId,
        'weekly',
        toLocalDateStr(weekStart),
        toLocalDateStr(weekEnd),
        true
      );
    } catch (err) {
      console.error('Error generating tour demo weekly report:', err);
    }
  }

  let journalEntryId: string | null = null;

  try {
    // Match by name, not template_type - the value actually written there
    // for a real new signup's default folder ('default') doesn't match
    // what log-journal-entry writes when it creates one itself ('daily'),
    // so template_type isn't a reliable way to find "the" Daily Journal
    // folder across every account.
    const { data: folder } = await supabase
      .from('journal_folders')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', 'Daily Journal')
      .maybeSingle();

    if (folder) {
      const todayLocal = toLocalDateStr(new Date());

      // Journal.tsx filters entries by whatever account is currently
      // selected, which defaults to the user's most-recently-created
      // trading account (see accountContext.tsx) - not "no account." An
      // entry seeded with a null account_id silently never matches that
      // filter for any account that already has a trading account set
      // up, so the "Organize with Nova" button never appears even though
      // the entry really was created. Match that same default here.
      const { data: mostRecentAccount } = await supabase
        .from('user_broker_connections')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Only seed if today is genuinely empty - never add a fake entry
      // alongside real content someone already wrote today.
      const { count: existingCount } = await supabase
        .from('journal_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('folder_id', folder.id)
        .eq('entry_date', todayLocal);

      if (!existingCount) {
        // Left as raw, unorganized text on purpose so the "Organize with
        // Nova" button (only rendered once there's real content to act
        // on) actually appears during that tour step instead of falling
        // back to "not currently visible."
        const { data: entry, error: entryError } = await supabase
          .from('journal_entries')
          .insert({
            user_id: userId,
            folder_id: folder.id,
            account_id: mostRecentAccount?.id ?? null,
            entry_date: todayLocal,
            title: `${todayLocal.slice(5, 7)}-${todayLocal.slice(8, 10)}-${todayLocal.slice(0, 4)} Entry 1`,
            content: 'went long gbpusd at 1.2740, half lot, waited for the retest into the demand zone before pulling the trigger. closed out around 1.2695 target hit, total 450 profit. felt disciplined today, didnt rush the entry',
            tags: [],
            attachments: [],
            is_tour_demo: true,
          })
          .select('id')
          .single();

        if (entryError) {
          console.error('Error seeding tour demo journal entry:', entryError);
        } else if (entry) {
          journalEntryId = entry.id;
        }
      }
    }
  } catch (err) {
    console.error('Error seeding tour demo journal entry:', err);
  }

  return { tradeIds, journalEntryId };
}

// Deletes by the is_tour_demo flag rather than by remembered ids. Ids
// only lived in a React ref, so a page reload mid-tour lost them and
// stranded fake trades in a real account forever - which is exactly what
// happened on a live account. A database flag survives reloads, closed
// tabs, and even a tour abandoned in a previous session.
export async function cleanupTourDemoData(userId: string) {
  try {
    const { data: removedTrades } = await supabase
      .from('trades')
      .delete()
      .eq('user_id', userId)
      .eq('is_tour_demo', true)
      .select('id');

    await supabase
      .from('journal_entries')
      .delete()
      .eq('user_id', userId)
      .eq('is_tour_demo', true);

    // Visiting Calendar during the tour auto-generates a cached weekly
    // report for every week shown, and those hold numbers derived from
    // the demo trades. Only clear them when demo trades actually existed
    // - otherwise this would wipe the real reports of an account that
    // has genuine trading history and simply replayed the tour.
    if (removedTrades && removedTrades.length > 0) {
      await supabase.from('trading_reports').delete().eq('user_id', userId);

      /*
        Tips and insights are derived from the demo trades too, and outlive
        them: they are generated during the tour, written to their own
        tables, and sit there for days.

        So the tour ends, the fake trades vanish, and the dashboard keeps
        announcing "Your 67% win rate across 6 trades shows a consistent
        edge" to someone who has never placed a trade. Every new user meets
        that on their first screen - a confident, specific, entirely
        invented claim about their own trading.

        Same condition as the reports above: only clear when demo trades
        actually existed, so replaying the tour on a real account does not
        wipe insights genuinely earned.
      */
      await supabase.from('user_tips').delete().eq('user_id', userId);
      await supabase.from('user_insights').delete().eq('user_id', userId);
    }
  } catch (err) {
    console.error('Error cleaning up tour demo data:', err);
  }
}
