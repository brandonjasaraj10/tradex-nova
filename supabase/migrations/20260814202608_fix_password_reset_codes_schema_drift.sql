/*
  # Fix password_reset_codes schema drift

  ## Problem
  The password-reset edge function was written against this table's
  original design (see 20251211222603_add_password_reset_codes_and_tour_completed.sql):
  email, code, expires_at, used, attempts, created_at. The live table on
  this database somehow ended up with user_id instead of email, and no
  attempts column at all - confirmed by testing, not just reading code.
  Every password reset request has been failing at the very first step
  (inserting the reset code) with no user ever successfully receiving
  one. Table is empty (0 rows), so there's no data to reconcile.

  ## Fix
  Add the two missing columns so the live table matches what the
  function (and the original design) actually expects. user_id is left
  in place rather than removed - unused by the current function, but
  harmless and not worth a riskier column drop for a table with zero
  rows depending on it.
*/

ALTER TABLE password_reset_codes
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email
  ON password_reset_codes (email);
