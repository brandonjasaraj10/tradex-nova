/*
  # Cross-conversation memory for Nova

  ## Purpose
  Step 2 of "help Nova improve over time" (see nova_message_feedback's
  migration for step 1 and the fine-tuning constraint that shapes all of
  this). Nova already gets a user's structured onboarding profile
  (user_trading_profiles) on every message, but that's fixed-schema and
  only set once. This table lets Nova itself save short freeform facts
  during conversation - a stated goal, a recurring struggle, a
  communication preference - so a brand new chat session isn't a total
  blank slate.

  ## How it's used
  The nova-chat edge function gives Claude a "remember_about_user" tool.
  When Claude calls it, the fact gets inserted here. On every message,
  the function pulls the user's most recent rows and adds them to the
  system prompt, the same way the onboarding profile already is.

  ## Access
  Same shape as nova_message_feedback: owning user + active subscription
  for read/write (Nova chat is a paid feature), owning user alone for
  delete (no UI exposes delete yet, but the policy matches every other
  Nova table so a future "manage what Nova remembers" screen doesn't
  need its own migration).
*/

CREATE TABLE IF NOT EXISTS nova_user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nova_user_memories_user_created
  ON nova_user_memories (user_id, created_at DESC);

ALTER TABLE nova_user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
  ON nova_user_memories
  FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())) AND public.has_active_subscription());

CREATE POLICY "Users can insert own memories"
  ON nova_user_memories
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())) AND public.has_active_subscription());

CREATE POLICY "Users can delete own memories"
  ON nova_user_memories
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
