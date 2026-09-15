import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/*
  One date range, shared by every page that has a picker.

  The Dashboard and Analytics each used to hold their own dateRange in local
  state, with different defaults - the last 7 days and the last 30 - and both
  reset on every mount. So picking a range on one page and navigating to the
  other silently changed the window, and coming back reset the choice. With
  the NOVA Score now following the picker, that showed up as the same account
  scoring 35, 27 and "--" depending on which page you were looking at.

  Which preset was chosen is stored alongside the dates, and that is a
  revision of an earlier decision here.

  This used to keep absolute dates only, on the reasoning that a picked
  window should stay put rather than slide under you. That is right for a
  window somebody actually picked - "1 Sep to 8 Sep" means those days, and
  moving it would be its own bug. It is wrong for the relative ones. Someone
  who chose "This Year" on the 13th and came back on the 15th found every
  trade from the 14th and 15th missing, every statistic reading zero, and a
  picker still saying "Jan 1 - Sep 13" as though that were their choice. It
  was two days stale and nothing said so.

  So the two kinds are now told apart. "This Year", "Last 30 Days", "Today"
  and "All Time" mean a rule and are recomputed on load. "Yesterday", "Last
  Month" and a hand-picked custom range name fixed days and are restored
  exactly as stored.
*/

const STORAGE_KEY = 'tradex_date_range';

/*
  The last instant of a day, because a range end is a day and not a moment.

  Every query filters with .lte(endDate), so the end was taken literally: a
  range built at 07:20 asked for trades up to 07:20, and "All Time" stopped
  at whenever the picker happened to be clicked. A trade closed at 07:44 the
  same morning was outside a window labelled "Jan 1 - Sep 15" - it simply did
  not count, on a dashboard showing the day it happened.

  The presets had the same fault from the other direction: they end at
  new Date(y, m, d), which is midnight, so "Last 30 Days" excluded every
  trade taken today.

  This is not the same question as whether a stored range should slide
  forward day by day - that is deliberate and documented above. A window
  ending on the 15th should contain the 15th either way.
*/
function endOfDay(d: Date): Date {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end;
}

export type PresetKind =
  | 'today' | 'yesterday' | 'last7days' | 'last30days'
  | 'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime' | 'custom';

/*
  The presets that mean a rule rather than a pair of days. These are
  recomputed every time the app loads; everything else is restored as stored.
*/
const RELATIVE: ReadonlySet<PresetKind> = new Set<PresetKind>([
  'today', 'last7days', 'last30days', 'thisMonth', 'thisYear', 'allTime',
]);

export interface DateRange {
  startDate: Date;
  endDate: Date;
  /*
    Which preset produced this, when one did. Absent on ranges stored before
    this existed and on a custom pick, both of which are treated as fixed
    days - the safe reading, since it restores exactly what was stored.
  */
  preset?: PresetKind;
}

/*
  What each preset means, in one place.

  This lived in DateRangePicker, which meant the only code that knew how to
  build "Last 30 Days" was the dropdown - and the restore path could not
  recompute a range without duplicating it. Here, both use the same function.
*/
export function presetRange(preset: PresetKind, fallback?: DateRange): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const withKind = (startDate: Date, endDate: Date): DateRange =>
    ({ startDate, endDate: endOfDay(endDate), preset });

  switch (preset) {
    case 'today':
      return withKind(today, today);
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return withKind(yesterday, yesterday);
    }
    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return withKind(start, today);
    }
    case 'last30days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return withKind(start, today);
    }
    case 'thisMonth':
      return withKind(new Date(now.getFullYear(), now.getMonth(), 1), today);
    case 'lastMonth':
      return withKind(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth(), 0),
      );
    case 'thisYear':
      return withKind(new Date(now.getFullYear(), 0, 1), today);
    case 'allTime':
      return { ...allTimeRange(), preset };
    default:
      return fallback ?? defaultRange();
  }
}

/*
  "All time" is still a real date range rather than a null, because every
  query in the app takes a start and an end. Picking a date far enough back
  to predate any plausible trade history keeps that contract intact while
  behaving like no filter at all.
*/
export const ALL_TIME_START = new Date(2000, 0, 1);

export function allTimeRange(): DateRange {
  return { startDate: new Date(ALL_TIME_START), endDate: endOfDay(new Date()) };
}

/*
  Recognised by its start date, so the picker can show "All Time" instead of
  "Jan 1, 2000 - Sep 9, 2026", which is technically the same thing and
  useless to read.
*/
export function isAllTime(range: DateRange): boolean {
  return range.startDate.getTime() <= ALL_TIME_START.getTime();
}

/*
  All Time, for somebody who has not chosen.

  It used to open on the last 30 days, which quietly decided that a new
  account's history began a month ago - and for a trader who has just
  connected five years of it, the first thing TradeX showed was a fraction
  of their trading with nothing saying so.

  All Time is also the one default that cannot go stale. It is a relative
  preset, so it is recomputed on every load and always reaches today; a
  fixed window cannot make that promise, which is exactly how a range last
  touched on the 13th was still ending on the 13th two days later.
*/
function defaultRange(): DateRange {
  return { ...allTimeRange(), preset: 'allTime' };
}

function loadStoredRange(): DateRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRange();

    const parsed = JSON.parse(raw);
    const startDate = new Date(parsed.startDate);
    const endDate = new Date(parsed.endDate);

    // A corrupted or half-written value should not leave every page
    // querying with Invalid Date, which silently returns nothing.
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return defaultRange();

    /*
      A relative preset is a rule, so it is recomputed rather than restored.
      Without this, "This Year" chosen on the 13th still ended on the 13th
      two days later and silently hid everything traded since.
    */
    const preset = parsed.preset as PresetKind | undefined;
    if (preset && RELATIVE.has(preset)) return presetRange(preset);

    /* Ranges stored before this was fixed end at an instant. */
    return { startDate, endDate: endOfDay(endDate), preset };
  } catch {
    return defaultRange();
  }
}

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateRange>(loadStoredRange);

  const setDateRange = useCallback((incoming: DateRange) => {
    /*
      Normalised here rather than in each caller. Every range in the app
      arrives through this one function - the picker's presets, a custom pair
      of days, and the "All Time" the account selector sets - so one call
      covers all of them and none can reintroduce a midday end.
    */
    const range: DateRange = {
      startDate: incoming.startDate,
      endDate: endOfDay(incoming.endDate),
      preset: incoming.preset,
    };
    setDateRangeState(range);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        preset: range.preset,
      }));
    } catch {
      // A full or unavailable localStorage should not stop the range from
      // applying for this session.
    }
  }, []);

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) throw new Error('useDateRange must be used within a DateRangeProvider');
  return context;
}
