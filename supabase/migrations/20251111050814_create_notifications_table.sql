/*
  # Create notifications table

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key) - Unique identifier for each notification
      - `user_id` (uuid, foreign key) - References auth.users, the recipient of the notification
      - `title` (text) - Notification title
      - `message` (text) - Notification message content
      - `type` (text) - Type of notification (info, success, warning, error)
      - `is_read` (boolean) - Whether the notification has been read
      - `created_at` (timestamptz) - When the notification was created
      - `read_at` (timestamptz, nullable) - When the notification was marked as read

  2. Security
    - Enable RLS on `notifications` table
    - Add policy for users to read their own notifications
    - Add policy for users to update their own notifications (mark as read)

  3. Indexes
    - Add index on user_id for faster queries
    - Add index on is_read for filtering unread notifications
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);