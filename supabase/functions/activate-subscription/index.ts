import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action = 'activate', duration = 30 } = await req.json();

    const now = new Date();
    const trialStart = now;
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentPeriodEnd = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    if (action === 'activate') {
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSub) {
        const { error: updateError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
            trial_start: trialStart.toISOString(),
            trial_end: trialEnd.toISOString(),
            cancel_at_period_end: false,
            updated_at: now.toISOString(),
          })
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("subscriptions")
          .insert({
            user_id: user.id,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
            trial_start: trialStart.toISOString(),
            trial_end: trialEnd.toISOString(),
            cancel_at_period_end: false,
          });

        if (insertError) throw insertError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription activated successfully",
          subscription: {
            status: "active",
            trial_end: trialEnd.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    } else if (action === 'deactivate') {
      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription deactivated successfully",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    } else {
      throw new Error("Invalid action");
    }
  } catch (error) {
    console.error("Subscription activation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      }
    );
  }
});
