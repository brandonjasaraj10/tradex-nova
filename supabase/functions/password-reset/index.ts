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
      const { data: users, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error listing users:", userError);
        return new Response(
          JSON.stringify({ error: "Failed to process request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userExists = users.users.some(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (!userExists) {
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
                            <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: bold; color: #ffffff;">Password Reset Code</h2>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a0a0a0;">You requested to reset your password. Use the code below to continue:</p>
                            <!-- Code Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" style="padding: 25px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: #000000; border-radius: 8px;">
                                    <tr>
                                      <td style="padding: 20px 30px;">
                                        <span style="font-size: 32px; font-family: 'Courier New', Courier, monospace; letter-spacing: 8px; color: #3B82F6; font-weight: bold;">${resetCode}</span>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #a0a0a0;">This code will expire in 15 minutes.</p>
                            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #a0a0a0;">If you didn't request this, you can safely ignore this email.</p>
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