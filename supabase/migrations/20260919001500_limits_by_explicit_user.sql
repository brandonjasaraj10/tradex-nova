/*
  Limit functions that work when there is no logged-in user.

  synced_account_limit() and parked_account_limit() read auth.uid(). That is
  right for a browser calling them through RLS, and wrong for an edge
  function holding the service-role key, where auth.uid() is null - the tier
  then resolves to nothing and every allowance comes back 0.

  Which is not a harmless zero. broker-api trims parked accounts down to the
  plan's allowance after pausing one, so a limit of 0 meant it immediately
  released the account it had just parked - deleting it at MetaApi and
  turning a free reconnect into a $2.10 one. Caught on the first real pause:
  a Pro subscriber's account came back with metaapi_account_id null.

  The same null would have made resuming impossible, since the slot check
  would have said "automatic syncing needs an active subscription" to
  somebody who has one.

  So each limit gets a _for(uuid) variant that takes the user explicitly,
  and the auth.uid() version becomes a wrapper. One rule, two ways in - the
  same shape subscription_tier_for() already uses, for the same reason.
*/

CREATE OR REPLACE FUNCTION public.synced_account_limit_for(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 10
    ELSE CASE public.subscription_tier_for(p_user_id)
      WHEN 'starter' THEN 1
      WHEN 'pro'     THEN 2
      WHEN 'elite'   THEN 5
      ELSE 0
    END
  END;
$$;

CREATE OR REPLACE FUNCTION public.parked_account_limit_for(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 30
    ELSE CASE public.subscription_tier_for(p_user_id)
      WHEN 'starter' THEN 3
      WHEN 'pro'     THEN 6
      WHEN 'elite'   THEN 15
      ELSE 0
    END
  END;
$$;

/* The browser-facing versions now defer, so the numbers cannot diverge. */
CREATE OR REPLACE FUNCTION public.synced_account_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_tradex_admin() THEN 10
    ELSE public.synced_account_limit_for(auth.uid())
  END;
$$;

CREATE OR REPLACE FUNCTION public.parked_account_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_tradex_admin() THEN 30
    ELSE public.parked_account_limit_for(auth.uid())
  END;
$$;
