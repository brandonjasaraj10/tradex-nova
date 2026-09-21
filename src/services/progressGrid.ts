/*
  A year of process scores for the dashboard grid.

  One call, one round trip, and the work happens in Postgres: 365 days across
  four tables is not something to assemble in a browser, and the page only
  needs a short list of {day, score}.

  Days with no entry are simply absent from the result rather than returned as
  zeroes. That keeps the payload to the days somebody actually journalled -
  typically a few dozen, not 365 - and the grid fills the gaps itself, which
  it has to do anyway to draw a calendar.
*/

import { supabase } from '../lib/supabase';

export interface ProcessDay {
  day: string;
  score: number;
  entries: number;
}

export async function getProcessScores(
  userId: string,
  from: Date,
  to: Date,
  accountId: string | null,
): Promise<ProcessDay[]> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc('daily_process_scores', {
    p_user_id: userId,
    p_from: iso(from),
    p_to: iso(to),
    p_account_id: accountId,
  });

  if (error) {
    console.error('Could not load process scores', error);
    return [];
  }

  return (data ?? []) as ProcessDay[];
}
