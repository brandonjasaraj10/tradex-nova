import { supabase } from '../lib/supabase';

export interface Tip {
  id: string;
  user_id: string;
  tip_category: 'risk_management' | 'psychology' | 'discipline' | 'strategy' | 'market_conditions' | 'consistency' | 'timing';
  title: string;
  content: string;
  icon_name: string;
  priority: number;
  context_data: any;
  is_dismissed: boolean;
  dismissed_at: string | null;
  generated_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export async function generateTips(userId: string, forceRefresh: boolean = false): Promise<Tip[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tips`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      // No user_id: the function derives identity from the JWT in the
      // Authorization header above, and ignored this field anyway.
      body: JSON.stringify({
        force_refresh: forceRefresh
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate tips');
  }

  const result = await response.json();
  return result.tips || [];
}

export async function getActiveTips(userId: string): Promise<Tip[]> {
  const { data, error } = await supabase
    .from('user_tips')
    .select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .gt('expires_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching tips:', error);
    throw error;
  }

  return data || [];
}

export async function dismissTip(tipId: string): Promise<void> {
  const { error } = await supabase
    .from('user_tips')
    .update({
      is_dismissed: true,
      dismissed_at: new Date().toISOString()
    })
    .eq('id', tipId);

  if (error) {
    console.error('Error dismissing tip:', error);
    throw error;
  }
}

export async function refreshTips(userId: string): Promise<Tip[]> {
  return generateTips(userId, true);
}
