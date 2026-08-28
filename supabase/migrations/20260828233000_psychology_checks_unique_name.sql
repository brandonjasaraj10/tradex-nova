/*
  One check per name per user.

  The starter list is seeded when someone opens the tab with none, and that
  read-then-insert can run twice concurrently - two loads both see zero and
  both insert, leaving every starter check duplicated. Caught on the first
  real run: eleven rows where there should have been five. A guard in the
  component cannot fix it, because the race is between two round trips to the
  database, so the constraint lives here where it can be enforced.

  It also rules out a user creating two checks with identical wording, which
  would be meaningless on a checklist you tick.
*/

DELETE FROM psychology_checks a
USING psychology_checks b
WHERE a.user_id = b.user_id
  AND a.name = b.name
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS psychology_checks_user_name_unique
  ON psychology_checks (user_id, name);
