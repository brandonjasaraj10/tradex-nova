import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/*
  The welcome email, sent once when an account is created.

  Called by a Postgres trigger on auth.users rather than from the client, so
  it fires however the account was made - the signup form, Google sign-in, or
  anything added later - and cannot be skipped by closing the tab mid-signup.
  Same shape as the waitlist sync trigger: net.http_post with a shared secret
  in a header, since a trigger has no user JWT to present.
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

const APP_URL = "https://tradexnova.com";
const SUPPORT_EMAIL = "tradenovaai@gmail.com";

/*
  Dark, matching the app rather than sitting against it.

  This was built light on purpose, on the reasoning that Gmail's mobile app
  inverts colours on its own heuristics - so a mid-tone palette that survived
  inversion was safer than a dark one that might be mangled. That was a fair
  bet, but it was only ever a bet: the dark version has now been checked in a
  real Gmail inbox on a phone and holds.

  Two things keep it safe there. Every background carries a bgcolor attribute
  as well as an inline style, because some clients strip styles from body and
  table elements and would otherwise render light text on white. And the logo
  is a real image with white alt text, so a client that blocks remote images
  shows the word TradeX rather than a broken icon on black.
*/
const LOGO_URL = "https://www.tradexnova.com/tradex_logo.png";

function buildWelcomeHtml(): string {
  const step = (n: string, title: string, body: string) => `
    <tr>
      <td style="padding: 0 0 20px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td valign="top" width="30" style="padding-right: 12px;">
              <div style="width: 26px; height: 26px; background-color: #3B82F6; border-radius: 13px; text-align: center; font-size: 13px; line-height: 26px; color: #ffffff; font-weight: 700;">${n}</div>
            </td>
            <td valign="top">
              <p style="margin: 0 0 3px 0; font-size: 15px; font-weight: 600; color: #ffffff;">${title}</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #8b8b8b;">${body}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body bgcolor="#000000" style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">

          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="${LOGO_URL}" width="72" height="72" alt="TradeX"
                   style="display:block;border:0;outline:none;text-decoration:none;color:#ffffff;font-size:22px;font-weight:700;">
            </td>
          </tr>

          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0A0A0A" style="background-color: #0A0A0A; border: 1px solid #1f1f1f; border-radius: 14px;">
                <tr>
                  <td style="padding: 36px 32px;">
                    <h1 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Welcome to TradeX</h1>
                    <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #8b8b8b;">Your account is ready. TradeX is a trading journal with an AI analyst attached &mdash; you log your trades, and Nova tells you what your own numbers actually say.</p>

                    <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #60A5FA; letter-spacing: 0.4px; text-transform: uppercase;">Getting started</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${step("1", "Log a few trades", "Add them by hand or import a CSV from your broker. Nova needs about ten before it can say anything useful about patterns.")}
                      ${step("2", "Ask Nova about them", "Ask &ldquo;how am I doing?&rdquo; in plain English. It reads your real trades &mdash; win rate, profit factor, which days go badly.")}
                      ${step("3", "Write down your rules", "Set your trading rules and confluences, then tick them off per trade. That is what turns a journal into an edge.")}
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 12px;">
                      <tr>
                        <td align="center" bgcolor="#3B82F6" style="background-color: #3B82F6; border-radius: 10px;">
                          <a href="${APP_URL}/dashboard" style="display: block; padding: 15px 24px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Open your dashboard</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #8b8b8b;">Something not working, or not making sense? Reply to this email, or use <span style="color: #ffffff; font-weight: 600;">Settings &rarr; Contact Us</span> inside the app to send us a bug report with a screenshot.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 28px 0 0 0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #8b8b8b;">TradeX &mdash; your AI trading journal</p>
              <p style="margin: 0; font-size: 12px; color: #6b6b6b;">You&rsquo;re getting this because you created a TradeX account.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    /*
      The caller is a database trigger, not a signed-in user, so there is no
      JWT to verify. A shared secret held in internal_config takes its place -
      same arrangement as the waitlist sync. Without this the endpoint would
      let anyone on the internet send TradeX-branded mail to any address.
    */
    const { data: config } = await supabase
      .from("internal_config")
      .select("value")
      .eq("key", "welcome_email_secret")
      .maybeSingle();

    const expectedSecret = config?.value;
    const providedSecret = req.headers.get("X-Webhook-Secret");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const email = (body?.record?.email ?? "").trim();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "No email on the record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY missing - welcome email not sent to", email);
      return new Response(
        JSON.stringify({ error: "Email not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TradeX <noreply@tradexnova.com>",
        to: [email],
        // Replies reach a human. The footer invites them, so the address has
        // to be one somebody reads - noreply would make that an empty offer.
        reply_to: [SUPPORT_EMAIL],
        subject: "Welcome to TradeX",
        html: buildWelcomeHtml(),
      }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      console.error("Welcome email failed for", email, detail);
      return new Response(
        JSON.stringify({ error: "Send failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-welcome-email:", error);
    return new Response(
      JSON.stringify({ error: "Could not send welcome email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
