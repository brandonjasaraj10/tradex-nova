import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/*
  One date range, shared by every page that has a picker.

  The Dashboard and Analytics each used to hold their own dateRange in local
  state, with different defaults - the last 7 days and the last 30 - and both
  reset on every mount. So picking a range on one page and navigating to the
  other silently changed the window, and coming back reset the choice. With
  the NOVA Score now following the picker, that showed up as the same account
  scoring 35, 27 and "--" depending on which page you were looking at.

  The chosen range is stored as absolute dates rather than as a preset like
  "last 30 days". If someone picks a window, that exact window is what they
  keep seeing until they change it - which is the behaviour a picker implies.
  A stored preset would silently slide forward day by day instead.
*/

const STORAGE_KEY = 'tradex_date_range';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/*
  "All time" is still a real date range rather than a null, because every
  query in the app takes a start and an end. Picking a date far enough back
  to predate any plausible trade history keeps that contract intact while
  behaving like no filter at all.
*/
export const ALL_TIME_START = new Date(2000, 0, 1);

export function allTimeRange(): DateRange {
  return { startDate: new Date(ALL_TIME_START), endDate: new Date() };
}

/*
  Recognised by its start date, so the picker can show "All Time" instead of
  "Jan 1, 2000 - Sep 9, 2026", which is technically the same thing and
  useless to read.
*/
export function isAllTime(range: DateRange): boolean {
  return range.startDate.getTime() <= ALL_TIME_START.getTime();
}

function defaultRange(): DateRange {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29);
  return { startDate, endDate };
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

    return { startDate, endDate };
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

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
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
