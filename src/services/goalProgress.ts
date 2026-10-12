import { supabase } from '../lib/supabase';

/*
  Which days count toward the journaling goal.

  WHAT COUNTS AS JOURNALED

  A day counts when it has at least one entry the trader actually filled in.
  One a day at most: five trades journaled on a Monday is one day, so the
  goal cannot be finished in an afternoon, and a day with no trades is
  never a miss.

  "Filled in" means something only the trader could have put there:
    - their own words in the notes (a few words at least), or
    - any tick against their rules, confluences or psychology checks, or
    - any of the three before-the-trade ratings.

  WHY THE RULE IS NEEDED

  Every synced trade gets a journal entry made for it automatically (the
  ensure_journal_entry_for_trade trigger): title, symbol, direction, size,
  duration - and nothing written. Counting entries would have counted the
  broker sync, and a CSV import of last year would have finished the goal
  on day one. Those auto-made entries only count once the trader writes in
  them or ticks something. Entries dated before the goal started never
  count, so imported history cannot either.
*/

export const MILESTONES = [7, 14, 30, 66] as const;
export type Milestone = (typeof MILESTONES)[number];

/* Fewer than this many words is a stray keystroke, not an entry. */
const MIN_WORDS = 3;

function ownWords(...fields: (string | null | undefined)[]): number {
  const text = fields
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ');
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

/* The local days, from `since` on, with at least one filled-in entry. */
export async function journaledDays(userId: string, since: string): Promise<Set<string>> {
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, entry_date, content, pre_market_notes, post_market_notes, pre_trade_emotional_state, pre_trade_focus, pre_trade_confidence')
    .eq('user_id', userId)
    .eq('is_tour_demo', false)
    .gte('entry_date', since);
  if (error || !entries?.length) return new Set();

  const days = new Set<string>();
  const unsure: { id: string; day: string }[] = [];
  for (const e of entries) {
    const day = e.entry_date as string;
    if (!day || days.has(day)) continue;
    const rated = e.pre_trade_emotional_state != null || e.pre_trade_focus != null || e.pre_trade_confidence != null;
    if (rated || ownWords(e.content, e.pre_market_notes, e.post_market_notes) >= MIN_WORDS) days.add(day);
    else unsure.push({ id: e.id as string, day });
  }

  /* Nothing written on these - a tick on any checklist still counts. */
  const pending = unsure.filter((u) => !days.has(u.day));
  if (pending.length) {
    const ids = pending.map((u) => u.id);
    const ticked = new Set<string>();
    const tables = ['journal_entry_rules', 'journal_entry_confluences', 'journal_entry_psychology_checks'];
    /* In batches: a busy synced account can have hundreds of blank entries, too many ids for one request. */
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
    const results = await Promise.all(
      tables.flatMap((t) => batches.map((b) => supabase.from(t).select('journal_entry_id').in('journal_entry_id', b))),
    );
    for (const r of results) for (const row of r.data ?? []) ticked.add(row.journal_entry_id as string);
    for (const u of pending) if (ticked.has(u.id)) days.add(u.day);
  }
  return days;
}
