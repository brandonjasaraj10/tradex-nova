/*
  Tag onboarding-tour demo rows in the database instead of only
  remembering their ids in browser memory.

  The tour seeds a handful of fake trades and one journal entry so a
  brand-new account isn't a wall of empty panels, then deletes them when
  the tour ends. Until now cleanup could only delete rows whose ids were
  held in a React ref - so if the page reloaded mid-tour (or the tab was
  closed), that ref was lost and the fake trades were orphaned in the
  user's real account permanently, silently polluting their P&L,
  win rate and calendar forever. Found exactly that on a live account:
  6 leftover demo trades from an interrupted tour.

  With a real column, cleanup can always find them by flag, and can also
  sweep up leftovers from any previous interrupted run.
*/

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS is_tour_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS is_tour_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS trades_tour_demo_idx
  ON public.trades (user_id) WHERE is_tour_demo;

CREATE INDEX IF NOT EXISTS journal_entries_tour_demo_idx
  ON public.journal_entries (user_id) WHERE is_tour_demo;
