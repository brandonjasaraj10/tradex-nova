/*
  Prove a trial's card can actually pay, before the trial runs.

  Stripe validates a collected card for $0. That proves the number is real and
  the account exists; it proves nothing about whether there is money behind it.
  The last trial cohort is what that costs: of 22 people who started a 7-day
  trial, 17 never reached a successful charge. Not people deciding against it -
  dead cards, prepaid cards, cards with nothing on them. Research puts a
  card-required auto-converting trial at 35-55% conversion. That one managed
  14%, and the gap is almost entirely those 17.

  So the card is authorised for the REAL subscription amount and released a
  moment later. The bank decides against the actual available balance, which is
  the only question that matters, and it is the same question that will be
  asked on day three.

  A decline cancels the trial there and then. That reads harsh written down and
  is much kinder in practice: the alternative is three days of using something
  that was always going to be taken away, ending in a failed-payment email.

  Called twice on purpose:

    - by the browser the moment somebody lands back from checkout, so a
      decline can be shown while they are still there and able to fix it;
    - by a nightly sweep, for anyone who closed the tab first.

  trial_card_verified_at makes the second call a no-op rather than a second
  hold on the same card.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Cron-Secret",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  appInfo: { name: "TradeX", version: "1.0.0" },
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Outcome = {
  userId: string;
  result: "verified" | "declined" | "skipped" | "error";
  detail?: string;
};

/*
  One trial, one card, one authorisation.

  Everything here is written to be safe to run twice. The
  trial_card_verified_at check at the top is the real guard; the rest simply
  does nothing surprising if it is reached again.
*/
async function verifyOne(userId: string): Promise<Outcome> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, stripe_subscription_id, stripe_customer_id, trial_card_verified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { userId, result: "error", detail: error.message };

  const row = data as {
    status: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    trial_card_verified_at: string | null;
  } | null;

  if (!row) return { userId, result: "skipped", detail: "no subscription row" };
  if (row.status !== "trialing") return { userId, result: "skipped", detail: `status ${row.status}` };
  if (row.trial_card_verified_at) return { userId, result: "skipped", detail: "already verified" };
  if (!row.stripe_subscription_id) return { userId, result: "skipped", detail: "no stripe subscription" };

  const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
    expand: ["default_payment_method", "customer"],
  });

  /*
    The amount that will actually be charged when the trial ends, taken from
    the subscription's own line items rather than assumed. A member who took
    Elite annually must be tested against $999.90, not against a number this
    file happens to know.
  */
  const amount = subscription.items.data.reduce(
    (sum, item) => sum + ((item.price?.unit_amount ?? 0) * (item.quantity ?? 1)),
    0,
  );
  const currency = subscription.items.data[0]?.price?.currency ?? "usd";

  if (amount <= 0) return { userId, result: "skipped", detail: "nothing to authorise" };

  /*
    Stripe falls back to the customer's default payment method when the
    subscription has none of its own, which is the ordinary case straight out
    of Checkout.
  */
  const pmFromSub = typeof subscription.default_payment_method === "string"
    ? subscription.default_payment_method
    : subscription.default_payment_method?.id;

  const customer = subscription.customer;
  const pmFromCustomer = typeof customer === "string"
    ? undefined
    : (customer as Stripe.Customer)?.invoice_settings?.default_payment_method as string | undefined;

  const paymentMethod = pmFromSub ?? pmFromCustomer;
  const customerId = typeof customer === "string" ? customer : customer?.id ?? row.stripe_customer_id;

  if (!paymentMethod || !customerId) {
    return { userId, result: "skipped", detail: "no card on file yet" };
  }

  let intent: Stripe.PaymentIntent | null = null;
  try {
    intent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method: paymentMethod,
      /*
        The hold, not a charge. Authorising reserves the money against their
        balance and asks the bank the one question worth asking; capturing it
        would be taking the money, which is not what a trial is.
      */
      capture_method: "manual",
      confirm: true,
      off_session: true,
      description: "TradeX trial card check - released immediately",
      metadata: { supabase_user_id: userId, purpose: "trial_card_check" },
    });
  } catch (err) {
    /*
      A decline arrives as a thrown CardError rather than a status, so this
      branch is the common failure and not an exceptional one.
    */
    const detail = err instanceof Error ? err.message : "card was declined";
    try {
      await stripe.subscriptions.cancel(row.stripe_subscription_id);
    } catch (cancelErr) {
      console.error("Could not cancel the trial after a declined card for", userId, cancelErr);
    }

    /*
      Record WHY, here, rather than letting the webhook infer it.

      has_active_subscription() keeps a cancelled member in until their period
      ends - which is right for somebody who chose to leave - and only cuts
      access immediately when cancellation_reason says the money failed. This
      branch used to cancel in Stripe and write nothing, leaving the reason to
      arrive from the webhook. Stripe reports an API cancellation as
      "cancellation_requested", never "payment_failed", so the reason came
      back null, the guard never fired, and a declined trial kept full paid
      access for the rest of its window.

      Seen live: a $299.90 annual card check failed twice, Stripe showed no
      subscription and no spend, and the account still had access for three
      more days.

      Written directly because this code is the only place that knows the
      cancellation was a decline. Not conditional on the Stripe cancel above
      succeeding - if that call failed the card still declined, and the access
      guard matters more than the two staying in step.
    */
    const { error: reasonErr } = await admin
      .from("subscriptions")
      .update({
        status: "canceled",
        cancellation_reason: "payment_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (reasonErr) {
      console.error("Could not record payment_failed for", userId, reasonErr);
    }

    console.info("Trial card declined for", userId, detail);
    return { userId, result: "declined", detail };
  }

  /*
    Released straight away. The hold shows on their statement as pending for a
    few days whatever we do - banks drop it on their own schedule - but
    cancelling now means we are never holding money we have no claim to.
  */
  try {
    if (intent && intent.status === "requires_capture") {
      await stripe.paymentIntents.cancel(intent.id);
    } else if (intent && intent.status !== "succeeded") {
      /*
        requires_action means the bank wants 3-D Secure, which cannot be done
        off-session. Not treated as a decline: the card may be perfectly good
        and we simply cannot ask here. The trial is allowed to proceed and the
        charge on day three will do the asking properly, on-session.
      */
      await stripe.paymentIntents.cancel(intent.id).catch(() => {});
      await admin
        .from("subscriptions")
        .update({ trial_card_verified_at: new Date().toISOString() })
        .eq("user_id", userId);
      return { userId, result: "skipped", detail: `needs 3DS (${intent.status}) - allowed through` };
    }
  } catch (err) {
    console.error("Could not release the trial hold for", userId, err);
  }

  await admin
    .from("subscriptions")
    .update({ trial_card_verified_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { userId, result: "verified" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    /*
      The sweep. Same work, for everyone whose browser never made the call -
      closed the tab, lost connection, went to make a coffee.
    */
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("X-Cron-Secret") === cronSecret) {
      const { data } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("status", "trialing")
        .is("trial_card_verified_at", null);

      const rows = (data ?? []) as { user_id: string }[];
      const results: Outcome[] = [];
      for (const r of rows) {
        try {
          results.push(await verifyOne(r.user_id));
        } catch (err) {
          results.push({
            userId: r.user_id,
            result: "error",
            detail: err instanceof Error ? err.message : "unknown",
          });
        }
      }
      return json({ swept: rows.length, results });
    }

    /*
      The ordinary path: the member's own browser, right after checkout. Their
      token decides whose trial is checked, so nobody can aim this at anyone
      else's card.
    */
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const { data: { user }, error: authError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const outcome = await verifyOne(user.id);

    if (outcome.result === "declined") {
      return json({
        ok: false,
        declined: true,
        error:
          "Your bank would not authorise the card, so the trial has not started. Nothing has been charged. Try another card and you can start straight away.",
      }, 402);
    }

    return json({ ok: true, result: outcome.result });
  } catch (error) {
    console.error("verify-trial-card failed:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
