import { supabase } from '../lib/supabase';

/*
  Filing a bug or issue from inside the app.

  The attachment goes to a private bucket under the user's own folder and the
  row stores the object path, never a URL - the same rule as journal
  screenshots, and for the same reason: a stored public URL stays fetchable by
  anyone who ever sees it, and these screenshots routinely show balances.
*/

const BUCKET = 'support-attachments';

export const SUPPORT_CATEGORIES = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'issue', label: 'Something looks wrong' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other', label: 'Something else' },
] as const;

export type SupportCategory = typeof SUPPORT_CATEGORIES[number]['value'];

// Mirrors the bucket's own limit. Checked here too so an oversized file is
// refused instantly with a clear message, rather than after a slow upload
// that fails with a storage error nobody can read.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export interface SubmitReportInput {
  category: SupportCategory;
  subject: string;
  description: string;
  file?: File | null;
}

export function validateAttachment(file: File): string | null {
  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return 'That file type is not supported. Attach a PNG, JPG, WEBP, GIF or PDF.';
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'That file is over 5MB. Try a screenshot rather than a recording.';
  }
  return null;
}

async function uploadAttachment(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  // Folder is the user id because the storage policies check exactly that.
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw new Error('Could not upload that file. Please try again.');

  return path;
}

export async function submitSupportReport(input: SubmitReportInput): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You need to be signed in to send a report.');

  let attachmentPath: string | null = null;
  if (input.file) {
    const problem = validateAttachment(input.file);
    if (problem) throw new Error(problem);
    attachmentPath = await uploadAttachment(input.file, session.user.id);
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-support-report`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        category: input.category,
        subject: input.subject,
        description: input.description,
        attachment_path: attachmentPath,
        /*
          Collected automatically because "it broke" plus the page it broke on
          and the browser it broke in is often the whole diagnosis, and nobody
          thinks to include it. Nothing here is data the user did not already
          hand the site by loading it.
        */
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        app_version: import.meta.env.VITE_APP_VERSION ?? 'unknown',
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not send your report. Please try again.');
  }
}
