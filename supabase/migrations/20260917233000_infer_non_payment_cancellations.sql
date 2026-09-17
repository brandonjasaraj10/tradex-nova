/*
  A second way of knowing a cancellation was for non-payment, in case the
  first one is not running yet.

  subscriptionSync now stores Stripe's own cancellation_details.reason, which
  is the real answer. But that only starts arriving once the edge functions
  carrying it are deployed, and the seventeen subscriptions currently in
  past_due will finish Stripe's retry schedule on their own timetable. If a
  cancellation lands before that deploy does, the reason is null, null reads
  as voluntary, and the wind-down hands out access nobody paid for - a year
  of it on the ten annual plans.

  The database can tell without Stripe's help. A subscription only enters
  past_due because a payment failed, so past_due -> canceled is a dunning
  cancellation by definition. A voluntary cancellation goes active ->
  canceled and never passes through past_due, so it cannot be caught here.

  Only fills a reason that is missing. Anything Stripe actually told us wins,
  including a cancellation_requested from somebody who cancelled while their
  card happened to be failing - they asked, and that is the more specific
  truth.
*/

CREATE OR REPLACE FUNCTION public.mark_dunning_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'past_due'
     AND NEW.status = 'canceled'
     AND NEW.cancellation_reason IS NULL
  THEN
    NEW.cancellation_reason := 'payment_failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_dunning_cancellation_trigger ON subscriptions;

CREATE TRIGGER mark_dunning_cancellation_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.mark_dunning_cancellation();
