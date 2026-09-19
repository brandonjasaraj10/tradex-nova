/*
  Removing an account should stop it costing money, not destroy it.

  MetaApi charges $2.10 to add a trading account to its cloud. That is per
  account CREATED, it is not refunded on delete, and re-adding pays it again
  - confirmed off a real invoice that billed it twice for one broker account
  in ten minutes, because removing used to leave the MetaApi account alive
  and re-adding provisioned a second one.

  Set that against $0.0010/hour - about $0.73 a month - to keep an account
  registered but undeployed. Break-even is roughly three months. So deleting
  an account a user might come back to inside a quarter is the expensive
  choice, and it also means asking them for the investor password again,
  which we deliberately never store.

  So removal becomes: undeploy at MetaApi, and keep the row with removed_at
  set. The account stops running, stops costing $8.64 a month, disappears
  from the user's list, and can be brought back instantly. Deleting for real
  happens later, once they clearly are not coming back.

  removed_at rather than a boolean, because the retention policy needs to
  know how long ago.

  Two things depend on the row surviving, and both are the point:

    - the orphan sweep decides by "does any row point at this MetaApi
      account". A retained row keeps pointing at it, so the sweep leaves it
      alone instead of deleting it within the hour.
    - trades reference broker_connections with NO ACTION. A hard delete is
      refused while any exist; a retained row never hits that.
*/

ALTER TABLE broker_connections
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

COMMENT ON COLUMN broker_connections.removed_at IS
  'Set when the user removes the account. The row and its MetaApi account are kept, undeployed, so reconnecting costs nothing and needs no password. Null means the account is live.';

/* Finding what is due for real deletion is the only query on this column. */
CREATE INDEX IF NOT EXISTS broker_connections_removed_at_idx
  ON broker_connections (removed_at)
  WHERE removed_at IS NOT NULL;

/*
  The view every client reads. Filtering here means a removed account
  vanishes from the account selector, the connections list and everything
  else without a single call site having to remember.

  security_invoker stays on: the base table's RLS is what scopes rows to
  their owner, and dropping it here would hand every user everyone else's
  connections.

  No-op on the day it ships - nothing has removed_at set yet.
*/
CREATE OR REPLACE VIEW public.user_broker_connections
WITH (security_invoker = true) AS
  SELECT
    broker_connections.id,
    broker_connections.user_id,
    broker_connections.account_name,
    broker_connections.broker_type,
    broker_connections.created_at,
    broker_connections.last_sync,
    broker_connections.status,
    broker_connections.broker_id,
    broker_connections.starting_balance,
    broker_connections.current_balance,
    broker_connections.currency,
    broker_connections.last_balance_update,
    broker_connections.is_auto_sync_enabled,
    broker_connections.ownership_type,
    broker_connections.account_type,
    broker_connections.metaapi_account_id,
    broker_connections.platform,
    broker_connections.mt_login,
    broker_connections.metaapi_server
  FROM broker_connections
  WHERE broker_connections.removed_at IS NULL;
