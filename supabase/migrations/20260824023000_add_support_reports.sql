/*
  # In-app bug and issue reporting

  Settings > Contact Us only ever showed an email address, so reporting a bug
  meant leaving the app, opening a mail client, and describing from memory a
  screen you were no longer looking at. Almost nobody does that, which means
  real problems go unreported rather than unfixed.

  This adds a report a user can file without leaving the page, with an
  optional screenshot.

  ## Deliberately NOT subscription-gated

  Every other user table in this project requires has_active_subscription().
  This one must not. The people most likely to have something worth reporting
  are the ones whose payment failed, whose trial lapsed, or who cannot get
  in - locking support behind the subscription that is itself broken is the
  worst possible time to go silent. Reports are still tied to the reporting
  user by RLS; only the paywall is absent.

  ## Attachments

  Screenshots of a trading app routinely show balances and P&L, so the bucket
  is private, files live under a per-user folder, and the policies check that
  folder against auth.uid() - the same shape already used for
  journal-screenshots. The row stores the object path, never a URL: a stored
  public URL is what made journal screenshots permanently fetchable by anyone
  holding the link, and this avoids repeating it. Support staff read the file
  through a short-lived signed URL minted when the report is sent.
*/

CREATE TABLE IF NOT EXISTS support_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What kind of thing this is, so triage does not depend on reading every
  -- description. Constrained rather than free text.
  category text NOT NULL CHECK (category IN ('bug', 'issue', 'feature_request', 'other')),

  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 150),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 5000),

  -- Object path inside the private support-attachments bucket, never a URL.
  attachment_path text,

  /*
    Where the user was and what they were running. Filled in by the client,
    because "it broke" plus a URL and a browser string is often the whole
    diagnosis - and nobody remembers to include it by hand.
  */
  page_url text,
  user_agent text,
  app_version text,

  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'resolved', 'wont_fix')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_reports_user_id_idx ON support_reports(user_id);
CREATE INDEX IF NOT EXISTS support_reports_status_created_idx ON support_reports(status, created_at DESC);

ALTER TABLE support_reports ENABLE ROW LEVEL SECURITY;

-- No has_active_subscription() here, on purpose - see the note above.
CREATE POLICY "Users can file own reports"
  ON support_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own reports"
  ON support_reports FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

/*
  No UPDATE or DELETE policy. A user editing a report after it was emailed
  would leave the copy in the inbox disagreeing with the copy in the table,
  and deleting one would destroy the record of a problem that may still be
  open. Neither is something the reporter needs.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880, -- 5MB: a screenshot, not a screen recording
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own support attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Users can view own support attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
