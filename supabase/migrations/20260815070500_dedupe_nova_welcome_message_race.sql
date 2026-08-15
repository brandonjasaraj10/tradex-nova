/*
  # Fix duplicate "Hey I'm NOVA" welcome messages

  ## Problem
  Deferred as low-priority/cosmetic earlier this session, picking it up
  now. novaContext.tsx's loadMessages() has a non-atomic check-then-insert
  race: it reads chat history, and if empty, saves a welcome message -
  same shape as the trading_confluences race fixed earlier
  (20260814235526_dedupe_and_fix_confluences_race.sql). Confirmed live in
  nova_chat_messages: genuine duplicate welcome-message pairs from real
  usage, not just a React StrictMode dev artifact.

  ## Fix
  Same pattern as the confluences fix: a partial unique index scoped to
  the exact welcome message text, so at most one can exist per session,
  regardless of how many concurrent loads race to check-then-insert it.
  Doesn't restrict any other message content.
*/

-- Dedupe existing duplicate pairs first (keep the oldest per session),
-- confirmed live: several real sessions had 2-4 copies.
DELETE FROM nova_chat_messages a
USING nova_chat_messages b
WHERE a.session_id = b.session_id
  AND a.content = 'Hey! I''m NOVA, your AI Trading Assistant. I''m here to help you analyze your trades, review your performance, and provide insights. What would you like to explore?'
  AND b.content = a.content
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS nova_chat_messages_unique_welcome
ON nova_chat_messages (session_id)
WHERE content = 'Hey! I''m NOVA, your AI Trading Assistant. I''m here to help you analyze your trades, review your performance, and provide insights. What would you like to explore?';
