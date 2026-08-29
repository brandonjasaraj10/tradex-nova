/*
  One insight per title per user per day - the same guard already applied to
  user_tips, for the same race.

  The Nova page reads active insights and generates a set when it finds none.
  That read-then-write is not atomic, so two overlapping loads both saw zero
  and both generated: "Rule Compliance Needs Work" and three others each
  appeared twice, 35 milliseconds apart.

  Fixing tips alone was not enough, because the two panels are independent
  loaders with the same shape. Worth remembering the next time a list renders
  double: look for a read-then-write, and settle it with a constraint rather
  than a guard in the component, which cannot see the other request.

  Grain is the generation DAY, not the title alone - insights expire and are
  legitimately regenerated later - and AT TIME ZONE 'UTC' keeps the expression
  immutable, which a bare ::date cast is not.
*/

DELETE FROM user_insights a
USING user_insights b
WHERE a.user_id = b.user_id
  AND a.title = b.title
  AND (a.generated_at AT TIME ZONE 'UTC')::date = (b.generated_at AT TIME ZONE 'UTC')::date
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS user_insights_one_per_title_per_day
  ON user_insights (user_id, title, ((generated_at AT TIME ZONE 'UTC')::date));
