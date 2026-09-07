import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/*
  Delivers an affiliate application to the owner's inbox.

  The applications table is write-only - no SELECT policy, so nothing can read
  it back through the API, including the person who submitted. Email is
  therefore not a convenience here, it is the only way an application is ever
  seen. If this function fails, the row still exists and can be read with the
  service role, but nobody would know to look.

  Called by a Postgres trigger rather than by the page, so an application
  cannot be lost by a browser closing between the insert and the notification.
  Same arrangement as the welcome email: net.http_post with a shared secret in
  a header, because a trigger has no user JWT to present.
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

const OWNER_EMAIL = "tradenovaai@gmail.com";

// Applicant-supplied text goes into HTML, so it has to be escaped. Without
// this, a name containing a tag would break the layout at best and inject
// markup into the owner's inbox at worst.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
  The logo, served from www rather than the bare domain.

  tradexnova.com 308-redirects to www, and plenty of mail clients will not
  follow a redirect for an image - they just show nothing. The www URL is the
  one that returns the PNG directly.

  It is a white mark on transparency, which is precisely why this email is
  dark: on the old light background the logo would have been invisible.
*/
const LOGO_URL = "https://www.tradexnova.com/tradex_logo.png";

function buildHtml(app: {
  name: string;
  email: string;
  promo_urls: string[];
  audience_size: string | null;
  why: string | null;
}): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1f1f1f;vertical-align:top;width:130px;">
        <span style="font-size:13px;color:#8b8b8b;">${esc(label)}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #1f1f1f;vertical-align:top;">
        <span style="font-size:14px;color:#ffffff;">${value}</span>
      </td>
    </tr>`;

  const links = (app.promo_urls ?? [])
    .map((u) => {
      const safe = esc(u);
      // Only http(s) becomes a clickable link. Anything else is shown as text,
      // so a javascript: or data: URL cannot become a live link in the inbox.
      return /^https?:\/\//i.test(u)
        ? `<a href="${safe}" style="color:#60A5FA;text-decoration:none;">${safe}</a>`
        : safe;
    })
    .join("<br>");

  /*
    Dark, and built to survive a mail client that has its own opinions.

    Every background is set with BOTH a bgcolor attribute and an inline style:
    plenty of clients strip styles from <body>, and one that keeps the dark
    text while dropping the dark background produces black-on-black. The
    attribute is the belt to the style's braces.

    Colours are the app's own tokens - #0A0A0A surface, #3B82F6 and #60A5FA
    for accents - so the email reads as the same product as the dashboard.
  */
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">

        <tr><td align="center" style="padding-bottom:28px;">
          <!-- alt text is white, so a client that blocks images still shows
               the brand rather than a broken-image icon on black. -->
          <img src="${LOGO_URL}" width="72" height="72" alt="TradeX"
               style="display:block;border:0;outline:none;text-decoration:none;color:#ffffff;font-size:22px;font-weight:700;">
        </td></tr>

        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0A0A0A" style="background-color:#0A0A0A;border:1px solid #1f1f1f;border-radius:14px;">
            <tr><td style="padding:32px;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#60A5FA;letter-spacing:0.4px;text-transform:uppercase;">New affiliate application</p>
              <h1 style="margin:0 0 24px 0;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${esc(app.name)}</h1>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${row("Email", `<a href="mailto:${esc(app.email)}" style="color:#60A5FA;text-decoration:none;">${esc(app.email)}</a>`)}
                ${row("Promoting on", links || "&mdash;")}
                ${row("Audience", esc(app.audience_size) || "&mdash;")}
                ${app.why ? row("Why TradeX", esc(app.why).replace(/\n/g, "<br>")) : ""}
              </table>

              <p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#8b8b8b;">
                Reply to this email to answer them directly &mdash; it goes straight to their inbox.
              </p>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
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
      JWT to verify. A shared secret held in internal_config takes its place.
      Without it this endpoint would let anyone on the internet send
      TradeX-branded mail to the owner.
    */
    const { data: config } = await supabase
      .from("internal_config")
      .select("value")
      .eq("key", "welcome_email_secret")
      .maybeSingle();

    const expected = config?.value;
    if (!expected || req.headers.get("X-Webhook-Secret") !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const app = body?.record;
    if (!app?.email || !app?.name) {
      return new Response(JSON.stringify({ error: "Incomplete application" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY missing - affiliate application not delivered:", app.email);
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "TradeX <noreply@tradexnova.com>",
        to: [OWNER_EMAIL],
        /*
          Replies go to the applicant, not to us. Reviewing an application
          almost always ends in answering it, and copying an address out of an
          email to start that reply is the kind of friction that leaves good
          applicants waiting.
        */
        reply_to: [app.email],
        subject: `New affiliate application: ${app.name}`,
        html: buildHtml(app),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Affiliate application email failed for", app.email, detail);
      return new Response(JSON.stringify({ error: "Send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-affiliate-application:", error);
    return new Response(JSON.stringify({ error: "Could not send application" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
