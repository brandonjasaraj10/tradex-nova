/*
  # Fix journal_entries: missing direction column breaks every single save

  ## Problem
  This is the most severe bug found in this session's testing pass.
  Journal.tsx's autoSaveEntry() always includes `direction` in every
  create/update payload (the Long/Short buttons in the entry form),
  but the live journal_entries table has no such column at all.
  PostgREST rejects the entire request when any payload field doesn't
  match a real column - confirmed live: typing into a real journal
  entry and waiting for autosave produced a completely silent failure
  (PGRST204 "Could not find the 'direction' column", logged to the
  console only, no error shown to the user at all).

  This means journal entries - the actual core feature of this app -
  could not be saved through the real UI at all, for any entry type,
  by anyone, this whole time. It explains why the site owner's own
  real account had zero real journal_entries rows despite active use.

  ## Fix
  Add the column. Matches trades.direction (text, values 'LONG'/'SHORT'
  from the UI, or null when unset).
*/

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS direction text;
