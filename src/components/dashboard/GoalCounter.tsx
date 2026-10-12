import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDataSync } from '../../lib/dataSync';
import { trackEvent } from '../../lib/productAnalytics';

/*
  The goal they picked in onboarding, counted.

  WHY THIS EXISTS

  Onboarding ends by asking them to commit: so many minutes a trading day,
  for 7, 14, 30 or 66 days. Duolingo found that the act of choosing a goal
  is what lifts retention - but a promise nobody ever sees again is just a
  question they answered once. This is the streak, in TradeX's terms: the
  first thing on the dashboard says how far into their own goal they are and
  whether today is done.

  WHAT COUNTS

  A day counts when it has at least one journal entry, from the day the goal
  was set. Trading days, not calendar days - a weekend or a day off the
  charts is never a "missed" day, so there is no broken streak to punish
  anybody with. That matters for this audience: a trader told they "lost
  their streak" on a day they correctly stayed out of the market is being
  taught the wrong lesson.

  Read from onboarding_profile (commit_days, daily_minutes, goal), and
  goal_started_at once they choose a next goal. Hidden entirely for anybody
  who never set one - every account older than this feature.
*/

/*
  Framed as working TOWARD the outcome, never as the outcome. "Journal 7
  trading days to pass your challenge" read as if a week of journaling
  would pass it - Brandon flagged it as misleading. The journaling is the
  step; the challenge is where it leads.
*/
const GOAL_PHRASE: Record<string, string> = {
  profitable: 'becoming consistently profitable',
  pass_challenge: 'passing your challenge',
  stop_blowing: 'keeping your next account',
  consistent: 'trading the same way every day',
  understand: 'seeing why you do what you do',
};

const NEXT_GOALS = [30, 66];

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface State {
  userId: string;
  profile: Record<string, string>;
  target: number;
  minutes: number | null;
  done: number;
  today: boolean;
}

export default function GoalCounter() {
  const navigate = useNavigate();
  const { refreshTrigger } = useDataSync(['journal_entries']);
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row } = await supabase
      .from('user_profiles')
      .select('onboarding_profile, onboarding_completed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const profile = (row?.onboarding_profile ?? {}) as Record<string, string>;
    const target = Number(profile.commit_days);
    if (!target) {
      setState(null);
      return;
    }

    const started = profile.goal_started_at ?? (row?.onboarding_completed_at ? localDate(new Date(row.onboarding_completed_at)) : localDate(new Date()));

    const { data: entries } = await supabase
      .from('journal_entries')
      .select('entry_date')
      .eq('user_id', user.id)
      .eq('is_tour_demo', false)
      .gte('entry_date', started);

    const days = new Set((entries ?? []).map((e) => e.entry_date as string).filter(Boolean));
    setState({
      userId: user.id,
      profile,
      target,
      minutes: profile.daily_minutes ? Number(profile.daily_minutes) : null,
      done: days.size,
      today: days.has(localDate(new Date())),
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshTrigger]);

  if (!state) return null;

  const { target, done, today, minutes, profile } = state;
  const reached = done >= target;
  const why = GOAL_PHRASE[profile.goal ?? ''];

  const setNext = async (days: number) => {
    setSaving(true);
    const next = { ...profile, commit_days: String(days), goal_started_at: localDate(new Date()) };
    await supabase.from('user_profiles').update({ onboarding_profile: next }).eq('user_id', state.userId);
    trackEvent('goal_next_set', { days, previous: target });
    setSaving(false);
    void load();
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-400">Your goal</p>
          <p className="mt-1 text-[15px] sm:text-[16px] font-medium text-white">
            {reached ? `You hit ${target} days.` : `Journal ${target} trading days`}
          </p>
          {!reached && why && (
            <p className="mt-0.5 text-[13px] text-gray-400">Working toward {why}</p>
          )}
        </div>
        <p className="flex-shrink-0 text-[22px] sm:text-[26px] font-semibold tabular-nums text-white leading-none">
          {Math.min(done, target)}
          <span className="text-[13px] font-normal text-gray-500"> / {target}</span>
        </p>
      </div>

      {/*
        One segment a day up to 30, so a 7- or 14-day goal reads as a row of
        days to fill; a 66-day goal would make slivers, so it is a bar.
      */}
      {target <= 30 ? (
        <div className="mt-3.5 flex gap-1" aria-hidden="true">
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? 'bg-blue-400' : 'bg-white/10'}`} />
          ))}
        </div>
      ) : (
        <div className="mt-3.5 h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, (done / target) * 100)}%` }} />
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        {reached ? (
          <>
            <p className="text-[13px] text-gray-400">That is a habit forming. Set the next one?</p>
            <div className="flex gap-2">
              {NEXT_GOALS.filter((d) => d > target).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={saving}
                  onClick={() => void setNext(d)}
                  className="px-3 py-1.5 rounded-lg border border-blue-400/30 text-blue-400 text-[12.5px] hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                >
                  {d} days
                </button>
              ))}
            </div>
          </>
        ) : today ? (
          <p className="flex items-center gap-1.5 text-[13px] text-gray-300">
            <Check className="w-4 h-4 text-blue-400" strokeWidth={2.5} />
            Today&rsquo;s done.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-gray-400">
              Today&rsquo;s not logged yet{minutes ? ` — your ${minutes} minutes` : ''}.
            </p>
            <button
              type="button"
              onClick={() => navigate('/journal')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[12.5px] font-medium border border-blue-400/30 transition-colors"
            >
              Log today
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
