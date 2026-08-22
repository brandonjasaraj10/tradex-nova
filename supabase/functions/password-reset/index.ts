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
              Declaring colour-scheme support is what stops Gmail and Apple Mail
              force-inverting this email. Without it, dark mode flipped the design
              inside out: the intentionally dark card was inverted to light while
              the light page went dark, and the grey footer text ended up dark-on-
              dark and effectively unreadable on a phone.

              The email is dark-first now, matching the app, so it looks the same
              in both light and dark clients rather than depending on which one
              guesses correctly.
            -->
            <meta name="color-scheme" content="dark light">
            <meta name="supported-color-schemes" content="dark light">
            <style>
              :root { color-scheme: dark light; supported-color-schemes: dark light; }
              /* Clients that still adjust get explicit values rather than a guess. */
              @media (prefers-color-scheme: dark) {
                .tx-page { background-color: #0A0A0A !important; }
                .tx-card { background-color: #141414 !important; }
                .tx-heading { color: #ffffff !important; }
                .tx-body { color: #b4b4b4 !important; }
                .tx-footer { color: #8a8a8a !important; }
                .tx-code { color: #60A5FA !important; }
              }
            </style>
          </head>
          <body class="tx-page" style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, Helvetica, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="tx-page" style="background-color: #0A0A0A;">
              <tr>
                <td align="center" style="padding: 20px 10px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px;">
                    <!-- Header -->
                    <tr>
                      <td align="center" style="padding: 30px 0;">
                        <h1 class="tx-heading" style="margin: 0; font-size: 32px; font-weight: bold; color: #ffffff;">TradeX</h1>
                      </td>
                    </tr>
                    <!-- Main Content Card -->
                    <tr>
                      <td>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="tx-card" style="background-color: #141414; border-radius: 12px; border: 1px solid #262626;">
                          <tr>
                            <td style="padding: 30px;">
                              <h2 class="tx-heading" style="margin: 0 0 15px 0; font-size: 24px; font-weight: bold; color: #ffffff;">Password Reset Code</h2>
                              <p class="tx-body" style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #b4b4b4;">You requested to reset your password. Use the code below to continue:</p>
                              <!-- Code Box -->
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="center" style="padding: 25px 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: #000000; border-radius: 8px; border: 1px solid #2f2f2f;">
                                      <tr>
                                        <td style="padding: 20px 30px;">
                                          <span class="tx-code" style="font-size: 32px; font-family: 'Courier New', Courier, monospace; letter-spacing: 8px; color: #60A5FA; font-weight: bold;">${resetCode}</span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                              <p class="tx-body" style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #b4b4b4;">This code will expire in 15 minutes.</p>
                              <p class="tx-body" style="margin: 0; font-size: 14px; line-height: 1.5; color: #b4b4b4;">If you didn't request this, you can safely ignore this email.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td align="center" style="padding: 25px 0 10px 0;">
                        <p class="tx-footer" style="margin: 0; font-size: 12px; color: #8a8a8a;">TradeX - Your personal AI Trading Assistant &amp; Journal</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 0 0 20px 0;">
                        <p class="tx-footer" style="margin: 0; font-size: 11px; color: #8a8a8a;">This is an automated message. Please do not reply to this email.</p>
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