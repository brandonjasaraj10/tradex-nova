import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ADDON_PRICE_IDS, addonPriceIdForInterval, syncSubscription } from "../_shared/subscriptionSync.ts";

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
        Written back here rather than left to the webhook. The member is
        sitting on the connect screen waiting to use what they just bought,
        and customer.subscription.updated can take a few seconds. The webhook
        still fires and writes the same thing - this makes it immediate, not
        authoritative.
      */
      const fresh = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(supabase, user.id, fresh);

      return new Response(
        JSON.stringify({ success: true, extraAccounts: wanted, interval }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
