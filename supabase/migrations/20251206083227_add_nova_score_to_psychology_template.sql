/*
  # Add Nova Score to Psychology Template

  ## Overview
  Updates the psychology template structure to include Nova AI scoring
  in the end_of_day_summary section.

  ## Changes
  - Updates documentation for `journal_entries.template_data` to include nova_score
  - Nova Score is calculated based on:
    - Mood rating (1-10)
    - Decision quality score (1-10)
    - Psychological state (excellent/moderate/challenging)
    - Positive vs negative emotions ratio
  - Score ranges from 0-100, stored in end_of_day_summary.nova_score

  ## Psychology Template Updated Structure
  The template_data JSONB field now includes:
  - `end_of_day_summary`: {
      - `overall_notes`: string
      - `psychological_state`: 'excellent' | 'moderate' | 'challenging'
      - `key_wins`: string
      - `key_challenges`: string
      - `mental_state_reflection`: string
      - `nova_score`: number (0-100) - AI-calculated psychology score
    }

  ## Nova AI Integration
  - Nova AI can now query psychology journal data for continuous reflection
  - All psychology template data is accessible via journal_entries.template_data
  - Nova uses this data to provide personalized support and identify patterns
  
  ## Security
  - No changes to RLS policies (inherits from existing journal_entries policies)
*/

-- Update the comment on template_data column to include nova_score
COMMENT ON COLUMN journal_entries.template_data IS 
'Stores structured template-specific data. 
For psychology template includes: 
- pre_trade_mindset (mood_rating, external_factors, intention)
- emotional_checkin (emotions[], notes)
- post_trade_reflection (strongest_emotion, emotion_handling, lessons_learned, improvements)
- affirmations[]
- psychological_wins[]
- trigger_tracking[] (trigger, response, better_response)
- stress_levels (morning, midday, evening)
- decision_quality_score (1-10)
- cognitive_distortions[]
- end_of_day_summary (overall_notes, psychological_state, key_wins, key_challenges, mental_state_reflection, nova_score)
All data accessible by Nova AI for continuous psychological support.';
