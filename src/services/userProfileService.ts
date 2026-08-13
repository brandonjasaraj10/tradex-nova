import { supabase } from '../lib/supabase';

export interface UserTradingProfile {
  id: string;
  user_id: string;
  preferred_markets: string[];
  trading_approach: 'scalping' | 'day_trading' | 'swing_trading' | 'position_trading';
  risk_tolerance: 'low' | 'medium' | 'high' | 'very_high';
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  typical_trade_duration: string;
  preferred_sessions: string[];
  trading_goals?: string;
  focus_areas: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ProfileCreationData {
  preferred_markets: string[];
  trading_approach: string;
  risk_tolerance: string;
  experience_level: string;
  typical_trade_duration: string;
  preferred_sessions: string[];
  trading_goals?: string;
  focus_areas: string[];
}

export class UserProfileService {
  async getUserProfile(userId: string): Promise<UserTradingProfile | null> {
    const { data, error } = await supabase
      .from('user_trading_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }

    return data;
  }

  async createOrUpdateProfile(userId: string, profileData: ProfileCreationData): Promise<UserTradingProfile> {
    const existingProfile = await this.getUserProfile(userId);

    if (existingProfile) {
      const { data, error } = await supabase
        .from('user_trading_profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }

      return data;
    } else {
      const { data, error } = await supabase
        .from('user_trading_profiles')
        .insert({
          user_id: userId,
          ...profileData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }

      return data;
    }
  }

  async hasProfile(userId: string): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    return profile !== null;
  }

  formatProfileForAI(profile: UserTradingProfile | null): string {
    if (!profile) {
      return 'No trading profile set yet.';
    }

    const approaches: Record<string, string> = {
      scalping: 'Scalper (quick in and out trades)',
      day_trading: 'Day Trader (intraday positions)',
      swing_trading: 'Swing Trader (multi-day positions)',
      position_trading: 'Position Trader (long-term positions)'
    };

    const riskLevels: Record<string, string> = {
      low: 'Conservative (low risk)',
      medium: 'Moderate (balanced risk)',
      high: 'Aggressive (high risk)',
      very_high: 'Very Aggressive (very high risk)'
    };

    const experience: Record<string, string> = {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      expert: 'Expert'
    };

    let summary = `Trading Profile:
- Experience: ${experience[profile.experience_level] || profile.experience_level}
- Style: ${approaches[profile.trading_approach] || profile.trading_approach}
- Risk Tolerance: ${riskLevels[profile.risk_tolerance] || profile.risk_tolerance}
- Typical Trade Duration: ${profile.typical_trade_duration}`;

    if (profile.preferred_markets && profile.preferred_markets.length > 0) {
      summary += `\n- Preferred Markets: ${profile.preferred_markets.join(', ')}`;
    }

    if (profile.preferred_sessions && profile.preferred_sessions.length > 0) {
      summary += `\n- Preferred Sessions: ${profile.preferred_sessions.join(', ')}`;
    }

    if (profile.focus_areas && profile.focus_areas.length > 0) {
      summary += `\n- Focus Areas: ${profile.focus_areas.join(', ')}`;
    }

    if (profile.trading_goals) {
      summary += `\n- Goals: ${profile.trading_goals}`;
    }

    return summary;
  }
}

export const userProfileService = new UserProfileService();
