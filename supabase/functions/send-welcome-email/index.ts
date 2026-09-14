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
  Light, and that is a reversal.

  The comment that used to sit here said the dark version had been "checked
  in a real Gmail inbox on a phone and holds". It had not held. Checking it
  properly showed Gmail's mobile app inverting the whole email to a white
  card - and doing the same in reverse to a light one, so the direction
  cannot be controlled from here at all.

  What can be controlled is whether the result is readable either way. Every
  background carries a bgcolor attribute as well as an inline style, because
  some clients strip styles from body and table elements. No text is near-
  white or near-black on a background of the same kind. The logo is the solid
  tile, which brings its own contrast. The two colours that stay white are
  both on the blue #3B82F6, where white is correct.

  It is served from www because the bare domain 308-redirects there and some
  clients will not follow a redirect for an image.
*/
/*
  The SOLID logo, not the transparent one.

  tradex_logo.png is a pure white mark on transparency - measured off the
  PNG's own pixels at 254/255 luminance. Gmail's mobile app inverts an email
  designed dark into a white card, and on that card a white mark is
  invisible. Confirmed in a real inbox, not theorised.

  trade_x_logo.png is the same mark on a black tile. It brings its own
  contrast, so it reads whichever way a client decides to flip the
  background.
*/
const LOGO_URL = "https://www.tradexnova.com/trade_x_logo.png";

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
              <p style="margin: 0 0 3px 0; font-size: 15px; font-weight: 600; color: #111111;">${title}</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #555555;">${body}</p>
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
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body bgcolor="#ffffff" style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff;">
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #e6e6e6; border-radius: 14px;">
                <tr>
                  <td style="padding: 36px 32px;">
                    <h1 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">Welcome to TradeX</h1>
                    <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #555555;">Your account is ready. TradeX is a trading journal with an AI analyst attached &mdash; you log your trades, and Nova tells you what your own numbers actually say.</p>

                    <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #2563eb; letter-spacing: 0.4px; text-transform: uppercase;">Getting started</p>

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

                    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #555555;">Something not working, or not making sense? Reply to this email, or use <span style="color: #111111; font-weight: 600;">Settings &rarr; Contact Us</span> inside the app to send us a bug report with a screenshot.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 28px 0 0 0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #777777;">TradeX &mdash; your AI trading journal</p>
              <p style="margin: 0; font-size: 12px; color: #999999;">You&rsquo;re getting this because you created a TradeX account.</p>
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
