import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Brain, Heart, Target, TrendingUp, Zap, AlertCircle, Award, Smile, Frown, Meh, X, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { AnimatePresence, motion } from 'framer-motion';

interface PsychologyTemplateData {
  pre_trade_mindset?: {
    mood_rating?: number;
    external_factors?: string;
    intention?: string;
  };
  emotional_checkin?: {
    emotions?: string[];
    notes?: string;
  };
  post_trade_reflection?: {
    strongest_emotion?: string;
    emotion_handling?: string;
    lessons_learned?: string;
    improvements?: string;
  };
  affirmations?: string[];
  psychological_wins?: string[];
  trigger_tracking?: Array<{
    trigger: string;
    response: string;
    better_response: string;
  }>;
  stress_levels?: {
    morning?: number;
    midday?: number;
    evening?: number;
  };
  decision_quality_score?: number;
  cognitive_distortions?: string[];
  end_of_day_summary?: {
    overall_notes?: string;
    psychological_state?: 'excellent' | 'moderate' | 'challenging';
    key_wins?: string;
    key_challenges?: string;
    mental_state_reflection?: string;
    nova_score?: number;
  };
}

interface PsychologyTemplateProps {
  data: PsychologyTemplateData;
  onChange: (data: PsychologyTemplateData) => void;
}

const EMOTION_OPTIONS = [
  'Confident', 'Anxious', 'Excited', 'Fearful', 'Calm', 'Frustrated',
  'Focused', 'Distracted', 'Overwhelmed', 'Patient', 'Impatient', 'Greedy',
  'Disciplined', 'FOMO', 'Revenge Trading', 'Peaceful', 'Stressed', 'Optimistic'
];

const COGNITIVE_DISTORTIONS = [
  'All-or-Nothing Thinking',
  'Overgeneralization',
  'Mental Filter',
  'Discounting the Positive',
  'Jumping to Conclusions',
  'Catastrophizing',
  'Emotional Reasoning',
  'Should Statements',
  'Labeling',
  'Personalization'
];

const DEFAULT_AFFIRMATIONS = [
  "I trust my process and remain calm under pressure.",
  "Each trade is a learning opportunity, and I grow more confident every day.",
  "I am disciplined and patient with my trading decisions.",
  "My worth is not determined by a single trade outcome.",
  "I follow my rules and protect my capital above all else.",
];

