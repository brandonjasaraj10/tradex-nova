/*
  Replace the partial unique index on synced trades with a plain one.

  The partial version (WHERE external_id IS NOT NULL) was correct as a
  constraint but unusable as a conflict target: Postgres will only match an
  ON CONFLICT specification against an index with no predicate, so every
  upsert failed with "there is no unique or exclusion constraint matching
  the ON CONFLICT specification".

  The predicate was never needed. Postgres treats NULLs as distinct in a
  unique index, so a plain index on (user_id, external_id) still allows any
  number of manual and CSV-imported trades - they all carry NULL and none
  of them collide.
*/

DROP INDEX IF EXISTS public.trades_user_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS trades_user_external_id_key
  ON public.trades (user_id, external_id);
