// `new Date("YYYY-MM-DD")` parses a date-only string as midnight UTC, not
// local midnight. For anyone west of UTC (this app's real users included -
// confirmed America/Denver), formatting that Date with a local-timezone
// method (.toLocaleDateString(), .getDate(), .getDay(), etc.) then displays
// or buckets it under the day *before* the one actually stored. The inverse
// happens with `someDate.toISOString().split('T')[0]`: that always yields
// the UTC date, which can already be tomorrow once it's evening locally -
// silently wrong for any local-day storage, comparison, or boundary use.
//
// Only relevant for date-only concepts (a `date` column, "today", a
// calendar day bucket, a week/month boundary). A genuine timestamp that's
// staying a full ISO datetime in a timestamptz column is unaffected.

// Local "YYYY-MM-DD" for a Date - use instead of toISOString().split('T')[0]
// whenever the result represents or compares against a date-only value.
export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Parses a "YYYY-MM-DD" string as local midnight - use instead of
// `new Date(dateOnlyString)` whenever the result will be read back with a
// local-timezone method (.toLocaleDateString(), .getDate(), .getDay(), etc.)
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
