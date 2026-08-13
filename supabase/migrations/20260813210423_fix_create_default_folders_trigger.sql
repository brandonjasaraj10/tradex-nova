/*
  # Fix create_default_folders() trigger for this database's actual schema

  ## Problem
  This trigger fires after a user_profiles row is inserted, creating
  the default journal/notes folders for that user. Two bugs, both
  found live by testing a real signup against this database:

  1. It used NEW.id - user_profiles' own auto-generated internal
     primary key - instead of NEW.user_id, the real auth.users id.
     journal_folders.user_id and notes_folders.user_id both have a
     foreign key to auth.users(id), so every signup failed here with
     a foreign key violation (right after the user_profiles RLS
     policy fix made profile creation itself start working).
  2. It tried to insert a template_type value into notes_folders,
     which has no such column on this database (only id, user_id,
     name, color, icon, created_at) - unlike journal_folders, which
     does have one.

  ## Fix
  Use NEW.user_id instead of NEW.id, and drop template_type from the
  notes_folders insert.
*/

CREATE OR REPLACE FUNCTION public.create_default_folders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO journal_folders (user_id, name, color, created_at)
VALUES
(NEW.user_id, 'General', 'blue', now()),
(NEW.user_id, 'Weekly Review', 'blue', now()),
(NEW.user_id, 'Trade Reviews', 'blue', now());

INSERT INTO notes_folders (user_id, name, color, created_at)
VALUES (NEW.user_id, 'Notes', 'blue', now());

RETURN NEW;
END;
$function$
