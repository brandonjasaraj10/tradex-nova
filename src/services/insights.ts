import { supabase } from '../lib/supabase';

export interface Insight {
  id: string;
  user_id: string;
  insight_type: 'performance' | 'risk' | 'opportunity' | 'pattern' | 'discipline' | 'psychology' | 'consistency';
  title: string;
  description: string;
  category: 'positive' | 'warning' | 'neutral' | 'critical';
  priority: number;
  data: any;
  is_dismissed: boolean;
  dismissed_at: string | null;
  generated_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export async function generateInsights(userId: string, forceRefresh: boolean = false): Promise<Insight[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-insights`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        user_id: userId,
        force_refresh: forceRefresh
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate insights');
  }

  const result = await response.json();
  return result.insights || [];
}

export async function getActiveInsights(userId: string): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('user_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .gt('expires_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }

  return data || [];
}

export async function dismissInsight(insightId: string): Promise<void> {
  const { error } = await supabase
    .from('user_insights')
    .update({
      is_dismissed: true,
      dismissed_at: new Date().toISOString()
    })
    .eq('id', insightId);

  if (error) {
    console.error('Error dismissing insight:', error);
    throw error;
  }
}

export async function refreshInsights(userId: string): Promise<Insight[]> {
  return generateInsights(userId, true);
}

export function getInsightIcon(type: string): string {
  const iconMap: Record<string, string> = {
    performance: 'Award',
    risk: 'AlertTriangle',
    opportunity: 'Zap',
    pattern: 'Activity',
    discipline: 'CheckCircle2',
    psychology: 'Brain',
    consistency: 'Target'
  };
  return iconMap[type] || 'Info';
}

export function getInsightColor(category: string): string {
  const colorMap: Record<string, string> = {
    positive: 'text-blue-400',
    warning: 'text-yellow-400',
    neutral: 'text-gray-400',
    critical: 'text-red-400'
  };
  return colorMap[category] || 'text-gray-400';
}
