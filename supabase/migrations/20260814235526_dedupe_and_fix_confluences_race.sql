/*
  # De-duplicate and fix the trading_confluences/trading_plan_settings race

  ## Problem
  initializeDefaultConfluences() (src/services/confluences.ts) does a
  non-atomic "check if any confluence exists, then insert 6 defaults"
  - and it's called from both Dashboard.tsx and Checklists.tsx. If both
  fire close together (confirmed live: two full sets inserted 55ms
  apart for one account), both SELECT checks can pass before either
  INSERT completes, so both insert their own set of 6 defaults, plus a
  duplicate trading_plan_settings row (that insert has no existence
  check at all).

  Confirmed this already affected 3 real accounts on Trade X, including
  the site owner's own account - not just test data. Found while doing
  a broader functional testing pass, not something anyone reported.

  ## Fix
  1. De-duplicate existing rows, keeping the oldest of each set.
  2. Add unique constraints so this can never happen again at the
     database level, regardless of how many places call the seeding
     code or how close together they fire.
  3. The application code (confluences.ts) is updated separately to
     catch and ignore the resulting unique-violation instead of
     throwing, since "someone else already seeded this" is an expected,
     harmless outcome once the constraint exists.
*/

DELETE FROM trading_confluences a USING trading_confluences b
WHERE a.user_id = b.user_id
  AND a.name = b.name
  AND a.created_at > b.created_at;

DELETE FROM trading_plan_settings a USING trading_plan_settings b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;

ALTER TABLE trading_confluences
  ADD CONSTRAINT trading_confluences_user_id_name_key UNIQUE (user_id, name);

ALTER TABLE trading_plan_settings
  ADD CONSTRAINT trading_plan_settings_user_id_key UNIQUE (user_id);
