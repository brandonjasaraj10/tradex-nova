import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { action } = await req.json();

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

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, Helvetica, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5;">
            <tr>
              <td align="center" style="padding: 20px 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px;">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <h1 style="margin: 0; font-size: 32px; font-weight: bold; color: #1a1a1a;">TradeX</h1>
                    </td>
                  </tr>
                  <!-- Main Content Card -->
                  <tr>
                    <td>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #1a1a1a; border-radius: 12px;">
                        <tr>
                          <td style="padding: 30px;">
                            <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: bold; color: #ffffff;">Subscription Cancellation Confirmed</h2>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a0a0a0;">Hi ${firstName},</p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a0a0a0;">We're sorry to see you go. Your TradeX Pro subscription has been scheduled for cancellation.</p>

                            <!-- Info Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="padding: 20px 0;">
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #000000; border-radius: 8px; border: 1px solid #3B82F6;">
                                    <tr>
                                      <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #a0a0a0;">Your subscription will remain active until:</p>
                                        <p style="margin: 0; font-size: 20px; font-weight: bold; color: #3B82F6;">${formattedCancelDate}</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a0a0a0;">You'll continue to have full access to all TradeX Pro features until then, including:</p>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #10b981; font-size: 18px; margin-right: 8px;">✓</span>
                                  <span style="color: #ffffff; font-size: 14px;">Unlimited broker connections</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #10b981; font-size: 18px; margin-right: 8px;">✓</span>
                                  <span style="color: #ffffff; font-size: 14px;">Advanced analytics and reports</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #10b981; font-size: 18px; margin-right: 8px;">✓</span>
                                  <span style="color: #ffffff; font-size: 14px;">Nova AI assistant</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #10b981; font-size: 18px; margin-right: 8px;">✓</span>
                                  <span style="color: #ffffff; font-size: 14px;">Priority support</span>
                                </td>
                              </tr>
                            </table>

                            <p style="margin: 25px 0 20px 0; font-size: 16px; line-height: 1.5; color: #a0a0a0;">Changed your mind? You can reactivate your subscription anytime from your account settings.</p>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" style="padding: 20px 0;">
                                  <a href="https://tradexnova.com/settings" style="display: inline-block; padding: 12px 30px; background-color: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Manage Subscription</a>
                                </td>
                              </tr>
                            </table>

                            <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.5; color: #666666;">If you have any questions or feedback, we'd love to hear from you. Reply to this email or contact our support team.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding: 25px 0 10px 0;">
                      <p style="margin: 0; font-size: 12px; color: #666666;">TradeX - Your personal AI Trading Assistant & Journal</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 0 20px 0;">
                      <p style="margin: 0; font-size: 11px; color: #999999;">This is an automated message. Please do not reply to this email.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

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
