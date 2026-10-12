import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDataSync } from '../../lib/dataSync';
import { trackEvent } from '../../lib/productAnalytics';
import { journaledDays, MILESTONES, type Milestone } from '../../services/goalProgress';
import GoalCelebration from './GoalCelebration';

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

  A trading day with at least one entry the trader actually filled in - one
  a day at most, so it cannot be finished in an afternoon - from the day the
  goal was set. A day off the charts is never a "missed" day, so there is no
  broken streak to punish anybody with: a trader told they lost their
  streak on a day they correctly stayed out of the market is being taught
  the wrong lesson. Synced and imported trades never count on their own -
  see goalProgress.ts for what "filled in" means and why.

  THE LADDER

  The card counts toward the goal they picked in onboarding (7, 14, 30 or
  66) and steps aside once it is reached, leaving "Your process" as the
  everyday tracker. Every milestone on the way - 7, 14, 30, 66 - is
  celebrated on the first dashboard visit after reaching it
  (GoalCelebration), once each.

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

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface State {
  userId: string;
  target: number;
  /* What they picked in onboarding - 30 or 66 can be more than the card counts to. */
  picked: number;
  profile: Record<string, string>;
  minutes: number | null;
  done: number;
  today: boolean;
}

/* Milestones already celebrated, kept in the profile so each is shown once. */
function celebratedOf(profile: Record<string, string>): number[] {
  return (profile.celebrated_milestones ?? '').split(',').map(Number).filter(Boolean);
}

export default function GoalCounter() {
  const navigate = useNavigate();
  const { refreshTrigger } = useDataSync(['journal_entries']);
  const [state, setState] = useState<State | null>(null);
  const [celebrating, setCelebrating] = useState<Milestone | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [justHidden, setJustHidden] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row } = await supabase
      .from('user_profiles')
      .select('onboarding_profile, onboarding_completed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    /* No goal set - every account from before the new onboarding. Nothing shows. */
    const profile = (row?.onboarding_profile ?? {}) as Record<string, string>;
    /*
      Capped at 14 on the dashboard (Brandon): a 30- or 66-day counter would
      sit there for months. Past 14 the card is gone and the milestone
      popups carry on at 30 and 66.
    */
    const target = Math.min(Number(profile.commit_days) || 0, 14);
    if (!target) {
      setState(null);
      return;
    }

    const started = profile.goal_started_at ?? (row?.onboarding_completed_at ? localDate(new Date(row.onboarding_completed_at)) : localDate(new Date()));
    const days = await journaledDays(user.id, started);
    const done = days.size;

    setState({
      userId: user.id,
      target,
      picked: Number(profile.commit_days),
      profile,
      minutes: profile.daily_minutes ? Number(profile.daily_minutes) : null,
      done,
      today: days.has(localDate(new Date())),
    });

    /* The highest milestone reached and not yet celebrated - one popup, never a queue of them. */
    const seen = celebratedOf(profile);
    const due = [...MILESTONES].reverse().find((m) => done >= m && !seen.includes(m));
    if (due) {
      setCelebrating(due);
      setCelebrationOpen(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshTrigger]);

  if (!state) return null;

  const { target, picked, done, today, minutes, profile } = state;
  const why = GOAL_PHRASE[profile.goal ?? ''];

  /*
    Hidden for good if they would rather not have it (Brandon). Only the
    card: the milestone popups are rare enough to stay.
  */
  const setHidden = async (hidden: boolean) => {
    const next = { ...profile };
    if (hidden) next.goal_card_hidden = '1';
    else delete next.goal_card_hidden;
    setState({ ...state, profile: next });
    setJustHidden(hidden);
    trackEvent(hidden ? 'goal_card_hidden' : 'goal_card_shown', { done, target, from: 'dashboard' });
    await supabase.from('user_profiles').update({ onboarding_profile: next }).eq('user_id', state.userId);
  };

  const closeCelebration = async () => {
    const reached = celebrating;
    setCelebrationOpen(false);
    if (!reached) return;
    /* Everything up to here counts as seen, so a skipped-over milestone never pops up late. */
    const seen = new Set([...celebratedOf(profile), ...MILESTONES.filter((m) => m <= reached)]);
    const next = { ...profile, celebrated_milestones: [...seen].sort((a, b) => a - b).join(',') };
    setState({ ...state, profile: next });
    trackEvent('goal_milestone_celebrated', { days: reached });
    await supabase.from('user_profiles').update({ onboarding_profile: next }).eq('user_id', state.userId);
  };

  return (
    <>
      {done < target && !profile.goal_card_hidden && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-400">Your goal</p>
              <p className="mt-1 text-[15px] sm:text-[16px] font-medium text-white">Journal {target} trading days</p>
              {/* A 30- or 66-day goal: the card counts the first 14, and says so. */}
              {picked > target && (
                <p className="mt-0.5 text-[13px] text-gray-400">First stop on your {picked}-day goal</p>
              )}
              {why && <p className="mt-0.5 text-[13px] text-gray-400">Working toward {why}</p>}
            </div>
            <p className="flex-shrink-0 text-[22px] sm:text-[26px] font-semibold tabular-nums text-white leading-none">
              {done}
              <span className="text-[13px] font-normal text-gray-500"> / {target}</span>
            </p>
            <button
              type="button"
              onClick={() => void setHidden(true)}
              aria-label="Hide goal"
              title="Hide"
              className="flex-shrink-0 -mr-1.5 -mt-1.5 p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* One segment a day up to 30; 66 would make slivers, so it is a bar. */}
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
            {today ? (
              <p className="flex items-center gap-1.5 text-[13px] text-gray-300">
                <Check className="w-4 h-4 text-blue-400" strokeWidth={2.5} />
                Today&rsquo;s done.
              </p>
            ) : (
              <>
                {/* Never "today's not logged" - no trade is fine, and the goal must not push anybody to trade. */}
                <p className="text-[13px] text-gray-400">
                  Next time you trade, journal it{minutes ? ` — your ${minutes} minutes` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/journal')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[12.5px] font-medium border border-blue-400/30 transition-colors"
                >
                  Open journal
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Right after hiding: where it went, and a way back without hunting for it. */}
      {justHidden && profile.goal_card_hidden && (
        <p className="text-[12.5px] text-gray-500">
          Goal hidden. You can bring it back in Settings &rsaquo; Preferences.{' '}
          <button type="button" onClick={() => void setHidden(false)} className="text-blue-400 hover:text-blue-300">
            Undo
          </button>
        </p>
      )}

      {celebrating && (
        <GoalCelebration milestone={celebrating} open={celebrationOpen} onClose={() => void closeCelebration()} />
      )}
    </>
  );
}
