/*
  Turning off syncing should not hide the account.

  The first version of this parked the MetaApi account and then filtered the
  row out of the view every client reads, so the account and its trades
  vanished from the product. That is the wrong model, and the reason is not
  only that it is unkind: the data is the customer's own trading history,
  and the whole pitch is that this is where their history and patterns live.
  Hiding it to apply upgrade pressure contradicts the thing being sold.

  It is also worse at the job. A vanished account creates forgetting, not
  pressure. An account sitting in the list marked "not syncing" with a
  reconnect button is a permanent upsell in the exact place the want occurs.

  It is what the category does, too - TradeZella's own documentation on
  unlinking a broker says it "does not delete any existing trades. It only
  removes the connection for future syncs."

  So: the row stays visible, always. What changes is that the account stops
  syncing and its MetaApi account is parked at $0.73/month instead of $8.64.
  The scarce thing customers pay for is a sync slot, not the right to see
  their own trades.

  removed_at becomes sync_paused_at, because it no longer means removed. It
  only exists to time the 120-day retirement of a parked MetaApi account -
  and when that fires, the account simply becomes an ordinary manual one
  with every trade still in place. Nothing a user can see is ever deleted by
  it.
*/

ALTER TABLE broker_connections
  RENAME COLUMN removed_at TO sync_paused_at;

COMMENT ON COLUMN broker_connections.sync_paused_at IS
  'When the user turned syncing off. The account, its trades and its history stay visible and editable; only automatic syncing stops and the MetaApi account is parked. Null means syncing is on. Used to time the retirement of a parked MetaApi account, never to hide anything.';

ALTER INDEX IF EXISTS broker_connections_removed_at_idx
  RENAME TO broker_connections_sync_paused_at_idx;

/*
  The view goes back to showing every row.

  A paused account must appear in the account selector, the connections
  list, the calendar and everywhere else, because its trades are still the
  user's trades. The only thing that reads differently is that sync is off,
  and is_auto_sync_enabled already says so.
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
    broker_connections.metaapi_server,
    broker_connections.sync_paused_at
  FROM broker_connections;

/*
  The plan limit counts accounts that are actually SYNCING, not accounts
  that exist.

  This is the change that makes the whole model coherent. Somebody can keep
  ten accounts of history on Starter; what they are buying is how many of
  them update themselves. Counting paused accounts against the allowance
  would charge people for their own archive and make "turn off syncing"
  pointless - the slot would never come back.
*/
CREATE OR REPLACE FUNCTION public.synced_accounts_in_use(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::integer
  FROM public.broker_connections
  WHERE user_id = p_user_id
    AND metaapi_account_id IS NOT NULL
    AND sync_paused_at IS NULL
    AND is_auto_sync_enabled = true;
$$;

COMMENT ON FUNCTION public.synced_accounts_in_use(uuid) IS
  'How many of a user''s sync slots are actually occupied. Paused accounts do not count - they keep their history and their parked MetaApi account, but not a slot.';
