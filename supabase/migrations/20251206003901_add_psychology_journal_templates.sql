/*
  # Add Psychology Journal Template Support

  ## Overview
  Extends the journal system to support specialized templates, starting with a Psychology template
  for traders to track their mental and emotional states during trading.

  ## Changes
  
  ### `journal_folders`
  - Add `template_type` (text) - The type of template ('default', 'psychology', 'trade')
  
  ### `journal_entries`
  - Add `template_data` (jsonb) - Stores structured template-specific data

  ## Psychology Template Structure
  The template_data JSONB field will store:
  - `pre_trade_mindset`: {
      - `mood_rating`: number (1-10)
      - `external_factors`: string
      - `intention`: string
    }
  - `emotional_checkin`: {
      - `emotions`: string[]
      - `notes`: string
    }
  - `post_trade_reflection`: {
      - `strongest_emotion`: string
      - `emotion_handling`: string
      - `lessons_learned`: string
      - `improvements`: string
    }
  - `affirmations`: string[]
  - `psychological_wins`: string[]
  - `trigger_tracking`: {
      - `trigger`: string
      - `response`: string
      - `better_response`: string
    }[]
  - `stress_levels`: {
      - `morning`: number (1-10)
      - `midday`: number (1-10)
      - `evening`: number (1-10)
    }
  - `decision_quality_score`: number (1-10)
  - `cognitive_distortions`: string[]

  ## Security
  - No changes to RLS policies needed (inherits from existing policies)
*/

-- Add template_type column to journal_folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_folders' AND column_name = 'template_type'
  ) THEN
    ALTER TABLE journal_folders ADD COLUMN template_type text DEFAULT 'default';
  END IF;
END $$;

-- Add template_data column to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'template_data'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN template_data jsonb DEFAULT '{}';
  END IF;
END $$;

-- Create an index on template_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_journal_folders_template_type ON journal_folders(template_type);

-- Add a comment to document the template_data structure
COMMENT ON COLUMN journal_entries.template_data IS 
'Stores structured template-specific data. For psychology template: pre_trade_mindset, emotional_checkin, post_trade_reflection, affirmations, psychological_wins, trigger_tracking, stress_levels, decision_quality_score, cognitive_distortions';
