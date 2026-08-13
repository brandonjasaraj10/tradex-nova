/*
  # Update Psychology Folder Color

  ## Overview
  Updates the color of the Psychology folder from purple to blue for consistency.
  
  ## Changes
  
  ### Updates to `journal_folders` table
  - Changes color from '#8B5CF6' (purple) to '#3B82F6' (blue) for all Psychology folders
  
  ## Notes
  - Only affects folders with template_type = 'psychology'
  - Provides visual consistency with the updated default folder colors
  
  ## Security
  - No changes to RLS policies needed
*/

-- Update psychology folder color to blue
UPDATE journal_folders
SET color = '#3B82F6'
WHERE template_type = 'psychology' AND color = '#8B5CF6';