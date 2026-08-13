import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
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

    const { action = 'activate' } = await req.json();
    const now = new Date();

    if (action === 'activate') {
      // Look the subscription up in Stripe itself, keyed by the verified
      // supabase_user_id metadata that create-subscription attaches to
      // every checkout session. This never trusts anything from the
      // request body — activation only happens if Stripe confirms a real
      // subscription exists for this exact authenticated user.
      const searchResult = await stripe.subscriptions.search({
        query: `metadata['supabase_user_id']:'${user.id}'`,
        limit: 1,
      });

      const stripeSub = searchResult.data[0];
      if (!stripeSub) {
        return new Response(
          JSON.stringify({ error: "No Stripe subscription found. Please subscribe first." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 402,
          }
        );
      }

      const subscriptionRecord = {
        stripe_customer_id: typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id,
        stripe_subscription_id: stripeSub.id,
        status: stripeSub.status,
        current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        updated_at: now.toISOString(),
      };

      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSub) {
        const { error: updateError } = await supabaseAdmin
          .from("subscriptions")
          .update(subscriptionRecord)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("subscriptions")
          .insert({ user_id: user.id, ...subscriptionRecord });

        if (insertError) throw insertError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription synced from Stripe",
          subscription: {
            status: subscriptionRecord.status,
            current_period_end: subscriptionRecord.current_period_end,
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
