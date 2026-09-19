import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
/*
  Deliberately not importing from ../_shared/subscriptionSync.ts.

  That module is 545 lines and this function needs three small things from it.
  Deploying it alongside means hand-copying it into the deploy call, which is
  precisely how this project's production copy drifted from its repo twice in
  one night. Fewer lines crossing that gap is fewer chances to get it wrong.

  The two price ids below therefore exist in two places. They must agree with
  ADDON_PRICE_IDS in ../_shared/subscriptionSync.ts - if one of them ever
  changes, change both. Two constants duplicated with a note is a smaller risk
  than five hundred lines retyped.
*/
const ADDON_PRICE_IDS = new Set([
  "price_1UHFqeP9mqFWeYrvvBoTx41L",  /* $19.00 / month */
  "price_1UHFrKP9mqFWeYrvfsljAgP3",  /* $190.00 / year */
]);

function addonPriceIdForInterval(interval: string | null | undefined): string {
  return interval === "year"
    ? "price_1UHFrKP9mqFWeYrvfsljAgP3"
    : "price_1UHFqeP9mqFWeYrvvBoTx41L";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  appInfo: {
    name: "TradeX",
    version: "1.0.0",
  },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, quantity: requested } = await req.json();

    if (action === "create_portal_session") {
      let stripeCustomerId: string | null = null;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id;
      } else {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (subscription?.stripe_customer_id) {
          stripeCustomerId = subscription.stripe_customer_id;
        }
      }

      if (!stripeCustomerId) {
        return new Response(
          JSON.stringify({ error: "No Stripe customer found. Please subscribe first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${req.headers.get("origin") || "https://tradexnova.com"}/settings`,
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cancel_subscription") {
      let stripeCustomerId: string | null = null;
      let firstName = "Valued Customer";

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("stripe_customer_id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id;
        firstName = profile.first_name || firstName;
      } else {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (subscription?.stripe_customer_id) {
          stripeCustomerId = subscription.stripe_customer_id;
        }

        if (profile?.first_name) {
          firstName = profile.first_name;
        }
      }

      if (!stripeCustomerId) {
        return new Response(
          JSON.stringify({ error: "No Stripe customer found. Please subscribe first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 5,
      });

      // "active" alone misses subscriptions still in their 7-day trial
      // (Stripe status "trialing") or with a failed payment ("past_due")
      // - both are still real, cancellable subscriptions.
      const subscription = subscriptions.data.find((s) =>
        ["active", "trialing", "past_due"].includes(s.status)
      );

      if (!subscription) {
        return new Response(
          JSON.stringify({ error: "No active subscription found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });

      const cancelDate = new Date(subscription.current_period_end * 1000);
      const formattedCancelDate = cancelDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      /*
        Same template as the welcome and password-reset emails.

        This one still used the original dark design - #1a1a1a panels on
        #f5f5f5 - written before the Gmail dark-mode work. Gmail's mobile app
        inverts on its own heuristics and ignores colour-scheme entirely, so
        that version flipped into colours nobody chose, and it looked like a
        different company from every other email TradeX sends. Every colour
        here is a mid-tone that stays itself either way, and the logo is drawn
        in table cells so it still arrives branded when images are blocked.
      */
      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">

          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 4px;">
                    <div style="width: 4px; height: 22px; background-color: #3B82F6; border-radius: 2px; font-size: 0; line-height: 22px;">&nbsp;</div>
                  </td>
                  <td valign="middle" style="padding-right: 4px;">
                    <div style="width: 4px; height: 30px; background-color: #3B82F6; border-radius: 2px; font-size: 0; line-height: 30px;">&nbsp;</div>
                  </td>
                  <td valign="middle" style="padding-right: 12px;">
                    <div style="width: 4px; height: 14px; background-color: #3B82F6; border-radius: 2px; font-size: 0; line-height: 14px;">&nbsp;</div>
                  </td>
                  <td valign="middle">
                    <span style="font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: #111111;">TradeX</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e2e2; border-radius: 14px;">
                <tr>
                  <td style="padding: 36px 32px;">
                    <h1 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">Your subscription is cancelled</h1>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #555555;">${firstName}, that&rsquo;s done &mdash; you won&rsquo;t be charged again.</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color: #f4f8ff; border: 1px solid #3B82F6; border-radius: 10px; padding: 20px;">
                          <p style="margin: 0 0 4px 0; font-size: 13px; color: #555555;">You keep full access until</p>
                          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #3B82F6;">${formattedCancelDate}</p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0 0; font-size: 15px; line-height: 1.6; color: #555555;">Nothing is deleted. Your trades, journal entries and notes stay exactly where they are, so if you come back it is all still here.</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px;">
                      <tr>
                        <td align="center" style="background-color: #3B82F6; border-radius: 10px;">
                          <a href="https://tradexnova.com/settings" style="display: block; padding: 15px 24px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Resubscribe anytime</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #555555;">If something pushed you away, we&rsquo;d genuinely like to know &mdash; just reply to this email.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 28px 0 0 0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #555555;">TradeX &mdash; your AI trading journal</p>
              <p style="margin: 0; font-size: 12px; color: #777777;">You&rsquo;re getting this because you cancelled a TradeX subscription.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const resendApiKey = Deno.env.get("RESEND_API_KEY");

      if (resendApiKey) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "TradeX <noreply@tradexnova.com>",
              to: [user.email],
              // The email asks why they left and invites a reply, so replies
              // have to reach a person - noreply would make that an empty
              // gesture, and a cancellation is the one moment the answer is
              // worth having.
              reply_to: ["tradenovaai@gmail.com"],
              subject: "Your TradeX Subscription Has Been Cancelled",
              html: emailHtml,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error("Resend API error:", errorText);
          }
        } catch (emailErr) {
          console.error("Failed to send email via Resend:", emailErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription cancelled successfully",
          cancel_at: formattedCancelDate,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /*
      Buy, change or drop extra synced accounts.

      The quantity is absolute, not a delta - "I want three" rather than "add
      one". Two reasons. A double-tapped button cannot silently sell somebody
      a fourth account, because sending 3 twice still means 3. And the number
      the user is looking at on screen is the number they send, so the screen
      and Stripe cannot drift apart through a dropped response.
    */
    if (action === "set_extra_accounts") {
      const wanted = Math.floor(Number(requested ?? NaN));
      if (!Number.isFinite(wanted) || wanted < 0 || wanted > 50) {
        return new Response(
          JSON.stringify({ error: "That is not a number of accounts we can set." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: row } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const subscriptionId = (row as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: "You need a subscription before you can add accounts to it." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      /*
        Refuse on anything that is not actually live. Adding a paid line to a
        past_due subscription bills somebody whose card is already failing,
        and a canceled one would host an account nobody is paying for.
      */
      if (!["active", "trialing"].includes(subscription.status)) {
        return new Response(
          JSON.stringify({ error: "Your subscription needs to be active before you can add accounts." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
        And refuse during the trial, which is the one that would have taken
        real money for nothing.

        Trials do not sync at all - synced_account_limit_for() returns 0 for
        a trialing subscription before it ever adds extras on. So somebody on
        a trial who bought an add-on would have paid $19 and still had an
        allowance of zero. The limit panel was reachable from the trial and
        offered exactly that.

        There is nothing to sell here. What they want is the subscription
        itself, which start_subscription_now below gives them in one step.
      */
      if (subscription.status === "trialing") {
        return new Response(
          JSON.stringify({
            error: "Extra accounts are for subscribers. Start your subscription and syncing turns on straight away.",
            needsSubscription: true,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
        The add-on has to match the interval the member is already billed on.
        Stripe rejects a subscription holding two intervals unless the account
        is in flexible billing mode, which this SDK version predates. Picking
        it from the plan item rather than asking the user means the choice
        cannot be got wrong.
      */
      const planLine = subscription.items.data.find(
        (i) => !ADDON_PRICE_IDS.has(i.price?.id ?? "")
      ) ?? subscription.items.data[0];
      const interval = planLine?.price?.recurring?.interval ?? "month";
      const addonPriceId = addonPriceIdForInterval(interval);

      const existing = subscription.items.data.find(
        (i) => ADDON_PRICE_IDS.has(i.price?.id ?? "")
      );

      /*
        What it was before, so a declined card can be put back exactly as it
        was. Without this a failed payment leaves a $19 line on the
        subscription that Stripe goes on dunning and that inflates their next
        invoice - charging somebody monthly for something they were told they
        had not bought.
      */
      const previousQuantity = existing?.quantity ?? 0;

      /*
        always_invoice rather than create_prorations: the member gets the
        account the moment this returns, so the prorated charge should land
        now too. Deferring it to the next cycle means hosting an account for
        up to a month before finding out the card does not work.
      */
      if (wanted === 0 && existing) {
        await stripe.subscriptionItems.del(existing.id, { proration_behavior: "always_invoice" });
      } else if (wanted > 0 && existing) {
        await stripe.subscriptionItems.update(existing.id, {
          quantity: wanted,
          proration_behavior: "always_invoice",
        });
      } else if (wanted > 0) {
        await stripe.subscriptionItems.create({
          subscription: subscriptionId,
          price: addonPriceId,
          quantity: wanted,
          proration_behavior: "always_invoice",
        });
      }

      /*
        Whether the money actually arrived.

        always_invoice bills immediately, and "immediately" has three
        outcomes, not one: paid, declined, or held pending 3-D Secure - which
        is routine on European cards and on plenty of others under SCA. The
        first version of this treated the Stripe call returning without
        throwing as success, which would have handed somebody an allowance
        against an invoice that was never paid, and left them syncing an
        account at $8.64 a month on our side while their bank waited for a
        tap they were never asked for.

        The invoice is read back and its state decides what the caller is
        told. requires_action carries the client secret so the card can be
        confirmed in place - the only genuinely embedded part of this, and it
        appears only when the bank asks for it rather than on every purchase.
      */
      let payment: { status: string; clientSecret?: string; hostedInvoiceUrl?: string } = {
        status: "paid",
      };
      /* Kept so a declined invoice can be voided rather than left to dun. */
      let openInvoiceId: string | null = null;

      if (wanted > 0) {
        try {
          const invoices = await stripe.invoices.list({
            subscription: subscriptionId,
            limit: 1,
          });
          const invoice = invoices.data[0];
          if (invoice && invoice.status !== "paid" && invoice.status !== "draft") {
            const intentId = typeof invoice.payment_intent === "string"
              ? invoice.payment_intent
              : invoice.payment_intent?.id;
            if (intentId) {
              const intent = await stripe.paymentIntents.retrieve(intentId);
              if (intent.status === "requires_action" || intent.status === "requires_confirmation") {
                payment = {
                  status: "requires_action",
                  clientSecret: intent.client_secret ?? undefined,
                  hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
                };
              } else if (intent.status !== "succeeded") {
                payment = {
                  status: "failed",
                  hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
                };
                openInvoiceId = invoice.id ?? null;
              }
            }
          }
        } catch (err) {
          /*
            Never fails the request. The subscription item change has already
            happened in Stripe, which is the source of truth; not being able
            to read the invoice back is a reporting problem, and the webhook
            reconciles either way.
          */
          console.error("Could not read the add-on invoice back for", user.id, err);
        }
      }

      /*
        A declined card is put back the way it was.

        The subscription item already exists in Stripe at this point - that is
        what generated the invoice. Leaving it there after a decline would
        mean a $19 line Stripe goes on dunning, and a bigger invoice next
        month, for something the member has just been told they did not buy.
        So the change is undone rather than left hanging.
      */
      if (payment.status === "failed") {
        /*
          Void the invoice before anything else.

          Removing the line item is not enough on its own. always_invoice
          raises a real invoice and attempts it immediately; when that fails
          the invoice stays OPEN, and Stripe's automatic retries go on
          chasing it for days. Worse, enough failed attempts move the whole
          subscription to past_due - which, under this app's no-grace-period
          rule, ends every bit of their access. Losing a journal over a $19
          add-on they were told had been declined is not a trade anyone would
          accept.

          Voided rather than marked uncollectible: nothing was owed, because
          the thing it was for is being removed in the same breath.
        */
        if (openInvoiceId) {
          try {
            await stripe.invoices.voidInvoice(openInvoiceId);
          } catch (err) {
            console.error("Could not void the declined add-on invoice", openInvoiceId, err);
          }
        }

        try {
          const failedItem = (await stripe.subscriptions.retrieve(subscriptionId))
            .items.data.find((i) => ADDON_PRICE_IDS.has(i.price?.id ?? ""));
          if (failedItem) {
            if (previousQuantity === 0) {
              await stripe.subscriptionItems.del(failedItem.id, { proration_behavior: "none" });
            } else {
              await stripe.subscriptionItems.update(failedItem.id, {
                quantity: previousQuantity,
                proration_behavior: "none",
              });
            }
          }
        } catch (err) {
          console.error("Could not undo the add-on after a declined card for", user.id, err);
        }

        return new Response(
          JSON.stringify({ success: false, error: "Your card was declined.", payment }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
        Nothing is granted until the money is actually in.

        This used to write the allowance whatever the invoice said. The
        frontend refused to report success on a decline, but the allowance had
        already gone up in the database - so dismissing the panel and pressing
        connect again would have handed over an account nobody paid for, at
        $8.64 a month of our money. The check above decided the payment; this
        is where that decision is allowed to mean something.

        requires_action is not a grant either. The bank is still holding the
        charge pending 3-D Secure, and the member confirms it in the page;
        the frontend then calls this action again with the same quantity,
        which is idempotent, finds the invoice paid, and lands here.
      */
      if (payment.status !== "paid") {
        return new Response(
          JSON.stringify({ success: false, pending: true, extraAccounts: wanted, interval, payment }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
        Paid. Written straight back rather than left to the webhook, because
        the member is sitting on the connect screen waiting to use what they
        just bought and customer.subscription.updated can take a few seconds.
        The webhook still runs the real sync over the top - this is the fast
        path, not the authority.
      */
      const fresh = await stripe.subscriptions.retrieve(subscriptionId);
      const quantityNow = fresh.items.data.find(
        (i) => ADDON_PRICE_IDS.has(i.price?.id ?? "")
      )?.quantity ?? 0;

      const { error: writeError } = await supabase
        .from("subscriptions")
        .update({
          extra_synced_accounts: Math.max(0, Math.min(50, quantityNow)),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (writeError) {
        /*
          The money is in and the webhook will correct the row within seconds,
          so this is not a failure of the purchase - but the member may
          briefly not see what they paid for, and that is worth knowing about
          if it ever becomes common.
        */
        console.error("Add-on paid for but the allowance write failed for", user.id, writeError);
      }

      return new Response(
        JSON.stringify({ success: true, extraAccounts: wanted, interval, payment }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /*
      End the trial now and start paying.

      Syncing is the one thing a trial does not include, so somebody who
      wants their trades arriving tonight needs the subscription rather than
      the remaining two days. Without this their only option was to wait -
      which is a strange thing to make a person do when they are trying to
      give you money.

      trial_end: 'now' is Stripe's own way of doing this: it closes the trial,
      raises the first invoice immediately and moves the subscription to
      active. The webhook then writes the new status, and the allowance
      follows from that without anything here having to touch it.
    */
    if (action === "start_subscription_now") {
      const { data: row } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const subscriptionId = (row as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: "You do not have a subscription to start." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.status === "active") {
        return new Response(
          JSON.stringify({ success: true, alreadyActive: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (subscription.status !== "trialing") {
        return new Response(
          JSON.stringify({ error: "There is no trial to end on this subscription." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const started = await stripe.subscriptions.update(subscriptionId, {
        trial_end: "now",
        proration_behavior: "none",
      });

      /*
        Written straight back for the same reason the add-on is: they are
        sitting on the connect screen waiting to use what they just paid for,
        and the webhook takes a few seconds. It runs afterwards and writes
        the same thing.

        If the card fails here Stripe moves them to past_due rather than
        active, and that status is what lands - so a failed charge cannot
        leave somebody looking subscribed.
      */
      const { error: writeError } = await supabase
        .from("subscriptions")
        .update({
          status: started.status,
          current_period_start: new Date(started.current_period_start * 1000).toISOString(),
          current_period_end: new Date(started.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (writeError) {
        console.error("Trial ended but the status write failed for", user.id, writeError);
      }

      return new Response(
        JSON.stringify({
          success: started.status === "active",
          status: started.status,
          error: started.status === "active"
            ? undefined
            : "Your card did not go through, so the subscription has not started. Update it in Settings and try again.",
        }),
        { status: started.status === "active" ? 200 : 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Subscription management error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
