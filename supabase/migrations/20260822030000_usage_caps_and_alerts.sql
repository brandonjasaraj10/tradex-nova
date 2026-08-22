/*
  Safety caps on per-user storage and trading accounts, plus an internal
  record whenever someone reaches one.

  These are SAFETY limits, not product tiers. A normal user should never
  meet them; they exist so one account cannot fill the project's storage
  quota and break uploads for everybody else. Real tiered limits are a
  product decision that needs actual usage data, which does not exist yet
  with a handful of users.

  Sized against measured reality rather than guessed:
    - real screenshots here are 0.18-1.2 MB, averaging ~0.5 MB, so 500 MB
      is roughly 1,000 screenshots - about 18 months of journalling with
      two a day.
    - traders typically run 1-3 accounts; prop-firm users maybe 5. Ten is
      double the realistic ceiling.

  Enforced with database triggers rather than checks in the app, because
  the app can be bypassed - a user with their own access token can POST to
  the REST API directly. The same reason the founder pricing gate lives in
  the database.
*/

-- Per-user ceilings, in one place so they are easy to raise later.
CREATE TABLE IF NOT EXISTS public.usage_limits (
  key text PRIMARY KEY,
  value bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.usage_limits (key, value) VALUES
  ('max_storage_bytes_per_user', 524288000),  -- 500 MB
  ('max_accounts_per_user', 10)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;
-- No policies: readable only by service_role and SECURITY DEFINER functions.
-- Users never need to query their own ceiling directly.

/*
  Every time somebody is stopped by a cap, record it. This is the internal
  signal: if these rows start appearing, either someone is abusing the
  service or - more likely and more useful - the caps are set too low and
  a real user is being blocked.
*/
CREATE TABLE IF NOT EXISTS public.usage_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  attempted bigint,
  ceiling bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_limit_events_recent_idx
  ON public.usage_limit_events (created_at DESC);

ALTER TABLE public.usage_limit_events ENABLE ROW LEVEL SECURITY;
-- No policies: internal only, same as usage_limits above.

CREATE OR REPLACE FUNCTION public.get_usage_limit(p_key text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.usage_limits WHERE key = p_key;
$$;

/*
  Storage cap. Runs before a file lands, sums what the user already has in
  the bucket, and refuses the insert if this file would take them over.

  The owning user is read from the first path segment, which is how uploads
  are namespaced ({user_id}/{timestamp}.{ext}) and what the bucket's RLS
  policies already rely on.
*/
CREATE OR REPLACE FUNCTION public.enforce_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_used bigint;
  v_incoming bigint;
  v_limit bigint;
BEGIN
  IF NEW.bucket_id <> 'journal-screenshots' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_user := ((storage.foldername(NEW.name))[1])::uuid;
  EXCEPTION WHEN others THEN
    -- Not a user-namespaced path; leave it to the RLS policies to reject.
    RETURN NEW;
  END;

  v_limit := public.get_usage_limit('max_storage_bytes_per_user');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(sum((metadata->>'size')::bigint), 0) INTO v_used
  FROM storage.objects
  WHERE bucket_id = 'journal-screenshots'
    AND (storage.foldername(name))[1] = v_user::text;

  v_incoming := coalesce((NEW.metadata->>'size')::bigint, 0);

  IF v_used + v_incoming > v_limit THEN
    INSERT INTO public.usage_limit_events (user_id, limit_key, attempted, ceiling)
    VALUES (v_user, 'max_storage_bytes_per_user', v_used + v_incoming, v_limit);

    RAISE EXCEPTION 'Storage limit reached. You have used % MB of your % MB. Delete some screenshots to free up space.',
      round(v_used / 1048576.0, 1), round(v_limit / 1048576.0, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_storage_quota_trigger ON storage.objects;
CREATE TRIGGER enforce_storage_quota_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota();

/*
  Trading account cap, on the underlying table rather than the
  user_broker_connections view, so it holds however the row arrives.
*/
CREATE OR REPLACE FUNCTION public.enforce_account_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count bigint;
  v_limit bigint;
BEGIN
  v_limit := public.get_usage_limit('max_accounts_per_user');
  IF v_limit IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.broker_connections
  WHERE user_id = NEW.user_id;

  IF v_count >= v_limit THEN
    INSERT INTO public.usage_limit_events (user_id, limit_key, attempted, ceiling)
    VALUES (NEW.user_id, 'max_accounts_per_user', v_count + 1, v_limit);

    RAISE EXCEPTION 'Account limit reached. You can have up to % trading accounts. Remove one to add another.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_account_quota_trigger ON public.broker_connections;
CREATE TRIGGER enforce_account_quota_trigger
  BEFORE INSERT ON public.broker_connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_account_quota();
