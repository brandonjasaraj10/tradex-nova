/*
  Remember which broker trade a synced row came from.

  Without this, syncing is not repeatable: every run would re-insert the
  same trades and a user's history would multiply each time we polled. This
  is the column that makes a sync idempotent - run it a hundred times and
  the result is identical.

  Deliberately scoped per user rather than globally unique. Two different
  users could hold the same MetaApi trade id in principle, and a global
  constraint would let one user's sync silently block another's.

  Partial index: manual and CSV-imported trades have no external id and
  there can be any number of those, so only synced rows are constrained.
*/

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS external_id text;

COMMENT ON COLUMN public.trades.external_id IS
  'Broker/MetaApi id for a synced trade. NULL for manual or CSV-imported trades.';

CREATE UNIQUE INDEX IF NOT EXISTS trades_user_external_id_key
  ON public.trades (user_id, external_id)
  WHERE external_id IS NOT NULL;
