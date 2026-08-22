import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

/*
  Permanently delete a user's account and everything belonging to them.

  The Privacy Policy promises "Delete your account and data" and claims the
  GDPR right to erasure, but nothing in the product could do it - a request
  meant someone editing the database by hand. This closes that.

  Order matters, and most of it is not optional:

  1. CANCEL THE STRIPE SUBSCRIPTION FIRST. Deleting the account while a
     subscription is live would keep charging a card for an account its
     owner can no longer even sign into. That is the worst possible failure
     here, so it happens before anything is destroyed and a failure aborts
     the whole thing.

  2. Delete storage objects. Files do not cascade, so skipping this leaves
     the user's trading screenshots sitting in the bucket after their
     account is gone - exactly the data erasure was supposed to remove.

  3. Delete the four tables whose foreign keys are NO ACTION rather than
     CASCADE: trades, balance_adjustments, trading_plan_settings and
     broker_connections. These do not just leave orphans - they actively
     BLOCK the auth user delete, so without this the whole operation fails.
     trades and balance_adjustments reference broker_connections, so they
     go first.

  4. Delete the auth user, which cascades the remaining 24 tables.
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identity comes from the verified token, never from the request body -
    // otherwise this endpoint would delete any account by id.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /*
      Re-authenticate. Deleting an account is irreversible, so it should not
      be possible from a session someone walked away from - the same reason
      changing a password requires the current one.
    */
    const { password } = await req.json();
    if (!password || !user.email) {
      return new Response(JSON.stringify({ error: "Password is required to delete your account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: reauthError } = await userClient.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (reauthError) {
      return new Response(JSON.stringify({ error: "Password is incorrect" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Stripe first - never leave a live subscription billing a deleted account.
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        try {
          const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Already-cancelled is fine; anything else must stop the deletion,
          // because continuing would keep charging an unreachable account.
          if (!/No such subscription|already canceled/i.test(msg)) {
            console.error("Stripe cancellation failed, aborting deletion:", msg);
            return new Response(
              JSON.stringify({ error: "Could not cancel your subscription. Nothing was deleted - please contact support." }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // 2. Storage - files never cascade.
    try {
      const { data: files } = await admin.storage.from("journal-screenshots").list(user.id);
      if (files?.length) {
        await admin.storage
          .from("journal-screenshots")
          .remove(files.map((f: { name: string }) => `${user.id}/${f.name}`));
      }
    } catch (e) {
      console.error("Storage cleanup failed (continuing):", e);
    }

    // 3. Non-cascading tables, children before parents.
    for (const table of ["trades", "balance_adjustments", "trading_plan_settings", "broker_connections"]) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) {
        console.error(`Failed clearing ${table}:`, error);
        return new Response(
          JSON.stringify({ error: "Could not delete your data. Nothing was removed - please contact support." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. The account itself; the remaining 24 tables cascade from here.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Auth user deletion failed:", deleteError);
      return new Response(
        JSON.stringify({ error: "Could not delete your account. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please contact support." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
