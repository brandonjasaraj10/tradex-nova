import { supabase } from '../lib/supabase';

export interface Confluence {
  id: string;
  user_id: string;
  name: string;
  description: string;
  enabled: boolean;
  // null = never tracked yet, distinct from 0% (tracked, never present)
  usage_rate: number | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TradingPlanSettings {
  id: string;
  user_id: string;
  min_confluences_required: number;
  total_confluences: number;
  created_at: string;
  updated_at: string;
}

/*
  usage_rate is a stored column that nothing in the app has ever written.
  Every confluence is created with 0 and stays 0 forever, so the dashboard's
  per-confluence "Usage" and the "Avg. Adherence" figure derived from it were
  permanently 0% no matter how the trader actually traded - a confluence
  marked present on 2 of 2 entries still displayed 0%.

  Rather than maintain a denormalised counter that can drift out of date, the
  rate is computed from the journal_entry_confluences rows that already
  record it, at read time. Null means "never tracked", which is a different
  statement from 0% ("recorded, and never present").

  Optionally scoped to one account so the figure matches the rest of the
  dashboard when an account is selected.
*/
export async function getUserConfluences(accountId?: string | null): Promise<Confluence[]> {
  const { data, error } = await supabase
    .from('trading_confluences')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) throw error;
  const confluences = data || [];
  if (confluences.length === 0) return [];

  let usageQuery = supabase
    .from('journal_entry_confluences')
    .select('confluence_id, present, journal_entries!inner(account_id)')
    .in('confluence_id', confluences.map(c => c.id));

  if (accountId) {
    usageQuery = usageQuery.eq('journal_entries.account_id', accountId);
  }

  const { data: usage, error: usageError } = await usageQuery;

  if (usageError) {
    // A usage lookup failure shouldn't hide the trader's confluences - show
    // them with an unknown rate rather than failing the whole panel.
    console.error('Error loading confluence usage:', usageError);
    return confluences.map(c => ({ ...c, usage_rate: null }));
  }

  const totals = new Map<string, { tracked: number; present: number }>();
  (usage || []).forEach((row: any) => {
    const t = totals.get(row.confluence_id) || { tracked: 0, present: 0 };
    t.tracked += 1;
    if (row.present === true) t.present += 1;
    totals.set(row.confluence_id, t);
  });

  return confluences.map(c => {
    const t = totals.get(c.id);
    return {
      ...c,
      usage_rate: t && t.tracked > 0 ? Math.round((t.present / t.tracked) * 100) : null,
    };
  });
}

export async function getTradingPlanSettings(): Promise<TradingPlanSettings | null> {
  const { data, error } = await supabase
    .from('trading_plan_settings')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createConfluence(confluence: Partial<Confluence>): Promise<Confluence> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trading_confluences')
    .insert({
      user_id: user.id,
      name: confluence.name,
      description: confluence.description || '',
      enabled: confluence.enabled ?? true,
      usage_rate: confluence.usage_rate || 0,
      order_index: confluence.order_index || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateConfluence(id: string, updates: Partial<Confluence>): Promise<Confluence> {
  const { data, error } = await supabase
    .from('trading_confluences')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteConfluence(id: string): Promise<void> {
  const { error } = await supabase
    .from('trading_confluences')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateTradingPlanSettings(settings: Partial<TradingPlanSettings>): Promise<TradingPlanSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('trading_plan_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('trading_plan_settings')
      .update(settings)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('trading_plan_settings')
      .insert({
        user_id: user.id,
        ...settings,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export async function initializeDefaultConfluences(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('trading_confluences')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const defaultConfluences = [
    { name: 'Trend Alignment', description: 'Price moving with higher timeframe trend', usage_rate: 0, order_index: 0 },
    { name: 'Key Support/Resistance', description: 'Price at major S/R level', usage_rate: 0, order_index: 1 },
    { name: 'Volume Confirmation', description: 'Increased volume at entry point', usage_rate: 0, order_index: 2 },
    { name: 'RSI Divergence', description: 'RSI showing bullish/bearish divergence', usage_rate: 0, order_index: 3, enabled: false },
    { name: 'MACD Crossover', description: 'MACD signal line crossover', usage_rate: 0, order_index: 4 },
    { name: 'Risk/Reward > 2:1', description: 'Minimum 2:1 risk to reward ratio', usage_rate: 0, order_index: 5 },
  ];

  const { error } = await supabase
    .from('trading_confluences')
    .insert(
      defaultConfluences.map(conf => ({
        user_id: user.id,
        ...conf,
      }))
    );

  // 23505 = unique_violation. Another call already seeded these
  // defaults (this function is called from both Dashboard and
  // Checklists, so both can race here) - that's a harmless outcome
  // now that the DB enforces one row per (user_id, name), not an error.
  if (error && error.code !== '23505') throw error;

  const { error: settingsError } = await supabase
    .from('trading_plan_settings')
    .insert({
      user_id: user.id,
      min_confluences_required: 3,
      total_confluences: 6,
    });

  if (settingsError && settingsError.code !== '23505') throw settingsError;
}
