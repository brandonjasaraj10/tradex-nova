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
