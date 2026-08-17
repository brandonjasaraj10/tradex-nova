/*
  # Give each journal entry its own Nova conversation

  ## Problem
  Nova's chat was one single ongoing conversation shared across the
  whole app - the Dashboard widget, the NOVA AI page, and every single
  journal entry all read/wrote the same message thread. Opening Nova
  on one journal entry showed whatever was last discussed anywhere
  else, including totally unrelated entries - which read as Nova
  "auto-analyzing" a fresh upload when it was really just old context
  bleeding through.

  ## Fix
  journal_entries gets its own nova_session_id, pointing at a row in
  the existing nova_conversation_sessions table. The app generates one
  the first time a user opens Nova on a given entry and persists it on
  next save, so reopening that same entry later shows the same
  conversation - but a different entry, or the main Dashboard/NOVA AI
  page, never will. Nova's cross-conversation memory
  (nova_user_memories) is untouched by this and keeps working across
  all of these separate threads, same as before.
*/

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS nova_session_id uuid REFERENCES nova_conversation_sessions(id) ON DELETE SET NULL;
