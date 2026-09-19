/*
  Sync every five minutes instead of once an hour.

  Hourly was chosen when nothing was connected and the only question was
  whether the job ran at all. It is the wrong number for the actual
  product: a trader who closes a position and opens TradeX to write it up
  should find it there, and telling them to wait up to an hour for their
  own trade to show up is the kind of thing that makes a sync feature feel
  broken even when it is working perfectly.

  Five minutes is affordable because the job is small. Measured over 25
  real runs with one account connected: 4.2s on average, 8.4s at worst.
  Running a four-second job every three hundred seconds leaves the thing
  idle around 98% of the time.

  The ceiling to watch is the loop in sync-all-accounts, which syncs
  accounts one after another rather than at the same time. At ~4s each
  that is fine for tens of accounts and not fine for hundreds - whoever
  sells synced accounts as a paid tier should make that loop run accounts
  in parallel batches before the account count gets there, not after.

  Re-scheduling by name replaces the existing entry rather than adding a
  second one, so this is safe to run more than once.
*/

SELECT cron.schedule(
  'sync-broker-accounts',
  '*/5 * * * *',
  $$SELECT trigger_broker_sync();$$
);
