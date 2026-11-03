/*
  Users could write their own subscription row.

  "Users can insert own subscription" and "Users can update own subscription"
  let any logged-in account create or edit its row in `subscriptions`, so a
  browser console was enough to set status 'active' and a far-future
  current_period_end. has_active_subscription() reads exactly that row, which
  made every paywalled table reachable without paying. Found on 2026-10-31
  after two accounts granted themselves Pro and lifetime access on 2026-10-29.

  Every legitimate write already goes through edge functions with the service
  role key (stripe-webhook, manage-subscription, verify-trial-card,
  reconcile-subscriptions, delete-account), which bypasses RLS. The frontend
  only ever reads this table. So users keep SELECT and lose INSERT/UPDATE.

  The two self-granted rows are ended here too: status 'canceled' alone is not
  enough, because has_active_subscription() still honours a canceled row whose
  current_period_end is in the future.
*/

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

UPDATE public.subscriptions s
SET status = 'canceled',
    current_period_end = now(),
    cancel_at_period_end = false,
    cancellation_reason = 'self_granted_revoked',
    updated_at = now()
FROM auth.users u
WHERE u.id = s.user_id
  AND s.stripe_subscription_id IS NULL
  AND u.email IN ('test1111@gmail.com', 'rawghost0@proton.me');
