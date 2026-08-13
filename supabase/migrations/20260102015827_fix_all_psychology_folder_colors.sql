/*
  # Fix All Psychology Folder Colors

  ## Overview
  Updates all Psychology folders to blue color, regardless of their current color.
  
  ## Changes
  
  ### Updates to `journal_folders` table
  - Changes color to '#3B82F6' (blue) for ALL Psychology folders
  - Applies to all folders where template_type = 'psychology'
  
  ## Notes
  - This ensures consistency across all psychology folders, including custom named ones
  - Overrides any previous pink, purple, or other colors
  
  ## Security
  - No changes to RLS policies needed
*/

-- Update ALL psychology folders to blue, regardless of current color
UPDATE journal_folders
SET color = '#3B82F6'
WHERE template_type = 'psychology';