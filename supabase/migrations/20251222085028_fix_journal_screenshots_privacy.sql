/*
  # Fix Journal Screenshots Privacy

  1. Changes
    - Make bucket private (not public)
    - Restrict read access so users can only see their own screenshots
    
  2. Security
    - Only the user who uploaded can view their own images
    - No public access to anyone's screenshots
*/

-- Update bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'journal-screenshots';

-- Drop the public read policy
DROP POLICY IF EXISTS "Anyone can view screenshots" ON storage.objects;

-- Create new policy: Users can only view their own screenshots
CREATE POLICY "Users can view their own screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'journal-screenshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);