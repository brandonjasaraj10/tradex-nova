import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/*
  Emails Brandon every time somebody signs up.

  Called by a Postgres trigger (notify_new_signup, on user_profiles insert -
  the name screen every new account passes through), not by any user, so it
  is deployed without JWT verification and checks a shared secret instead.
  The secret lives in internal_config (RLS on, no policies), read here with
  the service role, so no new function secret has to be set by hand.

  Sends to WAITLIST_NOTIFY_EMAIL, the address the waitlist alerts already go
  to, through the same Resend key. Never throws back at the trigger: a failed
  alert must not affect the signup that caused it.
*/

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: secretRow } = await admin
    .from("internal_config")
    .select("value")
    .eq("key", "signup_alert_secret")
    .maybeSingle();
  const provided = req.headers.get("X-Webhook-Secret");
  if (!secretRow?.value || provided !== secretRow.value) return json(401, { error: "Unauthorized" });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const notifyEmail = Deno.env.get("WAITLIST_NOTIFY_EMAIL");
  if (!resendApiKey || !notifyEmail) return json(200, { skipped: "not configured" });

  try {
    const { user_id } = await req.json();
    if (typeof user_id !== "string") return json(400, { error: "user_id required" });

    const [{ data: authUser }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(user_id),
      admin.from("user_profiles").select("first_name, last_name").eq("user_id", user_id).maybeSingle(),
    ]);

    const email = authUser?.user?.email ?? "unknown email";
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Someone";

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [{ count: today }, { count: total }] = await Promise.all([
      admin.from("user_profiles").select("user_id", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()),
      admin.from("user_profiles").select("user_id", { count: "exact", head: true }),
    ]);

    const subject = `New TradeX signup: ${name}`;
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">
        <p style="margin:0 0 12px"><strong>${escapeHtml(name)}</strong> just signed up for TradeX.</p>
        <p style="margin:0 0 4px">Email: ${escapeHtml(email)}</p>
        <p style="margin:0 0 16px">Signups today: ${today ?? "?"} &middot; All time: ${total ?? "?"}</p>
        <p style="margin:0;color:#666;font-size:13px">They start on the free plan.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "TradeX <noreply@tradexnova.com>",
        to: [notifyEmail],
        subject,
        html,
      }),
    });
    if (!res.ok) console.error("Signup alert failed:", res.status, await res.text());
    return json(200, { sent: res.ok });
  } catch (error) {
    console.error("notify-new-signup error:", error);
    return json(200, { sent: false });
  }
});
