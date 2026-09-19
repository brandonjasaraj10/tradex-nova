/*
  A record of when each MetaApi account was actually running.

  MetaApi bills a minimum of six hours every time an account is deployed, and
  does not say whether redeploying inside an existing minimum starts a fresh
  six hours or continues the one already paid for. That difference decides
  whether pausing and resuming is effectively free or costs about seven cents
  a time, and there is no documentation to settle it.

  It is measurable, though. The invoice itemises deployed hours per account,
  so the only missing half is what we did: when each account went up and came
  down. This is that half.

  Written by the paths that actually change an account's state - connecting,
  pausing, resuming - rather than inferred from sync_paused_at, because
  sync_paused_at only holds the CURRENT pause and is overwritten on the next
  one. A billing question needs the whole history, not the latest value.

  Compare a period's rows against the invoice: if MetaApi bills more deployed
  hours than these rows account for, every deploy is starting its own
  six-hour block.
*/

CREATE TABLE IF NOT EXISTS metaapi_deploy_log (
  id                 bigserial PRIMARY KEY,
  broker_connection_id uuid REFERENCES broker_connections(id) ON DELETE SET NULL,
  metaapi_account_id text NOT NULL,
  /* deployed | undeployed | released */
  action             text NOT NULL,
  /* connect | resume | pause | delete | retention | sweep */
  reason             text,
  occurred_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS metaapi_deploy_log_account_idx
  ON metaapi_deploy_log (metaapi_account_id, occurred_at);

/*
  No RLS policies, same arrangement as nova_chat_rate_limits: nothing but the
  edge functions, running as the service role, ever touches this. RLS is on so
  a client with an anon key reads nothing.
*/
ALTER TABLE metaapi_deploy_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE metaapi_deploy_log IS
  'When each MetaApi account was deployed, undeployed or released, and why. Exists to check billed deployed-hours against hours actually used, since MetaApi does not document whether a redeploy inside the six-hour minimum starts a new one.';

/*
  Seed what is already known rather than starting blank, so the first
  comparison has something to stand on. Times are exact where they were
  recorded and marked as backfill where they were not.
*/
INSERT INTO metaapi_deploy_log (broker_connection_id, metaapi_account_id, action, reason, occurred_at)
SELECT bc.id, bc.metaapi_account_id, 'deployed', 'connect (backfill)', bc.created_at
FROM broker_connections bc
WHERE bc.metaapi_account_id IS NOT NULL
ON CONFLICT DO NOTHING;