export function PsychologyTemplate({ data, onChange }: PsychologyTemplateProps) {
  const [newEmotion, setNewEmotion] = useState('');
  const [newAffirmation, setNewAffirmation] = useState('');
  const [newPsychWin, setNewPsychWin] = useState('');
  const [newDistortion, setNewDistortion] = useState('');
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ trigger: '', response: '', better_response: '' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [templateMode, setTemplateMode] = useState<'simple' | 'advanced'>('simple');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const updateData = (path: string[], value: any) => {
    const newData = JSON.parse(JSON.stringify(data || {})); // Deep clone to ensure new references
    let current: any = newData;

    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }

    current[path[path.length - 1]] = value;
    onChange(newData);
  };

  const getMoodEmoji = (rating: number) => {
    if (rating <= 3) return <Frown className="text-blue-300" size={24} />;
    if (rating <= 6) return <Meh className="text-blue-400" size={24} />;
    return <Smile className="text-blue-500" size={24} />;
  };

  const addEmotion = (emotion: string) => {
    const emotions = data.emotional_checkin?.emotions || [];
    if (!emotions.includes(emotion)) {
      updateData(['emotional_checkin', 'emotions'], [...emotions, emotion]);
      setNewEmotion('');
    }
  };

  const removeEmotion = (emotion: string) => {
    const emotions = data.emotional_checkin?.emotions || [];
    updateData(['emotional_checkin', 'emotions'], emotions.filter(e => e !== emotion));
  };

  const addAffirmation = () => {
    if (newAffirmation.trim()) {
      const affirmations = data.affirmations || [];
      updateData(['affirmations'], [...affirmations, newAffirmation.trim()]);
      setNewAffirmation('');
    }
  };

  const removeAffirmation = (index: number) => {
    const affirmations = data.affirmations || [];
    updateData(['affirmations'], affirmations.filter((_, i) => i !== index));
  };

  const addPsychWin = () => {
    if (newPsychWin.trim()) {
      const wins = data.psychological_wins || [];
      updateData(['psychological_wins'], [...wins, newPsychWin.trim()]);
      setNewPsychWin('');
    }
  };

  const removePsychWin = (index: number) => {
    const wins = data.psychological_wins || [];
    updateData(['psychological_wins'], wins.filter((_, i) => i !== index));
  };

  const addDistortion = (distortion: string) => {
    const distortions = data.cognitive_distortions || [];
    if (!distortions.includes(distortion)) {
      updateData(['cognitive_distortions'], [...distortions, distortion]);
    }
  };

  const removeDistortion = (distortion: string) => {
    const distortions = data.cognitive_distortions || [];
    updateData(['cognitive_distortions'], distortions.filter(d => d !== distortion));
  };

  const addTrigger = () => {
    if (triggerForm.trigger && triggerForm.response) {
      const triggers = data.trigger_tracking || [];
      updateData(['trigger_tracking'], [...triggers, triggerForm]);
      setTriggerForm({ trigger: '', response: '', better_response: '' });
      setShowTriggerForm(false);
    }
  };

  const removeTrigger = (index: number) => {
    const triggers = data.trigger_tracking || [];
    updateData(['trigger_tracking'], triggers.filter((_, i) => i !== index));
  };

  // Calculate score for Simple mode
  const calculateSimpleScore = (): number | null => {
    let totalScore = 0;
    let weightFilled = 0;
    let fieldsFilled = 0;
    const TOTAL_FIELDS = 4;

    // 1. Pre-trade mood (0-10) → convert to 0-100 scale (25% weight)
    if (data.pre_trade_mindset?.mood_rating !== undefined) {
      totalScore += data.pre_trade_mindset.mood_rating * 10 * 0.25;
      weightFilled += 0.25;
      fieldsFilled += 1;
    }

    // 2. Emotional check-in (25% weight)
    const emotions = data.emotional_checkin?.emotions || [];
    if (emotions.length > 0) {
      const positiveEmotions = emotions.filter(e =>
        ['Confident', 'Calm', 'Focused', 'Patient', 'Disciplined', 'Peaceful', 'Optimistic'].includes(e)
      ).length;
      const emotionScore = (positiveEmotions / emotions.length) * 100;
      totalScore += emotionScore * 0.25;
      weightFilled += 0.25;
      fieldsFilled += 1;
    }

    // 3. Psychological state (35% weight)
    if (data.end_of_day_summary?.psychological_state) {
      const stateScore = data.end_of_day_summary.psychological_state === 'excellent' ? 100 :
                        data.end_of_day_summary.psychological_state === 'moderate' ? 60 : 30;
      totalScore += stateScore * 0.35;
      weightFilled += 0.35;
      fieldsFilled += 1;
    }

    // 4. Reflection completeness (15% weight)
    if (data.end_of_day_summary?.mental_state_reflection && data.end_of_day_summary.mental_state_reflection.length > 20) {
      totalScore += 100 * 0.15;
      weightFilled += 0.15;
      fieldsFilled += 1;
    }

    // Show a score once at least half the fields are filled, regardless of
    // which ones - previously this gated on the filled fields' combined
    // *weight* being >= 50%, but Psychological State alone is worth 35%,
    // so two equally "half filled out" users could land on opposite sides
    // of the threshold depending on which two fields they picked (e.g.
    // mood + reflection = 40%, blocked; mood + emotions = 50%, allowed).
    if (fieldsFilled >= Math.ceil(TOTAL_FIELDS / 2) && weightFilled > 0) {
      return Math.round(totalScore / weightFilled);
    }
    return null;
  };

  // Calculate score for Advanced mode
  const calculateAdvancedScore = (): number | null => {
    let totalScore = 0;
    let weightFilled = 0;
    let fieldsFilled = 0;
    const TOTAL_FIELDS = 7;

    // 1. Pre-trade mood (15% weight)
    if (data.pre_trade_mindset?.mood_rating !== undefined) {
      totalScore += data.pre_trade_mindset.mood_rating * 10 * 0.15;
      weightFilled += 0.15;
      fieldsFilled += 1;
    }

    // 2. Decision quality score (15% weight)
    if (data.decision_quality_score !== undefined) {
      totalScore += data.decision_quality_score * 10 * 0.15;
      weightFilled += 0.15;
      fieldsFilled += 1;
    }

    // 3. Stress management (15% weight)
    const stressLevels = data.stress_levels;
    if (stressLevels && (stressLevels.morning || stressLevels.midday || stressLevels.evening)) {
      const levels = [stressLevels.morning, stressLevels.midday, stressLevels.evening].filter(l => l !== undefined) as number[];
      const avgStress = levels.reduce((a, b) => a + b, 0) / levels.length;
      // Lower stress is better, so invert the score
      const stressScore = (10 - avgStress) * 10;
      totalScore += stressScore * 0.15;
      weightFilled += 0.15;
      fieldsFilled += 1;
    }

    // 4. Emotional check-in (15% weight)
    const emotions = data.emotional_checkin?.emotions || [];
    if (emotions.length > 0) {
      const positiveEmotions = emotions.filter(e =>
        ['Confident', 'Calm', 'Focused', 'Patient', 'Disciplined', 'Peaceful', 'Optimistic'].includes(e)
      ).length;
      const emotionScore = (positiveEmotions / emotions.length) * 100;
      totalScore += emotionScore * 0.15;
      weightFilled += 0.15;
      fieldsFilled += 1;
    }

    // 5. Cognitive distortions (10% weight) - fewer is better. An empty list
    // here is itself a meaningful, complete answer ("no distortions today"),
    // so it always counts as filled, same as it always contributing weight.
    const distortions = data.cognitive_distortions || [];
    if (distortions.length === 0) {
      totalScore += 100 * 0.10;
    } else {
      // Score decreases with more distortions (cap at 10)
      const distortionScore = Math.max(0, (10 - Math.min(distortions.length, 10)) * 10);
      totalScore += distortionScore * 0.10;
    }
    weightFilled += 0.10;
    fieldsFilled += 1;

    // 6. Trigger tracking (10% weight) - having better responses is good
    const triggers = data.trigger_tracking || [];
    if (triggers.length > 0) {
      const triggersWithBetterResponse = triggers.filter(t => t.better_response && t.better_response.length > 10).length;
      const triggerScore = (triggersWithBetterResponse / triggers.length) * 100;
      totalScore += triggerScore * 0.10;
      weightFilled += 0.10;
      fieldsFilled += 1;
    }

    // 7. Psychological state (20% weight)
    if (data.end_of_day_summary?.psychological_state) {
      const stateScore = data.end_of_day_summary.psychological_state === 'excellent' ? 100 :
                        data.end_of_day_summary.psychological_state === 'moderate' ? 60 : 30;
      totalScore += stateScore * 0.20;
      weightFilled += 0.20;
      fieldsFilled += 1;
    }

    // Show a score once at least half the fields are filled, regardless of
    // which ones - see the same fix in calculateSimpleScore() above for why
    // gating on combined *weight* instead of a field *count* was wrong.
    if (fieldsFilled >= Math.ceil(TOTAL_FIELDS / 2) && weightFilled > 0) {
      return Math.round(totalScore / weightFilled);
    }
    return null;
  };

  // Auto-calculate score whenever data changes
  useEffect(() => {
    const score = templateMode === 'simple' ? calculateSimpleScore() : calculateAdvancedScore();
    if (score !== null && score !== data.end_of_day_summary?.nova_score) {
      updateData(['end_of_day_summary', 'nova_score'], score);
    }
  }, [data, templateMode]);

  const headerSection = (
    <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Brain className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Trading Psychology Journal</h2>
            <p className="text-sm text-gray-400">Track your mental and emotional journey</p>
          </div>
        </div>
        {/*
          Wraps, and the two mode buttons narrow on a phone. Simple, Advanced
          and the fullscreen control came to 8px more than the header could
          hold, so the row hung over its own panel edge.
        */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setTemplateMode('simple')}
              className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${
                templateMode === 'simple'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setTemplateMode('advanced')}
              className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${
                templateMode === 'advanced'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Advanced
            </button>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
              isFullscreen
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={18} />
                <span className="text-sm font-medium">Exit (ESC)</span>
              </>
            ) : (
              <>
                <Maximize2 size={18} />
                <span className="text-sm font-medium hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const simpleTemplate = (
    <>
      {headerSection}

      {/* Simple Pre-Trade Mindset */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Pre-Trade Mindset</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Current Mood (1-10)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={data.pre_trade_mindset?.mood_rating || 5}
                onChange={(e) => updateData(['pre_trade_mindset', 'mood_rating'], parseInt(e.target.value))}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <div className="flex items-center gap-2 min-w-[60px]">
                {getMoodEmoji(data.pre_trade_mindset?.mood_rating || 5)}
                <span className="text-2xl font-bold text-white">
                  {data.pre_trade_mindset?.mood_rating || 5}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Today's Intention
            </label>
            <input
              type="text"
              value={data.pre_trade_mindset?.intention || ''}
              onChange={(e) => updateData(['pre_trade_mindset', 'intention'], e.target.value)}
              placeholder="e.g., I will stay calm and stick to my plan"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Simple Emotional Check-in */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Emotional Check-In</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              How are you feeling?
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOTION_OPTIONS.slice(0, 12).map((emotion) => (
                <button
                  key={emotion}
                  onClick={() => {
                    const emotions = data.emotional_checkin?.emotions || [];
                    if (emotions.includes(emotion)) {
                      removeEmotion(emotion);
                    } else {
                      addEmotion(emotion);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    (data.emotional_checkin?.emotions || []).includes(emotion)
                      ? 'bg-blue-400/20 text-blue-400 border border-blue-400/40'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={data.emotional_checkin?.notes || ''}
              onChange={(e) => updateData(['emotional_checkin', 'notes'], e.target.value)}
              placeholder="Quick notes on your emotional state..."
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* End-of-Day Summary with Nova Score */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">End-of-Day Summary</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Overall Psychological State
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateData(['end_of_day_summary', 'psychological_state'], 'excellent')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  data.end_of_day_summary?.psychological_state === 'excellent'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-white/10 hover:border-blue-400/40 bg-white/5'
                }`}
              >
                <Smile size={28} className={`mx-auto mb-2 ${
                  data.end_of_day_summary?.psychological_state === 'excellent'
                    ? 'text-blue-500'
                    : 'text-gray-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  data.end_of_day_summary?.psychological_state === 'excellent'
                    ? 'text-blue-500'
                    : 'text-gray-400'
                }`}>
                  Excellent
                </p>
              </button>

              <button
                onClick={() => updateData(['end_of_day_summary', 'psychological_state'], 'moderate')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  data.end_of_day_summary?.psychological_state === 'moderate'
                    ? 'border-blue-400 bg-blue-400/20'
                    : 'border-white/10 hover:border-blue-400/40 bg-white/5'
                }`}
              >
                <Meh size={28} className={`mx-auto mb-2 ${
                  data.end_of_day_summary?.psychological_state === 'moderate'
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  data.end_of_day_summary?.psychological_state === 'moderate'
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`}>
                  Moderate
                </p>
              </button>

              <button
                onClick={() => updateData(['end_of_day_summary', 'psychological_state'], 'challenging')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  data.end_of_day_summary?.psychological_state === 'challenging'
                    ? 'border-blue-300 bg-blue-300/20'
                    : 'border-white/10 hover:border-blue-400/40 bg-white/5'
                }`}
              >
                <Frown size={28} className={`mx-auto mb-2 ${
                  data.end_of_day_summary?.psychological_state === 'challenging'
                    ? 'text-blue-300'
                    : 'text-gray-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  data.end_of_day_summary?.psychological_state === 'challenging'
                    ? 'text-blue-300'
                    : 'text-gray-400'
                }`}>
                  Challenging
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Reflection & Lessons Learned
            </label>
            <textarea
              value={data.end_of_day_summary?.mental_state_reflection || ''}
              onChange={(e) => updateData(['end_of_day_summary', 'mental_state_reflection'], e.target.value)}
              placeholder="Reflect on your mental state and what you learned today..."
              rows={4}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>

          {/* Nova Score Section */}
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-blue-400" size={20} />
                <h4 className="text-sm font-semibold text-white">Nova Psychology Score</h4>
              </div>
              <span className="text-xs text-gray-400 italic">Auto-calculated</span>
            </div>

            {data.end_of_day_summary?.nova_score !== undefined ? (
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${
                  data.end_of_day_summary.nova_score >= 70 ? 'text-blue-500' :
                  data.end_of_day_summary.nova_score >= 50 ? 'text-blue-400' : 'text-blue-300'
                }`}>
                  {data.end_of_day_summary.nova_score}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-300 mb-1">
                    {data.end_of_day_summary.nova_score >= 70 ? 'Excellent psychological performance!' :
                     data.end_of_day_summary.nova_score >= 50 ? 'Good effort, room for improvement.' :
                     'Focus on emotional regulation tomorrow.'}
                  </p>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        data.end_of_day_summary.nova_score >= 70 ? 'bg-blue-500' :
                        data.end_of_day_summary.nova_score >= 50 ? 'bg-blue-400' : 'bg-blue-300'
                      }`}
                      style={{ width: `${data.end_of_day_summary.nova_score}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Fill out at least half of the sections above to see your score
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const advancedTemplate = (
    <>
      {headerSection}

      {/* Advanced Pre-Trade Mindset */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Pre-Trade Mindset Preparation</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Before you start trading today, take a moment to assess your mindset.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Current Mood Rating (1-10)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={data.pre_trade_mindset?.mood_rating || 5}
                onChange={(e) => updateData(['pre_trade_mindset', 'mood_rating'], parseInt(e.target.value))}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <div className="flex items-center gap-2 min-w-[60px]">
                {getMoodEmoji(data.pre_trade_mindset?.mood_rating || 5)}
                <span className="text-2xl font-bold text-white">
                  {data.pre_trade_mindset?.mood_rating || 5}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              External Factors Affecting Your Emotions
            </label>
            <input
              type="text"
              value={data.pre_trade_mindset?.external_factors || ''}
              onChange={(e) => updateData(['pre_trade_mindset', 'external_factors'], e.target.value)}
              placeholder="e.g., poor sleep, personal stress, good news..."
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Today's Intention
            </label>
            <input
              type="text"
              value={data.pre_trade_mindset?.intention || ''}
              onChange={(e) => updateData(['pre_trade_mindset', 'intention'], e.target.value)}
              placeholder="e.g., I will stay calm and stick to my plan"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Stress Level Tracking */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Stress Level Tracking</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Monitor your stress throughout the day to identify patterns.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['morning', 'midday', 'evening'].map((time) => (
            <div key={time}>
              <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                {time} Stress (1-10)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={data.stress_levels?.[time as keyof typeof data.stress_levels] || 5}
                  onChange={(e) => updateData(['stress_levels', time], parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Low</span>
                  <span className={`text-lg font-bold px-3 py-1 rounded-lg ${
                    (data.stress_levels?.[time as keyof typeof data.stress_levels] || 5) <= 3
                      ? 'bg-blue-500/20 text-blue-500'
                      : (data.stress_levels?.[time as keyof typeof data.stress_levels] || 5) <= 6
                      ? 'bg-blue-400/20 text-blue-400'
                      : 'bg-blue-300/20 text-blue-300'
                  }`}>
                    {data.stress_levels?.[time as keyof typeof data.stress_levels] || 5}
                  </span>
                  <span className="text-xs text-gray-400">High</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emotional Check-In */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Emotional Check-In During Trading</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Pause periodically to note how you're feeling. Are you experiencing FOMO, frustration, or overconfidence?
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Your Emotions
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {EMOTION_OPTIONS.map((emotion) => (
                <button
                  key={emotion}
                  onClick={() => {
                    const emotions = data.emotional_checkin?.emotions || [];
                    if (emotions.includes(emotion)) {
                      removeEmotion(emotion);
                    } else {
                      addEmotion(emotion);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    (data.emotional_checkin?.emotions || []).includes(emotion)
                      ? 'bg-blue-400/20 text-blue-400 border border-blue-400/40'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {emotion}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newEmotion}
                onChange={(e) => setNewEmotion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newEmotion.trim()) {
                    addEmotion(newEmotion.trim());
                  }
                }}
                placeholder="Add custom emotion..."
                className="flex-1 min-w-0 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
              />
              <button
                onClick={() => newEmotion.trim() && addEmotion(newEmotion.trim())}
                className="flex-shrink-0 px-3 sm:px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Emotional Notes
            </label>
            <textarea
              value={data.emotional_checkin?.notes || ''}
              onChange={(e) => updateData(['emotional_checkin', 'notes'], e.target.value)}
              placeholder="Describe how these emotions are influencing your decisions..."
              rows={4}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Cognitive Distortion Checker */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Cognitive Distortion Checker</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Identify thinking traps that might be affecting your trading decisions.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {COGNITIVE_DISTORTIONS.map((distortion) => (
              <button
                key={distortion}
                onClick={() => {
                  const distortions = data.cognitive_distortions || [];
                  if (distortions.includes(distortion)) {
                    removeDistortion(distortion);
                  } else {
                    addDistortion(distortion);
                  }
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  (data.cognitive_distortions || []).includes(distortion)
                    ? 'bg-blue-400/20 text-blue-400 border border-blue-400/40'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                }`}
              >
                {distortion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Post-Trade Reflection */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Post-Trade Reflection</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          After trading, reflect on your emotional experience.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Strongest Emotion During Trade
            </label>
            <input
              type="text"
              value={data.post_trade_reflection?.strongest_emotion || ''}
              onChange={(e) => updateData(['post_trade_reflection', 'strongest_emotion'], e.target.value)}
              placeholder="e.g., Anxiety when price moved against me"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              How Did You Handle It?
            </label>
            <textarea
              value={data.post_trade_reflection?.emotion_handling || ''}
              onChange={(e) => updateData(['post_trade_reflection', 'emotion_handling'], e.target.value)}
              placeholder="Describe how you managed this emotion..."
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Lessons Learned
            </label>
            <textarea
              value={data.post_trade_reflection?.lessons_learned || ''}
              onChange={(e) => updateData(['post_trade_reflection', 'lessons_learned'], e.target.value)}
              placeholder="What did you learn about yourself?"
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What Could You Improve?
            </label>
            <textarea
              value={data.post_trade_reflection?.improvements || ''}
              onChange={(e) => updateData(['post_trade_reflection', 'improvements'], e.target.value)}
              placeholder="Specific improvements for next time..."
              rows={3}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Decision Quality Score */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Decision Quality Self-Assessment</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Rate the quality of your decision-making today (independent of outcome).
        </p>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="10"
            value={data.decision_quality_score || 5}
            onChange={(e) => updateData(['decision_quality_score'], parseInt(e.target.value))}
            className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
          />
          <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${
            (data.decision_quality_score || 5) <= 3
              ? 'bg-blue-300/20 text-blue-300'
              : (data.decision_quality_score || 5) <= 7
              ? 'bg-blue-400/20 text-blue-400'
              : 'bg-blue-500/20 text-blue-500'
          }`}>
            {data.decision_quality_score || 5}/10
          </div>
        </div>
      </div>

      {/* Trigger Tracking */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Emotional Trigger Tracking</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Log situations that triggered strong emotional responses.
        </p>

        <div className="space-y-3">
          {(data.trigger_tracking || []).map((trigger, index) => (
            <div key={index} className="p-4 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white mb-1">Trigger: {trigger.trigger}</p>
                  <p className="text-xs text-gray-400 mb-1">Your Response: {trigger.response}</p>
                  {trigger.better_response && (
                    <p className="text-xs text-blue-400">Better Response: {trigger.better_response}</p>
                  )}
                </div>
                <button
                  onClick={() => removeTrigger(index)}
                  className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          {showTriggerForm ? (
            <div className="space-y-3 p-4 bg-white/5 border border-blue-400/20 rounded-lg">
              <input
                type="text"
                value={triggerForm.trigger}
                onChange={(e) => setTriggerForm({ ...triggerForm, trigger: e.target.value })}
                placeholder="What triggered you? (e.g., Price went against me)"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
              />
              <input
                type="text"
                value={triggerForm.response}
                onChange={(e) => setTriggerForm({ ...triggerForm, response: e.target.value })}
                placeholder="How did you respond?"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
              />
              <input
                type="text"
                value={triggerForm.better_response}
                onChange={(e) => setTriggerForm({ ...triggerForm, better_response: e.target.value })}
                placeholder="What would be a better response?"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={addTrigger}
                  className="flex-1 px-4 py-2 bg-blue-400/20 hover:bg-blue-400/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                >
                  Save Trigger
                </button>
                <button
                  onClick={() => {
                    setShowTriggerForm(false);
                    setTriggerForm({ trigger: '', response: '', better_response: '' });
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowTriggerForm(true)}
              className="w-full px-4 py-2.5 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
            >
              + Add New Trigger
            </button>
          )}
        </div>
      </div>

      {/* Psychological Wins */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Psychological Wins Today</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Celebrate moments when you demonstrated emotional control or discipline.
        </p>

        <div className="space-y-3">
          {(data.psychological_wins || []).map((win, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-blue-400/10 border border-blue-400/20 rounded-lg">
              <Award className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-white flex-1">{win}</p>
              <button
                onClick={() => removePsychWin(index)}
                className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <input
              type="text"
              value={newPsychWin}
              onChange={(e) => setNewPsychWin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPsychWin();
                }
              }}
              placeholder="Describe a psychological win..."
              className="flex-1 min-w-0 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
            />
            <button
              onClick={addPsychWin}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Affirmations */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Daily Affirmations & Mental Strength</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Select or create affirmations to reinforce positive trading psychology.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quick Add Affirmations
          </label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_AFFIRMATIONS.map((affirmation, index) => {
              const isAdded = (data.affirmations || []).includes(affirmation);
              return (
                <button
                  key={index}
                  onClick={() => {
                    if (!isAdded) {
                      const affirmations = data.affirmations || [];
                      updateData(['affirmations'], [...affirmations, affirmation]);
                    }
                  }}
                  disabled={isAdded}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isAdded
                      ? 'bg-blue-400/20 text-blue-400 border border-blue-400/40 cursor-not-allowed'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:border-blue-400/40'
                  }`}
                >
                  {isAdded ? '✓ ' : '+ '}{affirmation.substring(0, 50)}...
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {(data.affirmations || []).map((affirmation, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-blue-400/10 border border-blue-400/20 rounded-lg">
              <Zap className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-white flex-1 italic">"{affirmation}"</p>
              <button
                onClick={() => removeAffirmation(index)}
                className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <input
              type="text"
              value={newAffirmation}
              onChange={(e) => setNewAffirmation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAffirmation();
                }
              }}
              placeholder="Write your own affirmation..."
              className="flex-1 min-w-0 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
            />
            <button
              onClick={addAffirmation}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* End-of-Day Summary with Nova Score */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">End-of-Day Summary & Psychological Score</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Wrap up your day with a quick summary and rate your overall psychological state.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Overall Psychological State
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateData(['end_of_day_summary', 'psychological_state'], 'excellent')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  data.end_of_day_summary?.psychological_state === 'excellent'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-white/10 hover:border-blue-400/40 bg-white/5'
                }`}
              >
                <Smile size={28} className={`mx-auto mb-2 ${
                  data.end_of_day_summary?.psychological_state === 'excellent'
                    ? 'text-blue-500'
                    : 'text-gray-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  data.end_of_day_summary?.psychological_state === 'excellent'
                    ? 'text-blue-500'
                    : 'text-gray-400'
                }`}>
                  Excellent
                </p>
                <p className="text-xs text-gray-500 mt-1">Calm, disciplined, on-point</p>
              </button>

              <button
                onClick={() => updateData(['end_of_day_summary', 'psychological_state'], 'moderate')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  data.end_of_day_summary?.psychological_state === 'moderate'
                    ? 'border-blue-400 bg-blue-400/20'
                    : 'border-white/10 hover:border-blue-400/40 bg-white/5'
                }`}
              >
                <Meh size={28} className={`mx-auto mb-2 ${
                  data.end_of_day_summary?.psychological_state === 'moderate'
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  data.end_of_day_summary?.psychological_state === 'moderate'
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`}>
                  Moderate
                </p>
                <p className="text-xs text-gray-500 mt-1">Manageable, some challenges</p>
              </button>

              <button
                onClick={() => updateData(['end_of_day_summary', 'psychological_state'], 'challenging')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  data.end_of_day_summary?.psychological_state === 'challenging'
                    ? 'border-blue-300 bg-blue-300/20'
                    : 'border-white/10 hover:border-blue-400/40 bg-white/5'
                }`}
              >
                <Frown size={28} className={`mx-auto mb-2 ${
                  data.end_of_day_summary?.psychological_state === 'challenging'
                    ? 'text-blue-300'
                    : 'text-gray-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  data.end_of_day_summary?.psychological_state === 'challenging'
                    ? 'text-blue-300'
                    : 'text-gray-400'
                }`}>
                  Challenging
                </p>
                <p className="text-xs text-gray-500 mt-1">Difficult, needs attention</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Key Psychological Wins Today
              </label>
              <textarea
                value={data.end_of_day_summary?.key_wins || ''}
                onChange={(e) => updateData(['end_of_day_summary', 'key_wins'], e.target.value)}
                placeholder="What went well mentally/emotionally?"
                rows={3}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Key Challenges Today
              </label>
              <textarea
                value={data.end_of_day_summary?.key_challenges || ''}
                onChange={(e) => updateData(['end_of_day_summary', 'key_challenges'], e.target.value)}
                placeholder="What was difficult mentally/emotionally?"
                rows={3}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Overall Mental State Reflection
            </label>
            <textarea
              value={data.end_of_day_summary?.mental_state_reflection || ''}
              onChange={(e) => updateData(['end_of_day_summary', 'mental_state_reflection'], e.target.value)}
              placeholder="Reflect on your mental state and mindset evolution today..."
              rows={4}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
            />
          </div>

          {/* Nova Score Section */}
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-blue-400" size={20} />
                <h4 className="text-sm font-semibold text-white">Nova Psychology Score</h4>
              </div>
              <span className="text-xs text-gray-400 italic">Auto-calculated</span>
            </div>

            {data.end_of_day_summary?.nova_score !== undefined ? (
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${
                  data.end_of_day_summary.nova_score >= 70 ? 'text-blue-500' :
                  data.end_of_day_summary.nova_score >= 50 ? 'text-blue-400' : 'text-blue-300'
                }`}>
                  {data.end_of_day_summary.nova_score}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-300 mb-1">
                    {data.end_of_day_summary.nova_score >= 70 ? 'Excellent psychological performance! Nova has stored this data for continuous reflection.' :
                     data.end_of_day_summary.nova_score >= 50 ? 'Good effort, room for improvement. Nova will help you identify patterns.' :
                     'Focus on emotional regulation tomorrow. Nova is tracking your progress.'}
                  </p>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        data.end_of_day_summary.nova_score >= 70 ? 'bg-blue-500' :
                        data.end_of_day_summary.nova_score >= 50 ? 'bg-blue-400' : 'bg-blue-300'
                      }`}
                      style={{ width: `${data.end_of_day_summary.nova_score}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Fill out at least half of the sections above to see your score
              </p>
            )}
          </div>

          {data.end_of_day_summary?.psychological_state && (
            <div className={`p-4 rounded-lg border-2 ${
              data.end_of_day_summary.psychological_state === 'excellent'
                ? 'border-blue-500/40 bg-blue-500/10'
                : data.end_of_day_summary.psychological_state === 'moderate'
                ? 'border-blue-400/40 bg-blue-400/10'
                : 'border-blue-300/40 bg-blue-300/10'
            }`}>
              <div className="flex items-center gap-3">
                {data.end_of_day_summary.psychological_state === 'excellent' && (
                  <>
                    <Smile size={24} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-blue-500">Excellent psychological day!</p>
                      <p className="text-xs text-gray-400 mt-0.5">You maintained discipline and emotional balance. Keep this momentum!</p>
                    </div>
                  </>
                )}
                {data.end_of_day_summary.psychological_state === 'moderate' && (
                  <>
                    <Meh size={24} className="text-blue-400" />
                    <div>
                      <p className="text-sm font-semibold text-blue-400">Moderate psychological day</p>
                      <p className="text-xs text-gray-400 mt-0.5">You faced challenges but managed them. Review your notes for improvement opportunities.</p>
                    </div>
                  </>
                )}
                {data.end_of_day_summary.psychological_state === 'challenging' && (
                  <>
                    <Frown size={24} className="text-blue-300" />
                    <div>
                      <p className="text-sm font-semibold text-blue-300">Challenging psychological day</p>
                      <p className="text-xs text-gray-400 mt-0.5">Tomorrow is a new opportunity. Review your triggers and plan better responses.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const templateContent = templateMode === 'simple' ? simpleTemplate : advancedTemplate;

  return (
    <>
      {!isFullscreen ? (
        <div className="space-y-6">
          {templateContent}
        </div>
      ) : (
        createPortal(
          <AnimatePresence mode="wait">
            <motion.div
              key="fullscreen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[99999] bg-black overflow-y-auto"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsFullscreen(false);
                }
              }}
            >
              <div className="min-h-screen w-full p-4 sm:p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6 pb-12">
                  {templateContent}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      )}
    </>
  );
}
