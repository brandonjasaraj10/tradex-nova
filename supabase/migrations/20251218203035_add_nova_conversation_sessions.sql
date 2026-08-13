/*
  # Add NOVA Conversation Sessions Table

  1. New Tables
    - `nova_conversation_sessions`
      - `id` (uuid, primary key) - Same as session_id in messages
      - `user_id` (uuid, foreign key to auth.users)
      - `title` (text, auto-generated or user-defined conversation title)
      - `created_at` (timestamptz, when the session was created)
      - `updated_at` (timestamptz, when the last message was added)
      - `message_count` (integer, number of messages in this session)
  
  2. Security
    - Enable RLS on `nova_conversation_sessions` table
    - Add policies for users to manage their own sessions
  
  3. Indexes
    - Index on user_id for faster queries
    - Index on updated_at for recent conversations
*/

CREATE TABLE IF NOT EXISTS nova_conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nova_sessions_user_id ON nova_conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_nova_sessions_updated_at ON nova_conversation_sessions(updated_at DESC);

ALTER TABLE nova_conversation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON nova_conversation_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON nova_conversation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON nova_conversation_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON nova_conversation_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE nova_conversation_sessions
  SET 
    updated_at = now(),
    message_count = message_count + 1
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_session_on_message
  AFTER INSERT ON nova_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_on_message();