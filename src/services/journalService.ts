import { supabase } from '../lib/supabase';

export interface JournalFolder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  order_index: number;
  template_type?: string;
  created_at: string;
  updated_at: string;
}

export interface Screenshot {
  url: string;
  label: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  folder_id: string;
  entry_date: string;
  title?: string;
  content: string;
  mood?: string;
  symbol?: string;
  direction?: string;
  trade_duration?: string;
  // Text, with the unit intact - "0.5 lots", "1 contract", "2%".
  // Nullable because clearing the field writes null rather than dropping it.
  position_size?: string | null;
  manual_pnl?: number;
  tags: string[];
  attachments: any[];
  before_screenshots?: Screenshot[];
  after_screenshots?: Screenshot[];
  pre_market_notes?: string;
  post_market_notes?: string;
  custom_sections?: any[];
  template_data?: any;
  linked_entry_id?: string;
  account_id?: string | null;
  nova_session_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalTradeEntry {
  id: string;
  journal_entry_id: string;
  trade_id?: string;
  analysis?: string;
  lessons_learned?: string;
  emotional_state?: string;
  created_at: string;
}

export async function getFolders(): Promise<JournalFolder[]> {
  const { data, error } = await supabase
    .from('journal_folders')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createFolder(folder: Omit<JournalFolder, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<JournalFolder> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journal_folders')
    .insert({
      ...folder,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFolder(id: string, updates: Partial<JournalFolder>): Promise<JournalFolder> {
  const { data, error } = await supabase
    .from('journal_folders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_folders')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getEntriesByFolder(folderId: string, accountId?: string): Promise<JournalEntry[]> {
  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('folder_id', folderId);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query.order('entry_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getEntriesByDateRange(folderId: string, startDate: string, endDate: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('folder_id', folderId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getEntryByDate(folderId: string, date: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('folder_id', folderId)
    .eq('entry_date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getEntriesByDate(folderId: string, date: string, accountId?: string): Promise<JournalEntry[]> {
  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('folder_id', folderId)
    .eq('entry_date', date);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createEntry(entry: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<JournalEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      ...entry,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from('journal_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getTradeEntriesByJournalEntry(journalEntryId: string): Promise<JournalTradeEntry[]> {
  const { data, error } = await supabase
    .from('journal_trade_entries')
    .select('*')
    .eq('journal_entry_id', journalEntryId);

  if (error) throw error;
  return data || [];
}

export async function createTradeEntry(tradeEntry: Omit<JournalTradeEntry, 'id' | 'created_at'>): Promise<JournalTradeEntry> {
  const { data, error } = await supabase
    .from('journal_trade_entries')
    .insert(tradeEntry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTradeEntry(id: string, updates: Partial<JournalTradeEntry>): Promise<JournalTradeEntry> {
  const { data, error } = await supabase
    .from('journal_trade_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTradeEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_trade_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getPsychologyFolderId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('journal_folders')
    .select('id')
    .eq('template_type', 'psychology')
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}

export async function getPsychologyEntryForDate(date: string): Promise<JournalEntry | null> {
  const psychologyFolderId = await getPsychologyFolderId();
  if (!psychologyFolderId) return null;

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('folder_id', psychologyFolderId)
    .eq('entry_date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLinkedEntry(entryId: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('linked_entry_id', entryId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createLinkedPsychologyEntry(
  sourceEntry: JournalEntry,
  templateData: any
): Promise<JournalEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const psychologyFolderId = await getPsychologyFolderId();
  if (!psychologyFolderId) throw new Error('Psychology folder not found');

  // Check if a linked psychology entry already exists
  const existingLinked = await getLinkedEntry(sourceEntry.id);

  if (existingLinked) {
    // Update existing linked entry
    return await updateEntry(existingLinked.id, {
      template_data: templateData,
      title: sourceEntry.title ? `Psychology: ${sourceEntry.title}` : `Psychology - ${sourceEntry.entry_date}`,
      symbol: sourceEntry.symbol,
    });
  }

  // Create new psychology entry linked to source
  const psychologyEntry = await createEntry({
    folder_id: psychologyFolderId,
    entry_date: sourceEntry.entry_date,
    content: '',
    title: sourceEntry.title ? `Psychology: ${sourceEntry.title}` : `Psychology - ${sourceEntry.entry_date}`,
    symbol: sourceEntry.symbol,
    tags: [],
    attachments: [],
    template_data: templateData,
    linked_entry_id: sourceEntry.id,
  });

  // Update source entry to link back
  await updateEntry(sourceEntry.id, {
    linked_entry_id: psychologyEntry.id,
  });

  return psychologyEntry;
}

export async function syncPsychologyToLinkedEntry(
  entryId: string,
  templateData: any
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get the entry being edited
  const { data: currentEntry, error: entryError } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (entryError) throw entryError;
  if (!currentEntry) return;

  // If entry has a linked entry, update it
  if (currentEntry.linked_entry_id) {
    await updateEntry(currentEntry.linked_entry_id, {
      template_data: {
        ...(currentEntry.template_data || {}),
        ...templateData,
      },
    });
  } else {
    // Check if there's an entry linked TO this one
    const linkedToMe = await getLinkedEntry(entryId);
    if (linkedToMe) {
      await updateEntry(linkedToMe.id, {
        template_data: {
          ...(linkedToMe.template_data || {}),
          ...templateData,
        },
      });
    }
  }
}

export async function getAllEntriesForDate(date: string): Promise<JournalEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('entry_date', date)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}
