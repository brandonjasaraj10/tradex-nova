/*
  # Fix critical RLS bypass on user_broker_connections view

  ## Problem
  Found while investigating fix #10 (broken manual account creation).
  user_broker_connections is a plain SELECT view over the real
  broker_connections table. The real table has correct, owner-scoped RLS
  policies (user_id = auth.uid(), plus the subscription gate). But the
  view itself had no security_invoker setting, so it evaluated with its
  owner's privileges (postgres, which bypasses RLS) instead of the
  querying user's - meaning every RLS policy on broker_connections was
  silently bypassed by anyone querying through the view.

  Confirmed live: a second test account, using its own real JWT with no
  special privileges, queried user_broker_connections with zero filters
  and received another account's full row (account name, balances,
  ownership type) - a genuine cross-user data exposure, same severity
  class as the original log-journal-entry/metatrader-sync cross-user
  bugs fixed earlier. No real user data existed in this table yet
  (broker_connections was empty pre-launch), so nothing was actually
  exposed to a real attacker, but this was live and exploitable.

  ## Fix
  security_invoker = true makes the view evaluate with the actual
  querying user's privileges, so the real RLS policies on the
  underlying table are enforced per-user again. Verified live: the
  same cross-account query now returns nothing for account B, while
  account A still sees its own row correctly.
*/

ALTER VIEW user_broker_connections SET (security_invoker = true);
