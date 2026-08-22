/*
  Internal alerting for usage caps.

  The caps themselves are enforced by triggers, but those triggers cannot
  record anything: they end in RAISE EXCEPTION, which rolls the whole
  transaction back - including any audit row written moments earlier.
  Postgres has no autonomous transactions, so an INSERT there is dead code
  that silently never persists. Verified: blocking an insert produced no
  event row at all. Those INSERTs are removed below rather than left
  looking like they work.

  Instead this runs on a schedule and reports users APPROACHING a cap, at
  80%, as well as any already at it. Warning before somebody is blocked is
  more useful than a record written after they have been - it leaves room
  to raise the ceiling before a real user hits a wall, which is the far
  more likely reason these ever fire.
*/

-- Triggers enforce; they no longer pretend to log.
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
    RAISE EXCEPTION 'Storage limit reached. You have used % MB of your % MB. Delete some screenshots to free up space.',
      round(v_used / 1048576.0, 1), round(v_limit / 1048576.0, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

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
    RAISE EXCEPTION 'Account limit reached. You can have up to % trading accounts. Remove one to add another.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

/*
  Scheduled sweep. Records anyone at or above 80% of either cap and tells
  the owner in-app, reusing the notifications table the other cron jobs
  already deliver through.

  Deduplicated to one event per user per limit per day, so a user sitting
  at 90% does not generate a notification every single night.
*/
CREATE OR REPLACE FUNCTION public.check_usage_thresholds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_storage_limit bigint := public.get_usage_limit('max_storage_bytes_per_user');
  v_account_limit bigint := public.get_usage_limit('max_accounts_per_user');
  v_owner uuid;
  r record;
  v_pct numeric;
BEGIN
  SELECT id INTO v_owner FROM auth.users
  WHERE lower(email) IN ('brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com')
  ORDER BY created_at LIMIT 1;

  -- storage
  FOR r IN
    SELECT (storage.foldername(name))[1]::uuid AS user_id,
           sum((metadata->>'size')::bigint) AS used
    FROM storage.objects
    WHERE bucket_id = 'journal-screenshots'
    GROUP BY 1
    HAVING sum((metadata->>'size')::bigint) >= (v_storage_limit * 0.8)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.usage_limit_events
      WHERE user_id = r.user_id AND limit_key = 'max_storage_bytes_per_user'
        AND created_at > now() - interval '1 day'
    ) THEN
      INSERT INTO public.usage_limit_events (user_id, limit_key, attempted, ceiling)
      VALUES (r.user_id, 'max_storage_bytes_per_user', r.used, v_storage_limit);

      v_pct := round(100.0 * r.used / v_storage_limit);
      IF v_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (v_owner, 'A user is near their storage limit',
                format('A user is at %s%% of the %s MB screenshot limit (%s MB used). Consider raising the cap.',
                       v_pct, round(v_storage_limit/1048576.0), round(r.used/1048576.0, 1)),
                'warning');
      END IF;
    END IF;
  END LOOP;

  -- trading accounts
  FOR r IN
    SELECT user_id, count(*) AS used
    FROM public.broker_connections
    GROUP BY user_id
    HAVING count(*) >= (v_account_limit * 0.8)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.usage_limit_events
      WHERE user_id = r.user_id AND limit_key = 'max_accounts_per_user'
        AND created_at > now() - interval '1 day'
    ) THEN
      INSERT INTO public.usage_limit_events (user_id, limit_key, attempted, ceiling)
      VALUES (r.user_id, 'max_accounts_per_user', r.used, v_account_limit);

      IF v_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (v_owner, 'A user is near their account limit',
                format('A user has %s of %s allowed trading accounts.', r.used, v_account_limit),
                'warning');
      END IF;
    END IF;
  END LOOP;
END;
$$;

SELECT cron.schedule('check-usage-thresholds', '0 9 * * *', 'SELECT public.check_usage_thresholds();');
