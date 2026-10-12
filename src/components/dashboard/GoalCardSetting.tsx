import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/productAnalytics';

/*
  Settings > Preferences: show or hide the journaling goal on the dashboard.

  The card has its own hide button; this is the way back. Only shown to
  somebody who has a goal at all (set in onboarding) - for everybody else
  there is nothing to show or hide.
*/
export default function GoalCardSetting() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('user_profiles').select('onboarding_profile').eq('user_id', user.id).maybeSingle();
      const p = (data?.onboarding_profile ?? {}) as Record<string, string>;
      if (!Number(p.commit_days)) return;
      setUserId(user.id);
      setProfile(p);
    })();
  }, []);

  if (!userId || !profile) return null;
  const shown = !profile.goal_card_hidden;

  const toggle = async () => {
    setSaving(true);
    const next = { ...profile };
    if (shown) next.goal_card_hidden = '1';
    else delete next.goal_card_hidden;
    const { error } = await supabase.from('user_profiles').update({ onboarding_profile: next }).eq('user_id', userId);
    if (!error) {
      setProfile(next);
      trackEvent(shown ? 'goal_card_hidden' : 'goal_card_shown', { from: 'settings' });
    }
    setSaving(false);
  };

  return (
    <div className="mt-10 pt-8 border-t border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white mb-1">Journaling goal</h3>
          <p className="text-sm text-gray-400">
            The goal counter at the top of your dashboard. Hiding it doesn&rsquo;t change your goal &mdash;
            your journaled days still count.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={shown}
          aria-label="Show the journaling goal on the dashboard"
          disabled={saving}
          onClick={() => void toggle()}
          className={`relative flex-shrink-0 mt-1 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
            shown ? 'bg-brand-blue' : 'bg-white/15'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              shown ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}
