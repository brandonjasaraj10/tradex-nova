/*
  Record which trading platform an account actually runs on (MetaTrader 5,
  cTrader, Tradovate, ...), separately from which broker or prop firm it is
  with.

  Why: "FTMO" or "Alpha Capital Group" doesn't tell us anything about how we
  could sync the account. Those firms let the trader pick between MT5,
  cTrader, DXtrade and TradeLocker, and each of those needs a completely
  different integration. Without this we can only guess how much of the user
  base any given broker-sync build would actually reach.

  Nullable on purpose - the dropdown is required for new accounts, but every
  account that already exists predates the question, so NULL means "created
  before we asked", not "none". No constraint enforces the value list; the
  dropdown is the only thing that writes here and a stray value is worth
  seeing rather than rejecting.

  Additive only: a new nullable column plus the view re-created to expose it.
  Nothing reads it yet, so this is safe to have in production ahead of the
  broker-sync feature it's being collected for.
*/

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS platform text;

COMMENT ON COLUMN public.broker_connections.platform IS
  'Trading platform the account runs on (mt5, mt4, ctrader, dxtrade, match_trader, tradelocker, tradovate, rithmic, ninjatrader, tradingview, other, unsure). "other" means the
   trader''s platform is missing from our list; "unsure" means they did not know.
   NULL = an account created before we started asking.';

-- Re-created rather than altered: a view's column list can only be extended
-- by replacing it. Same columns in the same order, platform appended.
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
    broker_connections.platform
  FROM public.broker_connections;

-- Set explicitly rather than relied on: this view runs as the caller so the
-- RLS policies on broker_connections still apply through it (see
-- 20260815061500_fix_user_broker_connections_rls_bypass.sql). Re-asserting it
-- here means a future CREATE OR REPLACE can never quietly drop it.
ALTER VIEW public.user_broker_connections SET (security_invoker = true);
