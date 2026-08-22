/*
  Make journal screenshots private.

  The journal-screenshots bucket was public, and the app stored the public
  URL on the entry. Verified against production: an unauthenticated request
  for another user's screenshot returned HTTP 200 and the real image. The
  bucket's RLS policies did not prevent it - those guard the authenticated
  API path, not the public CDN URL that a public bucket exposes.

  These are trading screenshots. They routinely show account balances, open
  positions and P&L, and the link never expired, so anywhere a URL leaked -
  a shared screen, browser history, a forwarded message - was permanent
  access to someone's finances with no way to revoke it.

  URLs were not enumerable (random uuid + millisecond timestamp), so there
  was no mass-harvest path, which is why this is a fix rather than an
  incident. But "unguessable" is not "private".

  After this the bucket is private and the app stores object paths, signing
  a short-lived URL at render time. Existing rows are rewritten from public
  URL to bare path so previously uploaded screenshots keep displaying.
*/

UPDATE storage.buckets
SET public = false
WHERE id = 'journal-screenshots';

/*
  Rewrite stored public URLs to the bare object path.

  Only touches URLs pointing at our own bucket - screenshots pasted from
  TradingView and similar stay exactly as they are, since we never hosted
  them and the app still renders those links directly.
*/
UPDATE journal_entries
SET before_screenshots = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'url' LIKE '%/storage/v1/object/public/journal-screenshots/%'
      THEN jsonb_set(elem, '{url}',
             to_jsonb(split_part(elem->>'url', '/storage/v1/object/public/journal-screenshots/', 2)))
      ELSE elem
    END
  )
  FROM jsonb_array_elements(before_screenshots::jsonb) elem
)::json
WHERE before_screenshots::text LIKE '%/storage/v1/object/public/journal-screenshots/%';

UPDATE journal_entries
SET after_screenshots = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'url' LIKE '%/storage/v1/object/public/journal-screenshots/%'
      THEN jsonb_set(elem, '{url}',
             to_jsonb(split_part(elem->>'url', '/storage/v1/object/public/journal-screenshots/', 2)))
      ELSE elem
    END
  )
  FROM jsonb_array_elements(after_screenshots::jsonb) elem
)::json
WHERE after_screenshots::text LIKE '%/storage/v1/object/public/journal-screenshots/%';
