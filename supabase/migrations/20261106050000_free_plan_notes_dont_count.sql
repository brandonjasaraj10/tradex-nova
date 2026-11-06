/*
  Notes don't use up a free account's weekly entries. A note moved into a trade
  folder counts once at that point, otherwise writing every trade as a note and
  moving it would get around the limit.

  Still inert: to attach, BEFORE INSERT OR UPDATE OF folder_id ON journal_entries
  FOR EACH ROW, in the migration that opens the app to free users.
*/
CREATE OR REPLACE FUNCTION public.free_plan_enforce_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_window record;
  v_used integer;
BEGIN
  /* Sample rows from the product tour are not the trader's own entries. */
  IF NEW.is_tour_demo OR public.free_plan_user_is_paid(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.folder_id IS NOT DISTINCT FROM OLD.folder_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_folders f
    WHERE f.id = NEW.folder_id AND f.template_type = 'notes'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('free_plan:' || NEW.user_id::text, 0));

  /* Already counted: moving an entry between folders never charges twice. */
  IF EXISTS (
    SELECT 1 FROM public.free_plan_usage
    WHERE user_id = NEW.user_id AND kind = 'entry' AND ref = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_window FROM public.free_plan_window(NEW.user_id);

  SELECT count(*) INTO v_used FROM public.free_plan_usage
  WHERE user_id = NEW.user_id AND kind = 'entry' AND created_at >= v_window.window_start;

  IF v_used >= v_window.entry_limit THEN
    RAISE EXCEPTION 'free_plan_entry_limit';
  END IF;

  INSERT INTO public.free_plan_usage (user_id, kind, ref)
  VALUES (NEW.user_id, 'entry', NEW.id::text);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.free_plan_enforce_entry() FROM PUBLIC, anon, authenticated;
