/*
  # Fix create_default_folders() to create the right default folders

  ## Problem
  create_default_folders() (fired by create_default_folders_trigger
  AFTER INSERT ON user_profiles) was creating three leftover Bolt-era
  folders - "General", "Weekly Review", "Trade Reviews" - plus a
  "Notes" row in a separate notes_folders table the frontend never
  reads. This trigger previously failed silently for every signup
  (wrong column, fixed earlier today in migration
  20260813210423_fix_create_default_folders_trigger.sql) - fixing that
  bug is what made this wrong folder set start actually appearing for
  the first time, surfaced by testing against a real account today.

  The app's actual default folder model - confirmed by Journal.tsx's
  own DEFAULT_FOLDERS constant and by the 2026-03-16 migration
  ("cleanup_journal_folders_to_two_only") - is exactly two folders per
  user: "Daily Journal" (template_type 'default') and "Notes"
  (template_type 'notes', which the Journal page's own code -
  selectedFolder?.template_type === 'notes' - already renders as a
  plain text box). Both live in journal_folders; notes_folders is a
  dead table nothing in the app reads.

  ## Fix
  Rewrite the trigger function to create only those two folders,
  idempotently (checked by name, matching the pattern the March
  migration already used), and stop writing to notes_folders.

  ## Cleanup
  Backfill any user_profiles row missing either folder (covers
  everyone, in case other accounts hit this before it was caught), and
  remove the wrong three folders for the specific account that
  surfaced this bug today.
*/

CREATE OR REPLACE FUNCTION public.create_default_folders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM journal_folders WHERE user_id = NEW.user_id AND name = 'Daily Journal'
  ) THEN
    INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
    VALUES (NEW.user_id, 'Daily Journal', 'Daily trading reflections and general entries', 'Calendar', '#3B82F6', 0, 'default');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM journal_folders WHERE user_id = NEW.user_id AND name = 'Notes'
  ) THEN
    INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
    VALUES (NEW.user_id, 'Notes', 'General notes and documentation', 'file-text', '#3B82F6', 1, 'notes');
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT user_id FROM user_profiles LOOP
    IF NOT EXISTS (
      SELECT 1 FROM journal_folders WHERE user_id = profile_record.user_id AND name = 'Daily Journal'
    ) THEN
      INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
      VALUES (profile_record.user_id, 'Daily Journal', 'Daily trading reflections and general entries', 'Calendar', '#3B82F6', 0, 'default');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM journal_folders WHERE user_id = profile_record.user_id AND name = 'Notes'
    ) THEN
      INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
      VALUES (profile_record.user_id, 'Notes', 'General notes and documentation', 'file-text', '#3B82F6', 1, 'notes');
    END IF;
  END LOOP;
END;
$$;

DELETE FROM journal_folders WHERE name IN ('General', 'Weekly Review', 'Trade Reviews');
