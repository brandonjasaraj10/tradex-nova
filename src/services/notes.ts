import { supabase } from '../lib/supabase';

export interface Note {
  id: string;
  user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export async function getNotes(limit: number = 10): Promise<Note[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

export async function createNote(content: string, title?: string): Promise<Note | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const noteTitle = title || content.substring(0, 50).trim() || 'Quick Note';

    const { data, error } = await supabase
      .from('notes')
      .insert([{ user_id: user.id, content, title: noteTitle }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating note:', error);
    return null;
  }
}

export async function updateNote(id: string, content: string): Promise<Note | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating note:', error);
    return null;
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

export async function markNoteAsRead(id: string): Promise<Note | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking note as read:', error);
    return null;
  }
}

export async function toggleNoteReadStatus(id: string, currentStatus: boolean): Promise<Note | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .update({ is_read: !currentStatus })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error toggling note read status:', error);
    return null;
  }
}
