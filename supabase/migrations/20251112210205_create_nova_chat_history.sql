/*
  # Create NOVA Chat History Table

  1. New Tables
    - `nova_chat_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `role` (text, either 'user' or 'assistant')
      - `content` (text, the message content)
      - `created_at` (timestamptz, when the message was created)
      - `session_id` (uuid, to group conversations together)
  
  2. Security
    - Enable RLS on `nova_chat_messages` table
    - Add policy for users to read their own chat history
    - Add policy for users to insert their own messages
    - Add policy for users to delete their own messages

  3. Indexes
    - Index on user_id for faster queries
    - Index on session_id for conversation grouping
    - Index on created_at for chronological ordering
*/

CREATE TABLE IF NOT EXISTS nova_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  session_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nova_chat_messages_user_id ON nova_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_nova_chat_messages_session_id ON nova_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_nova_chat_messages_created_at ON nova_chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE nova_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own messages
CREATE POLICY "Users can read own chat messages"
  ON nova_chat_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert own chat messages"
  ON nova_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own chat messages"
  ON nova_chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);