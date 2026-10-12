import { supabase } from '../lib/supabase';
import type { VoiceJournalData } from './voiceJournal';
import type { StarterItem } from '../lib/onboardingChecklist';

/*
  Writes the first entry from onboarding once there is somewhere to write it.

  WHY THIS EXISTS

  Onboarding ends with the trader describing a real trade and Nova turning it
  into an entry in front of them. It cannot be saved there: journal_entries,
  trading_rules and psychology_checks all require an active subscription at
  the RLS level, and nobody has paid yet. So Onboarding.tsx holds the whole
  set - entry, starter rules, starter checks - in localStorage under
  HELD_KEY, for the subscription flow to pick up.

  Nothing picked it up. The key was written and never read, so every first
  entry written in onboarding vanished the moment the trader paid: the one
  piece of their own work the flow had promised them, gone before they saw
  the journal. This is the reader.

  WHEN IT RUNS

  From PrivateRoute, the moment access is confirmed - which is the first
  point at which these inserts can succeed. If they still fail (a
  subscription row that has not landed yet, a dropped connection) the held
  copy is left in place and the next protected page load tries again. It is
  only removed once the entry row exists.

  ONCE, EVEN IF CALLED TWICE

  PrivateRoute re-checks access on every navigation, so this is called
  repeatedly in quick succession. A module-level promise makes concurrent
  calls share one run. Rules and checks are matched by name before inserting,
  so a retry after a partial failure does not duplicate them.
*/

export const HELD_KEY = 'tradex.onboarding.firstEntry';

interface Held {
  entry: VoiceJournalData;
  transcript: string;
  rules: StarterItem[];
  psychChecks: StarterItem[];
  at: number;
}

function readHeld(): Held | null {
  try {
    const raw = localStorage.getItem(HELD_KEY);
    if (!raw) return null;
    const held = JSON.parse(raw) as Held;
    return held?.entry ? held : null;
  } catch {
    return null;
  }
}

function clearHeld() {
  try {
    localStorage.removeItem(HELD_KEY);
  } catch {
    /* storage unavailable - nothing held to clear */
  }
}

