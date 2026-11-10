/*
  Background jobs could be started by anyone on the internet.

  These ten functions are only meant to run on the cron schedule (as the
  postgres owner), but they kept Postgres's default EXECUTE for everyone, so
  /rest/v1/rpc/<name> let any visitor - signed in or not - fire them at will:
  broker sync (paid MetaApi calls), MetaApi and subscription reconciliation,
  trial card checks, the abandoned-signup emails and in-app nudges. Nothing
  leaked, but it was a lever for cost and for spamming users.

  Nothing in the app calls them directly (checked); cron keeps working
  because it runs as the owner, which this does not touch.

  Undo: GRANT EXECUTE ON FUNCTION <name>() TO anon, authenticated;
*/
REVOKE EXECUTE ON FUNCTION public.trigger_abandon_signup_emails() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_broker_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_metaapi_reconcile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_subscription_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_trial_card_verification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_adherence_trend() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_unreviewed_trades() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_usage_thresholds() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reset_codes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_password_reset_requests() FROM PUBLIC, anon, authenticated;
