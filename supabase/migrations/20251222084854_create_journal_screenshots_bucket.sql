/*
  # Create Journal Screenshots Storage Bucket

  1. Storage Setup
    - Create `journal-screenshots` bucket for storing journal entry images
    - Make bucket public so images can be displayed
    
  2. Security Policies
    - Allow authenticated users to upload images to their own folder (organized by user_id)
    - Allow public read access to all screenshots
    - Allow users to update/delete their own screenshots
    
  3. Notes
    - Images are organized in user-specific folders: {user_id}/{timestamp}.{ext}
    - Bucket is public for easy image display without signed URLs
*/

-- Create the storage bucket for journal screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-screenshots', 'journal-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload their own screenshots
CREATE POLICY "Users can upload their own screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'journal-screenshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to all screenshots
CREATE POLICY "Anyone can view screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'journal-screenshots');

-- Policy: Allow users to update their own screenshots
CREATE POLICY "Users can update their own screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'journal-screenshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'journal-screenshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own screenshots
CREATE POLICY "Users can delete their own screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'journal-screenshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);