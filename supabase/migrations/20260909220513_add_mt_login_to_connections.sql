/*
  Store the MetaTrader account number on a synced connection.

  Not a secret - it's the number shown in the trader's own terminal, and we
  need it to label the account ("MT5 #5012345") and to tell two connections
  apart when someone syncs a demo and a live account with the same broker.

  The investor password is deliberately NOT stored, here or anywhere. It is
  handed to MetaApi once during provisioning and then forgotten; all we keep
  afterwards is metaapi_account_id, which is useless without our own API
  token.

  Additive: one nullable column, plus the view re-created to expose it.
*/

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS mt_login text;

COMMENT ON COLUMN public.broker_connections.mt_login IS
  'MetaTrader account number for a synced connection. Not secret. NULL for manual accounts.';

CREATE OR REPLACE VIEW public.user_broker_connections AS
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
  FROM public.broker_connections;

ALTER VIEW public.user_broker_connections SET (security_invoker = true);
