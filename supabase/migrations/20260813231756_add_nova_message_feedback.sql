/*
  # Thumbs up/down feedback on Nova messages

  ## Purpose
  Step 1 of "help Nova improve over time": lets a user rate any of Nova's
  replies. Nova's underlying model (Claude) can't be retrained with this
  data - Anthropic doesn't offer fine-tuning - so this is a signal for
  a human to review later and use to improve Nova's system prompt/tools,
  not an automatic training pipeline.

  ## Table
  One row per (message, user) pair - a user can change their mind about
  a rating (upsert) but only has one live rating per message. Deleting
  a row means "no opinion" (not currently exposed in the UI, but the
  cleared/undo case relies on this being possible).

  ## Access
  Same shape as every other Nova table (see nova_chat_messages'
  policies in 20260813211517): must be the row's own user AND have an
  active subscription, since feedback only makes sense on a feature
  that's actually paywalled.
*/

CREATE TABLE IF NOT EXISTS nova_message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES nova_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_nova_message_feedback_user_message
  ON nova_message_feedback (user_id, message_id);

ALTER TABLE nova_message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own message feedback"
  ON nova_message_feedback
  FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())) AND public.has_active_subscription());

CREATE POLICY "Users can insert own message feedback"
  ON nova_message_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())) AND public.has_active_subscription());

CREATE POLICY "Users can update own message feedback"
  ON nova_message_feedback
  FOR UPDATE
  TO authenticated
  USING ((user_id = (SELECT auth.uid())) AND public.has_active_subscription())
  WITH CHECK ((user_id = (SELECT auth.uid())) AND public.has_active_subscription());

CREATE POLICY "Users can delete own message feedback"
  ON nova_message_feedback
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
