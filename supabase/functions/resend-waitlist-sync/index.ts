import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

const SEGMENT_NAME = "Waitlist";

async function getOrCreateSegmentId(resendApiKey: string): Promise<string> {
  const listResponse = await fetch("https://api.resend.com/segments", {
    headers: { "Authorization": `Bearer ${resendApiKey}` },
  });
  const listData = await listResponse.json();
  const existing = (listData.data ?? []).find((s: { name: string }) => s.name === SEGMENT_NAME);
  if (existing) return existing.id;

  const createResponse = await fetch("https://api.resend.com/segments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: SEGMENT_NAME }),
  });
  const createData = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(`Failed to create segment: ${JSON.stringify(createData)}`);
  }
  return createData.id;
}

async function addContact(resendApiKey: string, segmentId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, segments: [{ id: segmentId }] }),
  });

  if (response.ok) return { ok: true };

  const errorText = await response.text();
  return { ok: false, error: errorText };
}

async function notifyOwnerOfSignup(resendApiKey: string, notifyEmail: string, signupEmail: string, totalCount: number | null) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TradeX <noreply@tradexnova.com>",
        to: [notifyEmail],
        subject: `New waitlist signup: ${signupEmail}`,
        html: `<p>New waitlist signup: <strong>${signupEmail}</strong></p>${
          totalCount !== null ? `<p>Total waitlist signups: ${totalCount}</p>` : ""
        }`,
      }),
    });

    if (!response.ok) {
      console.error("Failed to send owner notification:", await response.text());
    }
  } catch (error) {
    console.error("Error sending owner notification:", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("WAITLIST_SYNC_SECRET");
  const providedSecret = req.headers.get("X-Webhook-Secret");
  if (!webhookSecret || providedSecret !== webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const segmentId = await getOrCreateSegmentId(resendApiKey);

    // Database webhook payload shape: { type: "INSERT", table, record: { email, ... }, ... }
    if (body.record?.email) {
      const result = await addContact(resendApiKey, segmentId, body.record.email);
      if (!result.ok) {
        console.error("Failed to add contact:", result.error);
      }

      const notifyEmail = Deno.env.get("WAITLIST_NOTIFY_EMAIL");
      if (notifyEmail) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { count } = await supabase
          .from("waitlist")
          .select("*", { count: "exact", head: true });

        await notifyOwnerOfSignup(resendApiKey, notifyEmail, body.record.email, count ?? null);
      }

      return new Response(
        JSON.stringify({ success: result.ok }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // One-time backfill mode: { action: "backfill" }
    if (body.action === "backfill") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: waitlistRows, error: fetchError } = await supabase
        .from("waitlist")
        .select("email");

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = { synced: 0, failed: 0, errors: [] as string[] };
      for (const row of waitlistRows ?? []) {
        const result = await addContact(resendApiKey, segmentId, row.email);
        if (result.ok) {
          results.synced++;
        } else {
          results.failed++;
          results.errors.push(`${row.email}: ${result.error}`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, segmentId, ...results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("resend-waitlist-sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
