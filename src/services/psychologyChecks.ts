import { supabase } from '../lib/supabase';

/*
  The pre-trade psychology checklist.

  Deliberately its own table rather than trading_rules filtered by
  category='psychology' - that category is already in use for behavioural
  limits like "max 1 trade per day", which belong in the Rules tab and answer
  a different question at a different moment. See the migration for the full
  reasoning.
*/

export interface PsychologyCheck {
  id: string;
  user_id: string;
  name: string;
  description: string;
  enabled: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryPsychologyCheck {
  id: string;
  journal_entry_id: string;
  check_id: string;
  // Null means unanswered, which is not the same as answered "no": one is
  // silence, the other is an admission worth spotting in hindsight.
  confirmed: boolean | null;
  notes: string;
  created_at: string;
}

/*
  Offered to someone with an empty checklist. Every one of these is a state
  the trader can honestly answer yes or no to before entering - not advice,
  and not a rule about the market. They are only a starting point; the list
  is theirs to edit.
*/
export const STARTER_CHECKS: Array<{ name: string; description: string }> = [
  { name: 'I am calm, not rushed', description: 'No urgency to be in a position right now.' },
  { name: 'I am not chasing a loss', description: 'This trade is not an attempt to win back the last one.' },
  { name: 'I slept enough', description: 'Rested enough to sit through the trade without forcing it.' },
  { name: 'I have a plan for this trade', description: 'Entry, stop and target decided before clicking.' },
  { name: 'I can afford to lose this risk', description: 'The size will not hurt if it goes against me.' },
];

export async function getPsychologyChecks(userId: string): Promise<PsychologyCheck[]> {
  const { data, error } = await supabase
    .from('psychology_checks')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPsychologyCheck(
  check: Pick<PsychologyCheck, 'user_id' | 'name' | 'description' | 'enabled' | 'order_index'>
): Promise<PsychologyCheck> {
  const { data, error } = await supabase
    .from('psychology_checks')
    .insert(check)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePsychologyCheck(
  id: string,
  updates: Partial<PsychologyCheck>
): Promise<PsychologyCheck> {
  const { data, error } = await supabase
    .from('psychology_checks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePsychologyCheck(id: string): Promise<void> {
  const { error } = await supabase.from('psychology_checks').delete().eq('id', id);
  if (error) throw error;
}

/*
  Seeds the starter list for someone who has none yet.

  Written as an upsert that ignores conflicts rather than a plain insert,
  because the caller's "do they have any?" check and this insert are two
  separate round trips: two loads can both read zero and both try to seed,
  which duplicated every starter check the first time this shipped. A unique
  index on (user_id, name) is what actually prevents it; ignoreDuplicates
  keeps the loser of that race from surfacing an error to the user.

  Returns the user's full list afterwards rather than whatever this call
  happened to insert, so the caller ends up with the same thing either way.
*/
export async function seedStarterChecks(userId: string): Promise<PsychologyCheck[]> {
  const rows = STARTER_CHECKS.map((c, i) => ({
    user_id: userId,
    name: c.name,
    description: c.description,
    enabled: true,
    order_index: i,
  }));

  const { error } = await supabase
    .from('psychology_checks')
    .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });

  if (error) throw error;
  return getPsychologyChecks(userId);
}

export async function getJournalEntryPsychologyChecks(
  journalEntryId: string
): Promise<JournalEntryPsychologyCheck[]> {
  const { data, error } = await supabase
    .from('journal_entry_psychology_checks')
    .select('*')
    .eq('journal_entry_id', journalEntryId);

  if (error) throw error;
  return data || [];
}

export async function upsertJournalEntryPsychologyCheck(
  journalEntryId: string,
  checkId: string,
  confirmed: boolean | null,
  notes = ''
): Promise<void> {
  const { error } = await supabase
    .from('journal_entry_psychology_checks')
    .upsert(
      { journal_entry_id: journalEntryId, check_id: checkId, confirmed, notes },
      { onConflict: 'journal_entry_id,check_id' }
    );

  if (error) throw error;
}

/*
  The psychology figures the NOVA Score needs, for one window and account.

  Lives here as a single function rather than being rebuilt on the Dashboard,
  Analytics and Nova pages, because this codebase has repeatedly ended up with
  the same metric computed three slightly different ways - the score itself
  read 73 on one page and "--" on another for exactly that reason.
*/
export interface PsychologyAggregate {
  entriesWithAnswers: number;
  entriesTotal: number;
  avgEmotionalState: number | null;
  avgFocus: number | null;
  avgConfidence: number | null;
}

export async function getPsychologyAggregate(
  userId: string,
  dateRange?: [Date, Date],
  accountId?: string | null
): Promise<PsychologyAggregate> {
  const empty: PsychologyAggregate = {
    entriesWithAnswers: 0,
    entriesTotal: 0,
    avgEmotionalState: null,
    avgFocus: null,
    avgConfidence: null,
  };

  let query = supabase
    .from('journal_entries')
    .select('id, pre_trade_emotional_state, pre_trade_focus, pre_trade_confidence')
    .eq('user_id', userId);

  if (dateRange) {
    // entry_date is a DATE column, so it is compared as a local day string -
    // an ISO timestamp here is what put evening trades in the wrong day
    // elsewhere in this codebase.
    const toDay = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    query = query.gte('entry_date', toDay(dateRange[0])).lte('entry_date', toDay(dateRange[1]));
  }
  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data: entries, error } = await query;
  if (error || !entries || entries.length === 0) return empty;

  const ids = entries.map((e: any) => e.id);
  const { data: answers } = await supabase
    .from('journal_entry_psychology_checks')
    .select('journal_entry_id, confirmed')
    .in('journal_entry_id', ids);

  /*
    An entry counts as answered if any check was given either a yes or a no.
    A null is someone who opened the entry and left the checklist alone, which
    is not engagement and must not be counted as it.
  */
  const answeredEntries = new Set(
    (answers || [])
      .filter((a: any) => a.confirmed === true || a.confirmed === false)
      .map((a: any) => a.journal_entry_id)
  );

  const average = (key: string) => {
    const values = entries
      .map((e: any) => e[key])
      .filter((v: any) => typeof v === 'number');
    if (values.length === 0) return null;
    return values.reduce((a: number, b: number) => a + b, 0) / values.length;
  };

  return {
    entriesWithAnswers: answeredEntries.size,
    entriesTotal: entries.length,
    avgEmotionalState: average('pre_trade_emotional_state'),
    avgFocus: average('pre_trade_focus'),
    avgConfidence: average('pre_trade_confidence'),
  };
}
