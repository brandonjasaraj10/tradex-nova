import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPPORT_INBOX = "tradenovaai@gmail.com";

/*
  How many reports one user can file in an hour.

  Generous for anyone genuinely reporting problems - hitting five distinct
  bugs in an hour is a bad day, not abuse - while stopping a stuck submit
  button or a bored user from filling the inbox. Counted from the table
  itself rather than a separate counter: the rows are the record, so the
  limit cannot drift from what was actually filed.
*/
const MAX_REPORTS_PER_HOUR = 5;

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  issue: "Issue",
  feature_request: "Feature request",
  other: "Other",
};

interface SubmitReportRequest {
  category?: string;
  subject?: string;
  description?: string;
  attachment_path?: string | null;
  page_url?: string | null;
  user_agent?: string | null;
  app_version?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: SubmitReportRequest = await req.json();

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Identity from the verified JWT, never the request body.
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "You need to be signed in to send a report." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const category = (body.category ?? "").trim();
    const subject = (body.subject ?? "").trim();
    const description = (body.description ?? "").trim();

    if (!CATEGORY_LABELS[category]) {
      return new Response(
        JSON.stringify({ error: "Pick what kind of report this is." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!subject || subject.length > 150) {
      return new Response(
        JSON.stringify({ error: "Add a short summary (150 characters or fewer)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!description || description.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Describe what happened (5000 characters or fewer)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseClient
      .from("support_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", anHourAgo);

    if ((recentCount ?? 0) >= MAX_REPORTS_PER_HOUR) {
      return new Response(
        JSON.stringify({
          error: `You've sent ${MAX_REPORTS_PER_HOUR} reports in the last hour. Please give it a little while, or reply to the email we sent you if it's urgent.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /*
      An attachment must live in the reporter's own folder.

      The path is client-supplied, and storage RLS already stops anyone
      uploading outside their own folder - but nothing stops them naming
      somebody else's existing path here, which would attach a stranger's
      screenshot to their own report and mail it out. Checking the prefix
      costs nothing and closes that.
    */
    let attachmentPath = body.attachment_path ?? null;
    if (attachmentPath && !attachmentPath.startsWith(`${user.id}/`)) {
      return new Response(
        JSON.stringify({ error: "That attachment doesn't belong to this account." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: report, error: insertError } = await supabaseClient
      .from("support_reports")
      .insert({
        user_id: user.id,
        category,
        subject,
        description,
        attachment_path: attachmentPath,
        page_url: body.page_url ?? null,
        user_agent: body.user_agent ?? null,
        app_version: body.app_version ?? null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    /*
      The report is saved before the email is attempted, and a failed send
      does not fail the request. Losing a bug report because an email
      provider had a bad minute would be a worse bug than the one being
      reported - the row is the record, the email is the notification.
    */
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailed = false;

    if (resendApiKey) {
      try {
        let attachmentLine = "Attachment: none";
        if (attachmentPath) {
          // Signed rather than public, and short-lived: these screenshots
          // routinely show account balances.
          const { data: signed } = await supabaseClient.storage
            .from("support-attachments")
            .createSignedUrl(attachmentPath, 60 * 60 * 24 * 7);

          attachmentLine = signed?.signedUrl
            ? `Attachment: <a href="${signed.signedUrl}">view (link expires in 7 days)</a>`
            : `Attachment: ${escapeHtml(attachmentPath)} (could not sign a link)`;
        }

        const html = `
          <h2>${escapeHtml(CATEGORY_LABELS[category])}: ${escapeHtml(subject)}</h2>
          <p><strong>From:</strong> ${escapeHtml(user.email ?? user.id)}</p>
          <p><strong>Page:</strong> ${escapeHtml(body.page_url ?? "not recorded")}</p>
          <p><strong>Browser:</strong> ${escapeHtml(body.user_agent ?? "not recorded")}</p>
          <p><strong>Build:</strong> ${escapeHtml(body.app_version ?? "not recorded")}</p>
          <hr />
          <p style="white-space: pre-wrap;">${escapeHtml(description)}</p>
          <hr />
          <p>${attachmentLine}</p>
          <p style="color:#666;font-size:12px;">Report ${escapeHtml(report.id)}</p>
        `;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "TradeX Support <noreply@tradexnova.com>",
            to: [SUPPORT_INBOX],
            reply_to: user.email ? [user.email] : undefined,
            subject: `[${CATEGORY_LABELS[category]}] ${subject}`,
            html,
          }),
        });

        emailed = emailResponse.ok;
        if (!emailResponse.ok) {
          console.error("Support email failed:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Support email threw:", emailError);
      }
    } else {
      console.error("RESEND_API_KEY missing - report saved but not emailed");
    }

    return new Response(
      JSON.stringify({ success: true, report_id: report.id, emailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-support-report:", error);
    return new Response(
      JSON.stringify({ error: "Could not send your report. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
