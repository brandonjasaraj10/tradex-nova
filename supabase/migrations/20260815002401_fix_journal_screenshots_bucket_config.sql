/*
  # Fix journal-screenshots bucket: not actually public despite the app relying on it being so

  ## Problem
  Journal.tsx uploads screenshots then calls storage.getPublicUrl() and
  stores that URL directly in before_screenshots/after_screenshots to
  display later. getPublicUrl() builds a URL string unconditionally -
  it doesn't check whether the bucket is actually public. This bucket
  was public: false, so every uploaded screenshot's URL returned 400
  for any unauthenticated request - confirmed live: uploaded a real
  test image, fetched the exact URL the app would store and display,
  got a 400. A plain <img> tag never sends Supabase auth headers, so
  this broke screenshot display for everyone, including viewing your
  own uploads.

  Also had no file_size_limit or allowed_mime_types at all - the app's
  own "must be an image" check is client-side only (trivially bypassed
  by calling the upload API directly), so the bucket itself had no
  real restriction on what could be uploaded.

  ## Fix
  Make the bucket public (matches what the code already assumes) and
  add reasonable file type/size limits.
*/

UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
WHERE id = 'journal-screenshots';
