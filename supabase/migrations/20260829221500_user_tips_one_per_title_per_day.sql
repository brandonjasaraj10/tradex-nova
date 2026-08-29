/*
  One tip per title per user per day.

  The Nova page reads active tips and generates a set when it finds none. That
  read-then-write is not atomic, so two overlapping loads both saw zero and
  both generated - producing "Maintain Your Edge" twice, 16 milliseconds
  apart, in the panel meant to demonstrate Nova paying attention.

  Constraining on (user_id, title) alone would be wrong: tips expire, and the
  same advice is legitimately regenerated later. Constraining on expires_at
  would not have caught it either, because each call computed its own expiry -
  the two copies differed by 29 milliseconds.

  The generation DAY is the right grain. Two calls racing inside one page load
  always share it, so the loser is rejected; a genuine regeneration tomorrow
  gets a new day and is allowed. AT TIME ZONE 'UTC' makes the expression
  immutable, which a bare ::date cast is not, since that depends on the
  session TimeZone.

  generate-tips treats 23505 from this index as success rather than an error,
  since the losing call's tips are already in the table.
*/

DELETE FROM user_tips a
USING user_tips b
WHERE a.user_id = b.user_id
  AND a.title = b.title
  AND (a.generated_at AT TIME ZONE 'UTC')::date = (b.generated_at AT TIME ZONE 'UTC')::date
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS user_tips_one_per_title_per_day
  ON user_tips (user_id, title, ((generated_at AT TIME ZONE 'UTC')::date));
