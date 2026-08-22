import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    const { action, email, code, newPassword } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (action === "request") {
      /*
        Throttle before doing anything else.

        Requesting a code used to be unlimited - only guessing a code was
        capped - so this endpoint could be hammered with someone else's
        address indefinitely: their inbox floods, every attempt sends a real
        Resend email, and repeatedly mailing one address is exactly what
        wrecks sender reputation.

        Checked ahead of the user lookup on purpose. Throttling only real
        accounts would make the 429 an account-existence oracle, which would
        undo the deliberately vague "if an account exists" response below.
        Three per address per 15 minutes: a locked-out user asks once, maybe
        twice - three means three unused codes are already sitting in their
        inbox.
      */
      const { data: allowed, error: throttleError } = await supabase
        .rpc("check_and_record_reset_request", { p_email: normalizedEmail });

      if (throttleError) {
        console.error("Reset throttle check failed:", throttleError);
      } else if (allowed === false) {
        return new Response(
          JSON.stringify({ error: "Too many reset requests. Please wait a few minutes and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: users, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error listing users:", userError);
        return new Response(
          JSON.stringify({ error: "Failed to process request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const matchedUser = users.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (!matchedUser) {
        return new Response(
          JSON.stringify({ success: true, message: "If an account exists, a code has been sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("password_reset_codes")
        .delete()
        .eq("email", normalizedEmail);

      const resetCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const { error: insertError } = await supabase
        .from("password_reset_codes")
        .insert({
          user_id: matchedUser.id,
          email: normalizedEmail,
          code: resetCode,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error inserting reset code:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to generate reset code" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: emailError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
        options: {
          data: {
            reset_code: resetCode,
          },
        },
      });

      const emailHtml = `
        <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!--
              Gmail's mobile app inverts on its own heuristics and ignores both
              colour-scheme meta and prefers-color-scheme, so this does not try
              to control the theme. It is built so BOTH renderings look like
              TradeX: light on a light client, and - because Gmail flips light
              to dark - the app's own dark-with-blue look on a phone.

              Every colour is a mid-tone that stays itself when inverted. An
              earlier version used #1D4ED8 for the code, which lightened into
              purple; brand blue #3B82F6 stays blue either way.

              The logo is drawn with table cells rather than an <img>, because
              most clients block remote images by default and a branded email
              that arrives unbranded defeats the point. These are the same three
              bars as the in-app mark.
            -->
          </head>
          <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff;">
              <tr>
                <td align="center" style="padding: 40px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">

                    <!-- Logo: three bars + wordmark -->
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

                    <!-- Card -->
                    <tr>
                      <td>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e2e2; border-radius: 14px;">
                          <tr>
                            <td style="padding: 36px 32px;">
                              <h1 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">Reset your password</h1>
                              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #555555;">Enter this code in TradeX to choose a new password.</p>

                              <!-- Code -->
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="center" style="background-color: #f4f8ff; border: 1px solid #3B82F6; border-radius: 10px; padding: 22px 16px;">
                                    <span style="font-size: 36px; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; letter-spacing: 10px; color: #3B82F6; font-weight: 700;">${resetCode}</span>
                                  </td>
                                </tr>
                              </table>

                              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #555555;">This code expires in <span style="color: #111111; font-weight: 600;">15 minutes</span>. If you didn&rsquo;t ask to reset your password, you can ignore this email &mdash; nothing will change.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td align="center" style="padding: 28px 0 0 0;">
                        <p style="margin: 0 0 6px 0; font-size: 13px; color: #555555;">TradeX &mdash; your AI trading journal</p>
                        <p style="margin: 0; font-size: 12px; color: #777777;">Automated message, please don&rsquo;t reply.</p>
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
              to: [normalizedEmail],
              subject: "Your TradeX Password Reset Code",
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
      } else {
        console.log("RESEND_API_KEY not configured. Reset code for", normalizedEmail, "is:", resetCode);
      }

      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a code has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Verification code is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: resetData, error: resetError } = await supabase
        .from("password_reset_codes")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (resetError || !resetData) {
        const { data: existingCode } = await supabase
          .from("password_reset_codes")
          .select("attempts")
          .eq("email", normalizedEmail)
          .eq("used", false)
          .maybeSingle();

        if (existingCode) {
          const newAttempts = (existingCode.attempts || 0) + 1;
          
          if (newAttempts >= 5) {
            await supabase
              .from("password_reset_codes")
              .delete()
              .eq("email", normalizedEmail);

            return new Response(
              JSON.stringify({ error: "Too many attempts. Please request a new code." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await supabase
            .from("password_reset_codes")
            .update({ attempts: newAttempts })
            .eq("email", normalizedEmail);
        }

        return new Response(
          JSON.stringify({ error: "Invalid or expired code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Code verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset") {
      if (!code || !newPassword) {
        return new Response(
          JSON.stringify({ error: "Code and new password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: resetData, error: resetError } = await supabase
        .from("password_reset_codes")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (resetError || !resetData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", resetData.id);

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});