/* The day they wrote it, in their own timezone - not UTC, which is tomorrow for half the evening. */
function localDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Starter slug -> real row id, creating any that do not exist yet. */
async function ensureRules(userId: string, items: StarterItem[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (!items.length) return ids;

  const { data: existing, error } = await supabase
    .from('trading_rules')
    .select('id, name')
    .eq('user_id', userId);
  if (error) throw error;

  const byName = new Map((existing ?? []).map((r) => [r.name, r.id as string]));
  const missing = items.filter((i) => !byName.has(i.name));

  if (missing.length) {
    const start = existing?.length ?? 0;
    const { data: inserted, error: insertError } = await supabase
      .from('trading_rules')
      .insert(
        missing.map((i, n) => ({
          user_id: userId,
          name: i.name,
          rule_text: i.name,
          category: 'psychology',
          enabled: true,
          is_active: true,
          order_index: start + n,
        })),
      )
      .select('id, name');
    if (insertError) throw insertError;
    for (const r of inserted ?? []) byName.set(r.name, r.id);
  }

  for (const i of items) {
    const id = byName.get(i.name);
    if (id) ids.set(i.id, id);
  }
  return ids;
}

async function ensureChecks(userId: string, items: StarterItem[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (!items.length) return ids;

  /* Same upsert seedStarterChecks uses - the unique (user_id, name) index absorbs a retry. */
  const { error } = await supabase.from('psychology_checks').upsert(
    items.map((i, n) => ({ user_id: userId, name: i.name, description: null, enabled: true, order_index: n })),
    { onConflict: 'user_id,name', ignoreDuplicates: true },
  );
  if (error) throw error;

  const { data: rows, error: readError } = await supabase
    .from('psychology_checks')
    .select('id, name')
    .eq('user_id', userId);
  if (readError) throw readError;

  const byName = new Map((rows ?? []).map((r) => [r.name, r.id as string]));
  for (const i of items) {
    const id = byName.get(i.name);
    if (id) ids.set(i.id, id);
  }
  return ids;
}

/* The folder the journal opens on. Falls back to the first one rather than failing. */
async function journalFolder(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('journal_folders')
    .select('id, name')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).find((f) => f.name === 'Daily Journal')?.id ?? data?.[0]?.id ?? null;
}

async function write(held: Held): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const [ruleIds, checkIds, folderId] = await Promise.all([
    ensureRules(user.id, held.rules ?? []),
    ensureChecks(user.id, held.psychChecks ?? []),
    journalFolder(user.id),
  ]);

  const e = held.entry;
  const { data: row, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: user.id,
      folder_id: folderId,
      account_id: null,
      entry_date: localDate(held.at || Date.now()),
      title: e.title?.trim() || 'My first entry',
      /* content is NOT NULL; Nova's write-up, or their own words if it gave none. */
      content: e.content || held.transcript || '',
      symbol: e.symbol || null,
      direction: e.direction || null,
      trade_duration: e.trade_duration || null,
      position_size: e.position_size || null,
      manual_pnl: typeof e.manual_pnl === 'number' ? e.manual_pnl : null,
      tags: e.tags ?? [],
      template_data: e.template_data ?? {},
      pre_market_notes: e.pre_market_notes || null,
      post_market_notes: e.post_market_notes || null,
      pre_trade_emotional_state: e.pre_trade_emotional_state ?? null,
      pre_trade_focus: e.pre_trade_focus ?? null,
      pre_trade_confidence: e.pre_trade_confidence ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  /*
    The entry exists, so the held copy goes now. Everything after this is
    the ticks against their rules and checks; losing those to a failure is
    a far smaller loss than writing the whole entry a second time on retry.
  */
  clearHeld();

  const ruleRows = (e.rules_status ?? [])
    .filter((r) => ruleIds.has(r.id))
    .map((r) => ({ journal_entry_id: row.id, rule_id: ruleIds.get(r.id)!, followed: r.followed, notes: '' }));
  const checkRows = (e.psychology_status ?? [])
    .filter((c) => checkIds.has(c.id))
    .map((c) => ({ journal_entry_id: row.id, check_id: checkIds.get(c.id)!, confirmed: c.confirmed, notes: '' }));

  const results = await Promise.all([
    ruleRows.length ? supabase.from('journal_entry_rules').insert(ruleRows) : Promise.resolve({ error: null }),
    checkRows.length ? supabase.from('journal_entry_psychology_checks').insert(checkRows) : Promise.resolve({ error: null }),
    /*
      And Nova remembers it. The first entry is the one trade they chose to
      tell her about before paying - usually the losing trade that brought
      them here - so the first time they open Nova she should already know
      it, not ask. Same table her remember_about_user tool writes to, so it
      comes into every conversation with the rest of what she knows.
    */
    supabase.from('nova_user_memories').insert({ user_id: user.id, content: firstEntryMemory(e, held) }),
  ]);
  for (const r of results) if (r.error) console.error('First entry saved, but a checklist tick or Nova memory did not:', r.error);
}

/* One short line for Nova: the trade, how they were going in, and what happened in their words. */
function firstEntryMemory(e: VoiceJournalData, held: Held): string {
  const day = new Date(held.at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const trade = [e.symbol, e.direction?.toLowerCase(), e.position_size].filter(Boolean).join(' ');
  const pnl = typeof e.manual_pnl === 'number' ? `, ${e.manual_pnl < 0 ? '-' : '+'}$${Math.abs(e.manual_pnl)}` : '';
  const ratings = [
    e.pre_trade_emotional_state != null ? `steadiness ${e.pre_trade_emotional_state}/5` : '',
    e.pre_trade_focus != null ? `focus ${e.pre_trade_focus}/5` : '',
    e.pre_trade_confidence != null ? `confidence ${e.pre_trade_confidence}/5` : '',
  ].filter(Boolean).join(', ');
  const words = (held.transcript || e.content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const said = words.length > 400 ? `${words.slice(0, 400).trimEnd()}…` : words;
  return [
    `Their first journal entry, written with me during signup on ${day}${trade ? `: ${trade}${pnl}` : ''}.`,
    ratings ? `Going in they rated ${ratings}.` : '',
    said ? `In their words: "${said}"` : '',
  ].filter(Boolean).join(' ');
}

let running: Promise<void> | null = null;

/* Never throws: this runs behind every protected page and must never break one. */
export function writeHeldFirstEntry(): Promise<void> {
  if (running) return running;
  const held = readHeld();
  if (!held) return Promise.resolve();

  running = write(held)
    .catch((err) => {
      console.error('Could not save the first entry from onboarding yet; will retry:', err);
    })
    .finally(() => {
      running = null;
    });
  return running;
}
