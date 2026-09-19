/*
  Quarantine list for MetaApi accounts nothing points at any more.

  The reconciliation sweep compares MetaApi's own account list against the
  metaapi_account_id values in broker_connections. Anything at MetaApi that
  we do not point at is costing about $8.64 a month for nothing.

  It is not released on sight, and that is the whole reason this table
  exists. Connecting an account has a window - MetaApi creates it, and a
  moment later we save its id - where a sweep would see a real, brand-new
  account as an orphan and delete the customer's connection out from under
  them. Rather than trust a timestamp from MetaApi (the provisioning API
  makes no promise about returning one), the sweep writes the candidate
  down and leaves it alone. A later sweep releases it only if it is STILL
  unreferenced and was first seen long enough ago that no connect flow
  could still be in flight.

  So an orphan costs us one more sweep interval before it stops billing,
  and a real account is never deleted because two calls happened in an
  unlucky order.

  released_at is kept rather than deleted so a run can be read back later:
  what was let go, and when.

  No RLS policies on purpose. Nothing but the sweep, running as the service
  role, ever touches this - the same arrangement as nova_chat_rate_limits.
  RLS is still enabled so a client with an anon key reads nothing.
*/

CREATE TABLE IF NOT EXISTS metaapi_orphan_candidates (
  metaapi_account_id text PRIMARY KEY,
  account_name       text,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  released_at        timestamptz,
  release_error      text
);

ALTER TABLE metaapi_orphan_candidates ENABLE ROW LEVEL SECURITY;

/* Finding the ones old enough to act on is the only query this table has. */
CREATE INDEX IF NOT EXISTS metaapi_orphan_candidates_pending_idx
  ON metaapi_orphan_candidates (first_seen_at)
  WHERE released_at IS NULL;
