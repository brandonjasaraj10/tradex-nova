import { supabase } from '../lib/supabase';

export interface PsychologyScoreData {
  date: string;
  score: number;
  mood_rating?: number;
  psychological_state?: 'excellent' | 'moderate' | 'challenging';
  stress_avg?: number;
  decision_quality?: number;
}

export interface PsychologyScoreAggregates {
  average: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  highest: number;
  lowest: number;
  totalEntries: number;
  scores: PsychologyScoreData[];
}

export type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'all';

export async function getPsychologyScores(
  timeFrame: TimeFrame = 'weekly'
): Promise<PsychologyScoreAggregates> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return getEmptyAggregates();
    }

    const dateFilter = getDateFilter(timeFrame);

    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('entry_date, template_data')
      .eq('user_id', user.id)
      .not('template_data', 'is', null)
      .gte('entry_date', dateFilter)
      .order('entry_date', { ascending: false });

    if (error || !entries) {
      console.error('Error fetching psychology entries:', error);
      return getEmptyAggregates();
    }

    const scores: PsychologyScoreData[] = entries
      .map(entry => {
        const templateData = entry.template_data as any;
        const novaScore = templateData?.end_of_day_summary?.nova_score;

        if (novaScore === undefined || novaScore === null) {
          return null;
        }

        return {
          date: entry.entry_date,
          score: novaScore,
          mood_rating: templateData?.pre_trade_mindset?.mood_rating,
          psychological_state: templateData?.end_of_day_summary?.psychological_state,
          stress_avg: calculateStressAverage(templateData?.stress_levels),
          decision_quality: templateData?.decision_quality_score,
        };
      })
      .filter((score): score is PsychologyScoreData => score !== null);

    if (scores.length === 0) {
      return getEmptyAggregates();
    }

    const average = Math.round(
      scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    );

    const { trend, trendPercentage } = calculateTrend(scores);

    return {
      average,
      trend,
      trendPercentage,
      highest: Math.max(...scores.map(s => s.score)),
      lowest: Math.min(...scores.map(s => s.score)),
      totalEntries: scores.length,
      scores,
    };
  } catch (error) {
    console.error('Error in getPsychologyScores:', error);
    return getEmptyAggregates();
  }
}

function getDateFilter(timeFrame: TimeFrame): string {
  const now = new Date();

  switch (timeFrame) {
    case 'daily':
      return now.toISOString().split('T')[0];

    case 'weekly':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo.toISOString().split('T')[0];

    case 'monthly':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo.toISOString().split('T')[0];

    case 'all':
    default:
      return '2020-01-01';
  }
}

function calculateStressAverage(stressLevels?: {
  morning?: number;
  midday?: number;
  evening?: number;
}): number | undefined {
  if (!stressLevels) return undefined;

  const levels = [
    stressLevels.morning,
    stressLevels.midday,
    stressLevels.evening,
  ].filter((level): level is number => level !== undefined);

  if (levels.length === 0) return undefined;

  return Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length);
}

function calculateTrend(scores: PsychologyScoreData[]): {
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
} {
  if (scores.length < 2) {
    return { trend: 'stable', trendPercentage: 0 };
  }

  const halfwayPoint = Math.floor(scores.length / 2);
  const recentScores = scores.slice(0, halfwayPoint);
  const olderScores = scores.slice(halfwayPoint);

  const recentAvg =
    recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length;
  const olderAvg =
    olderScores.reduce((sum, s) => sum + s.score, 0) / olderScores.length;

  const difference = recentAvg - olderAvg;
  const percentageChange = Math.abs((difference / olderAvg) * 100);

  if (Math.abs(difference) < 2) {
    return { trend: 'stable', trendPercentage: 0 };
  }

  return {
    trend: difference > 0 ? 'up' : 'down',
    trendPercentage: Math.round(percentageChange),
  };
}

function getEmptyAggregates(): PsychologyScoreAggregates {
  return {
    average: 0,
    trend: 'stable',
    trendPercentage: 0,
    highest: 0,
    lowest: 0,
    totalEntries: 0,
    scores: [],
  };
}
