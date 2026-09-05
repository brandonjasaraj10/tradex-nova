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

/*
  What the pre-trade checklist contributes to a day's psychology score.

  Same philosophy as the NOVA score's psychology slice, deliberately: score
  ENGAGEMENT (did you stop and answer before trading) and READINESS (what you
  rated your own state), never the answers themselves. Scoring the answers
  would mean admitting "I was not calm" lowers your number, and the quickest
  route to a better score becomes ticking yes without reading - which destroys
  the only thing the checklist exists to collect.

  Returns null when there is nothing to go on, so a day with no psychology
  work of any kind stays absent rather than being handed an invented 50.
*/
export function calculateChecklistScore(
  answeredChecks: number,
  ratings: Array<number | null | undefined>
): number | null {
  const given = ratings.filter((v): v is number => typeof v === 'number');

  // Answering at all is the whole of engagement for a single day: you either
  // stopped and went through the checklist or you did not.
  const engagement = answeredChecks > 0 ? 100 : null;

  // 1-5 mapped onto 0-100, so a flat 3 is the middle rather than a failure.
  const readiness = given.length > 0
    ? ((given.reduce((a, b) => a + b, 0) / given.length) - 1) / 4 * 100
    : null;

  if (engagement === null && readiness === null) return null;
  if (engagement === null) return readiness;
  if (readiness === null) return engagement;
  return engagement * 0.5 + readiness * 0.5;
}

/*
  The day's score, from whichever halves of the psychology work exist.

  The journal and the checklist weigh equally when both are filled. They ask
  different things - one is a written reflection, the other a pre-trade gate -
  and neither is a lesser form of the work.

  Either one alone still produces a score. Before this, a day where somebody
  worked through the checklist but skipped the journal scored nothing at all,
  which read as "you did no psychology work today" when they plainly had.
*/
export function combinePsychologyScores(
  templateScore: number | null,
  checklistScore: number | null
): number | null {
  if (templateScore === null && checklistScore === null) return null;
  if (templateScore === null) return Math.round(checklistScore as number);
  if (checklistScore === null) return Math.round(templateScore);
  return Math.round((templateScore + checklistScore) / 2);
}

export async function getPsychologyScores(
  timeFrame: TimeFrame = 'weekly'
): Promise<PsychologyScoreAggregates> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return getEmptyAggregates();
    }

    const dateFilter = getDateFilter(timeFrame);

    /*
      The template_data filter is gone on purpose. It excluded every entry
      where the journal was left empty - including days somebody worked
      through the checklist, which is exactly the case this now scores.
    */
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('id, entry_date, template_data, pre_trade_emotional_state, pre_trade_focus, pre_trade_confidence')
      .eq('user_id', user.id)
      .gte('entry_date', dateFilter)
      .order('entry_date', { ascending: false });

    if (error || !entries) {
      console.error('Error fetching psychology entries:', error);
      return getEmptyAggregates();
    }

    /*
      One query for every answered check across the window, rather than one
      per entry - these pages load a month at a time and per-entry lookups
      would be dozens of round trips for data this small.
    */
    const entryIds = entries.map(e => e.id as string);
    const answeredByEntry = new Map<string, number>();
    if (entryIds.length > 0) {
      const { data: checks } = await supabase
        .from('journal_entry_psychology_checks')
        .select('journal_entry_id, confirmed')
        .in('journal_entry_id', entryIds)
        // `confirmed` is the tri-state: true, false, or null for unanswered.
        // Both true and false count as answered - that is the whole point.
        .not('confirmed', 'is', null);

      for (const row of checks ?? []) {
        const id = (row as { journal_entry_id: string }).journal_entry_id;
        answeredByEntry.set(id, (answeredByEntry.get(id) ?? 0) + 1);
      }
    }

    const scores: PsychologyScoreData[] = entries
      .map(entry => {
        const templateData = entry.template_data as any;
        const rawTemplateScore = templateData?.end_of_day_summary?.nova_score;
        const templateScore = typeof rawTemplateScore === 'number' ? rawTemplateScore : null;

        const checklistScore = calculateChecklistScore(
          answeredByEntry.get(entry.id as string) ?? 0,
          [entry.pre_trade_emotional_state, entry.pre_trade_focus, entry.pre_trade_confidence]
        );

        const score = combinePsychologyScores(templateScore, checklistScore);
        if (score === null) {
          return null;
        }

        return {
          date: entry.entry_date,
          score,
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

// `.toISOString().split('T')[0]` gives the UTC date, not the local one -
// for anyone west of UTC (this app's users included) that silently shifts
// to tomorrow's date once it's evening locally. For 'daily' specifically
// that meant "Today" could filter for a date that hadn't happened yet
// locally, excluding the entry someone had just created for today and
// showing the empty "Track Your Psychology" state instead.
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDateFilter(timeFrame: TimeFrame): string {
  const now = new Date();

  switch (timeFrame) {
    case 'daily':
      return toLocalDateStr(now);

    case 'weekly':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return toLocalDateStr(weekAgo);

    case 'monthly':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return toLocalDateStr(monthAgo);

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
