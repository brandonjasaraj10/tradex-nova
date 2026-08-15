/*
  # Fix user_tips schema drift

  ## Problem
  generate-tips has been returning 500 errors on every call - confirmed
  by testing, not just reading code. The live table has a legacy
  `tip_text` column (NOT NULL, no default) that the current code never
  populates - it uses `title`/`content`/`tip_category` instead. Same
  drift pattern as elsewhere in this project: the column traces back to
  20260204195044_restore_complete_database_schema.sql, and isn't
  referenced anywhere else in the app (grepped both frontend and
  edge functions - zero hits outside that one migration), so it's dead
  weight left over from an older schema iteration, not something to
  populate.

  ## Fix
  Drop the NOT NULL constraint rather than duplicate data into an
  unused column.
*/

ALTER TABLE user_tips ALTER COLUMN tip_text DROP NOT NULL;
