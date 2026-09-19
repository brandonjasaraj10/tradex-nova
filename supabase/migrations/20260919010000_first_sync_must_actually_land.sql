/*
  A first sync that finds nothing must not close the full-history window.

  Connecting an account provisions it at MetaApi and MetaStats then goes and
  pulls the broker's history, which takes a few minutes. The scheduled sync
  does not wait for that. It runs, asks for everything since 2000, gets an
  empty list because there is nothing there YET, and then records last_sync
  anyway - which switches every later run to the cheap 24-hour window.

  From that moment the account's real history is behind the window and no
  later sync will ever look there again. No error, no warning: the account
  reports "synced", the trades simply are not there.

  Found on a reconnect. An account with six trades from 15-17 September was
  connected at 00:30, its first sync ran at 00:32 and imported zero, and by
  00:35 the window started at 18 September - permanently past all six.

  So the full-history window stays open until a sync actually lands
  something. history_imported_at records the first sync that did, and only
  then is the rolling window allowed to take over.

  Bounded, because an account genuinely holding no history would otherwise
  re-read all of time every five minutes forever. After
  FIRST_SYNC_GRACE the account is accepted as empty and moves to the rolling
  window like any other - an hour is far longer than MetaStats needs and
  costs nothing but a few wide reads on a brand-new account.
*/

ALTER TABLE broker_connections
  ADD COLUMN IF NOT EXISTS history_imported_at timestamptz;

COMMENT ON COLUMN broker_connections.history_imported_at IS
  'When a sync first imported at least one trade for this account. Until it is set (or the account is older than the first-sync grace period), syncs keep asking for full history rather than the cheap 24-hour window - otherwise an empty first sync silently strands the account''s back-history behind the window.';

/*
  Backfill the accounts that already worked, so nobody re-reads all of time
  on the next run: any connection that already holds a synced trade has
  plainly had its history imported.
*/
UPDATE broker_connections bc
   SET history_imported_at = COALESCE(bc.history_imported_at, bc.last_sync, now())
 WHERE bc.metaapi_account_id IS NOT NULL
   AND bc.history_imported_at IS NULL
   AND EXISTS (
     SELECT 1 FROM trades t
     WHERE t.broker_id = bc.id AND t.external_id IS NOT NULL
   );
