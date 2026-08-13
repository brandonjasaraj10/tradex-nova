import { supabase } from '../lib/supabase';

export interface TradingRule {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: 'risk_management' | 'timing' | 'psychology' | 'strategy' | 'other';
  enabled: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryConfluence {
  id: string;
  journal_entry_id: string;
  confluence_id: string;
  checked: boolean;
  present: boolean | null;
  notes: string;
  created_at: string;
}

export interface JournalEntryRule {
  id: string;
  journal_entry_id: string;
  rule_id: string;
  followed: boolean;
  notes: string;
  created_at: string;
}

export async function getTradingRules(userId: string): Promise<TradingRule[]> {
  const { data, error } = await supabase
    .from('trading_rules')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createTradingRule(rule: Omit<TradingRule, 'id' | 'created_at' | 'updated_at'>): Promise<TradingRule> {
  const { data, error } = await supabase
    .from('trading_rules')
    .insert([rule])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTradingRule(id: string, updates: Partial<TradingRule>): Promise<TradingRule> {
  const { data, error } = await supabase
    .from('trading_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTradingRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('trading_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getJournalEntryConfluences(journalEntryId: string): Promise<JournalEntryConfluence[]> {
  const { data, error } = await supabase
    .from('journal_entry_confluences')
    .select('*')
    .eq('journal_entry_id', journalEntryId);

  if (error) throw error;
  return data || [];
}

export async function upsertJournalEntryConfluence(
  confluence: Omit<JournalEntryConfluence, 'id' | 'created_at'>
): Promise<JournalEntryConfluence> {
  const { data, error } = await supabase
    .from('journal_entry_confluences')
    .upsert([confluence], {
      onConflict: 'journal_entry_id,confluence_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getJournalEntryRules(journalEntryId: string): Promise<JournalEntryRule[]> {
  const { data, error } = await supabase
    .from('journal_entry_rules')
    .select('*')
    .eq('journal_entry_id', journalEntryId);

  if (error) throw error;
  return data || [];
}

export async function upsertJournalEntryRule(
  rule: Omit<JournalEntryRule, 'id' | 'created_at'>
): Promise<JournalEntryRule> {
  const { data, error } = await supabase
    .from('journal_entry_rules')
    .upsert([rule], {
      onConflict: 'journal_entry_id,rule_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function batchUpdateJournalEntryConfluences(
  journalEntryId: string,
  confluences: Array<{ confluence_id: string; checked: boolean; present: boolean | null; notes?: string }>
): Promise<void> {
  const entries = confluences.map(c => ({
    journal_entry_id: journalEntryId,
    confluence_id: c.confluence_id,
    checked: c.checked,
    present: c.present,
    notes: c.notes || ''
  }));

  const { error } = await supabase
    .from('journal_entry_confluences')
    .upsert(entries, {
      onConflict: 'journal_entry_id,confluence_id'
    });

  if (error) throw error;
}

export async function batchUpdateJournalEntryRules(
  journalEntryId: string,
  rules: Array<{ rule_id: string; followed: boolean; notes?: string }>
): Promise<void> {
  const entries = rules.map(r => ({
    journal_entry_id: journalEntryId,
    rule_id: r.rule_id,
    followed: r.followed,
    notes: r.notes || ''
  }));

  const { error } = await supabase
    .from('journal_entry_rules')
    .upsert(entries, {
      onConflict: 'journal_entry_id,rule_id'
    });

  if (error) throw error;
}
