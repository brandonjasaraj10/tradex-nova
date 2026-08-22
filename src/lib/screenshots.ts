import { supabase } from './supabase';

/*
  Screenshot storage.

  Two kinds of screenshot end up on a journal entry, and they must be
  handled differently:

    1. A link the user pasted (TradingView, Imgur...). That image lives on
       someone else's server under their rules; we just render the URL.
    2. A file the user uploaded. That one is ours to protect.

  Uploaded files used to live in a PUBLIC bucket and were stored as public
  URLs, which meant anyone holding the link could fetch the image forever
  with no login - verified against production, an unauthenticated request
  returned a real user's screenshot with HTTP 200. The bucket's RLS policies
  did not help: they guard the authenticated API path, not the public CDN
  URL. For a trading journal those images routinely show account balances
  and P&L.

  Now the bucket is private and only the object PATH is stored. A short
  lived signed URL is minted at render time, so a leaked link stops working
  instead of granting permanent access.
*/

const BUCKET = 'journal-screenshots';

// Long enough to view an entry without re-signing constantly, short enough
// that a copied link is useless by the time it travels anywhere.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** External links are stored verbatim; our own uploads are stored as a bare path. */
export function isExternalUrl(urlOrPath: string): boolean {
  return /^https?:\/\//i.test(urlOrPath);
}

export async function uploadScreenshot(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;

  // The path, not a URL. Storing a URL is what made these permanent.
  return path;
}

/*
  Resolves whatever is stored on the entry into something an <img> can use.
  Returns null when signing fails so callers can show a placeholder rather
  than a broken image with no explanation.
*/
export async function resolveScreenshotUrl(urlOrPath: string): Promise<string | null> {
  if (!urlOrPath) return null;
  if (isExternalUrl(urlOrPath)) return urlOrPath;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(urlOrPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('Could not sign screenshot URL:', error);
    return null;
  }
  return data.signedUrl;
}

export async function deleteScreenshot(urlOrPath: string): Promise<void> {
  // Nothing to delete for a link we never hosted.
  if (!urlOrPath || isExternalUrl(urlOrPath)) return;
  const { error } = await supabase.storage.from(BUCKET).remove([urlOrPath]);
  if (error) console.error('Could not delete screenshot:', error);
}
