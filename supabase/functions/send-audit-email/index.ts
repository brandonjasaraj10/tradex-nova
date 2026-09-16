import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/*
  The breakdown the audit page promised.

  Someone takes six questions, gets a verdict for free, and is offered "the
  full breakdown" in exchange for an email. This is that breakdown. Until it
  existed the page collected the address and sent nothing, which is a promise
  broken to precisely the people the audit exists to win over.

  Called by a Postgres trigger rather than the browser - same shape as the
  welcome email and the waitlist sync - so closing the tab a second after
  submitting is not the difference between getting it and not, and a client
  cannot ask us to mail an address it invented.

  What is in here is DELIBERATELY NOT what is on the result page. The page
  gives the verdict; paying for it with an email has to buy something the
  page did not already say, or the trade is a bad one. So this is the
  mechanism behind the pattern and three things to do about it this week -
  longer, more specific, and useful even to somebody who never signs up.
  That last part is the point: a lead magnet that is worthless without the
  product is an advert wearing a hat.
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

const APP_URL = "https://tradexnova.com";

/* The one brand blue, the same value the welcome email uses. Two different
   blues become visibly different colours once Gmail inverts them. */
const BRAND_BLUE = "#3B82F6";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Breakdown {
  name: string;
  subject: string;
  /* Why it happens - the mechanism, not the label. This is the part that
     makes somebody feel understood rather than diagnosed. */
  why: string;
  /* Three things to do this week. Specific enough to actually do, and none
     of them "use TradeX" - the product is the last section, not every one. */
  doThis: { title: string; detail: string }[];
  /* What to look for if they do start recording it. */
  watchFor: string;
}

const BREAKDOWNS: Record<string, Breakdown> = {
  revenge: {
    name: "The Even-Getter",
    subject: "Your trading psychology: The Even-Getter",
    why:
      "A loss does not feel like a loss. It feels like something taken from you, and the instinct is to go and get it back from the same market that took it. That instinct is fast, it arrives before any analysis does, and it is why the trade after a loss is almost never the trade you would have taken an hour earlier. The size is bigger because the goal has quietly changed from making money to being level.",
    doThis: [
      {
        title: "Put a timer on it, not a rule",
        detail:
          "Rules like \"no revenge trading\" fail because you never think you are doing it. Fifteen minutes away from the screen after any loss is a rule you can actually tell whether you followed.",
      },
      {
        title: "Write the reason before the entry, not after",
        detail:
          "One sentence, before you click. If the sentence contains the last trade in any form, it is not a setup - it is a rematch.",
      },
      {
        title: "Count them for one week",
        detail:
          "Mark every trade taken within thirty minutes of a loss. Do nothing else. At the end of the week add up just those - most people have never separated that number out, and it is usually the whole difference between a green month and a red one.",
      },
    ],
    watchFor:
      "Your win rate on post-loss trades against everything else. If the gap is small, this is not your problem and you can stop worrying about it. If it is large, you have found the single most expensive habit you have.",
  },

  hesitator: {
    name: "The Watcher",
    subject: "Your trading psychology: The Watcher",
    why:
      "Hesitation is not fear of being wrong. It is the cost of being wrong being felt more sharply than the cost of doing nothing - and doing nothing has no entry in your account, so it never gets counted. Every trade you skip is invisible, which means the habit never produces evidence against itself. That is why it survives for years in people whose analysis is genuinely good.",
    doThis: [
      {
        title: "Record the trades you do not take",
        detail:
          "Say it out loud, into anything: the pair, the direction, the level. Ten seconds. You are building the missing half of your record - the one your broker has never shown you.",
      },
      {
        title: "Size down until it is boring",
        detail:
          "Hesitation is usually a size problem wearing a confidence costume. A position small enough that losing it would not bother you is a position you will take. Get the taking habit first; the size can come back later.",
      },
      {
        title: "Separate late entries from real ones",
        detail:
          "Chasing the move twenty minutes after you called it is a different trade with a worse price. Mark those. They are probably a meaningful share of your losses.",
      },
    ],
    watchFor:
      "The result of the trades you skipped, against the ones you took. If the skipped ones would have done better, the problem is not your analysis and never was.",
  },

  rule_breaker: {
    name: "The Plan Abandoner",
    subject: "Your trading psychology: The Plan Abandoner",
    why:
      "Every broken rule felt reasonable at the time, and that is the whole mechanism. Rules are written when nothing is happening, and broken when something is - by which point the situation genuinely does look different from the one you planned for. It always does. The plan is not failing; it is being renegotiated mid-trade by somebody with money on the outcome.",
    doThis: [
      {
        title: "Cut your rules down to three",
        detail:
          "A list of twelve is a list nobody checks. Three you can hold in your head while a trade is moving, which is the only moment the list matters.",
      },
      {
        title: "Mark each trade against them, same day",
        detail:
          "Followed or not, on every trade, while you still remember. \"I mostly follow my plan\" is a feeling. A number is a fact, and it is usually worse than the feeling.",
      },
      {
        title: "Decide the exit before the entry",
        detail:
          "Where you get out, written down, before there is any money in it. Deciding while green or red is deciding with a thumb on the scale.",
      },
    ],
    watchFor:
      "Your results on rule-following trades against the rest. Most people find their strategy works fine and their execution does not, which is a much easier problem than the one they thought they had.",
  },

  giver_backer: {
    name: "The Handbacker",
    subject: "Your trading psychology: The Handbacker",
    why:
      "Taking a profit feels good, and taking a loss feels bad, so you do more of the first and postpone the second. That is not weakness, it is how people are wired - but it produces a strategy that is mathematically upside down: small wins, large losses, and a win rate that looks respectable while the account goes nowhere. You can be right most of the time and still lose money this way, which is why it is so hard to spot from results alone.",
    doThis: [
      {
        title: "Record where the trade went after you left",
        detail:
          "Your exit, and the high or low it reached afterwards. The gap between them is the number this whole pattern lives in, and nobody has it by accident.",
      },
      {
        title: "Stop moving stops to break even",
        detail:
          "It feels like risk management and it is usually just getting stopped out of winners at the noisiest price on the chart. Try leaving the original stop for two weeks and compare.",
      },
      {
        title: "Track average win against average loss",
        detail:
          "Not win rate - the ratio underneath it. If your average win is smaller than your average loss, that one number explains more than any setup ever will.",
      },
    ],
    watchFor:
      "The ratio, week over week. It moves slowly and it is the single most predictive thing about whether a profitable-looking strategy actually pays you.",
  },

  overtrader: {
    name: "The Always-In",
    subject: "Your trading psychology: The Always-In",
    why:
      "Being flat is uncomfortable in a way that being wrong is not. A position is engagement, progress, something happening - and a quiet session offers none of that, so the bar for what counts as a setup quietly drops until something qualifies. The trades are not random. They are the same idea as your good ones, taken at a worse moment, and that is why they are so easy to justify.",
    doThis: [
      {
        title: "Cap the day before it starts",
        detail:
          "A number written down in the morning, when you are calm. Three, four, whatever your own data says. The cap works because it was set by somebody not currently bored.",
      },
      {
        title: "Grade every trade A, B or C as you take it",
        detail:
          "One letter, no thinking. After a fortnight you will have the only argument for patience that ever works on anybody: your own C trades, with their own numbers attached.",
      },
      {
        title: "Log the flat days too",
        detail:
          "A day with no trades is a decision, and it deserves a line. Otherwise your journal only ever contains evidence that trading is what you do.",
      },
    ],
    watchFor:
      "What your win rate does after the third or fourth trade of a day. For most people it falls off a cliff at a very consistent point, and knowing where yours is turns \"trade less\" from advice into a number.",
  },
};

function renderEmail(b: Breakdown): string {
  /*
    Light, table-based, with bgcolor attributes beside every inline style -
    the same construction as the welcome email, and for the same reason
    found the hard way: Gmail's mobile app inverts emails in BOTH
    directions, so the only thing that can be controlled from here is
    whether the result is readable either way.
  */
  const steps = b.doThis
    .map(
      (s, i) => `
      <tr>
        <td style="padding: 0 0 20px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="34" valign="top" style="padding-top: 2px;">
                <div style="width: 26px; height: 26px; background-color: ${BRAND_BLUE}; border-radius: 13px; text-align: center; font-size: 13px; line-height: 26px; color: #ffffff; font-weight: 700;">${i + 1}</div>
              </td>
              <td valign="top">
                <p style="margin: 0 0 5px 0; font-size: 15px; font-weight: 600; color: #111111;">${s.title}</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #444444;">${s.detail}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body bgcolor="#ffffff" style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">

          <tr>
            <td style="padding-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; color: #888888;">Your trading psychology</p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 22px;">
              <h1 style="margin: 0; font-size: 30px; line-height: 1.15; color: #111111; font-weight: 700;">${b.name}</h1>
            </td>
          </tr>

          <tr>
            <td bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #e6e6e6; border-radius: 14px; padding: 24px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: ${BRAND_BLUE}; font-weight: 600;">Why it happens</p>
              <p style="margin: 0; font-size: 15px; line-height: 1.65; color: #333333;">${b.why}</p>
            </td>
          </tr>

          <tr><td style="height: 28px;">&nbsp;</td></tr>

          <tr>
            <td style="padding-bottom: 16px;">
              <p style="margin: 0; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: #888888; font-weight: 600;">Three things to do this week</p>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${steps}</table>
            </td>
          </tr>

          <tr>
            <td bgcolor="#f6f8fc" style="background-color: #f6f8fc; border-radius: 14px; padding: 22px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: #888888; font-weight: 600;">What to look for</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.65; color: #333333;">${b.watchFor}</p>
            </td>
          </tr>

          <tr><td style="height: 30px;">&nbsp;</td></tr>

          <tr>
            <td align="center">
              <a href="${APP_URL}/auth?mode=signup" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 30px; border-radius: 999px;">Start tracking it in TradeX</a>
              <p style="margin: 12px 0 0 0; font-size: 12px; color: #888888;">14-day money-back guarantee &middot; Cancel anytime</p>
            </td>
          </tr>

          <tr><td style="height: 34px;">&nbsp;</td></tr>
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999;">
                You got this because you took the psychology audit at tradexnova.com.<br>
                We will not add you to anything without asking.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  /*
    CRON_SECRET, shared with the other database-triggered functions rather
    than a secret of its own.

    Its own would be marginally tidier and would have to be added to the
    Vault by hand - and a webhook secret that is configured everywhere
    except production fails closed and silently: the function returns 403,
    no email is ever sent, and nothing anywhere says so. The claim this
    secret makes is "this call came from our own database", which is
    exactly the claim the audit trigger is making, so the same secret is
    the honest one to check.
  */
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("X-Webhook-Secret") !== secret) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const { auditId } = await req.json().catch(() => ({ auditId: null }));
    if (!auditId) return json({ error: "No audit id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    /*
      Read with the service role, because nothing else can - this table has
      no SELECT policy at all, by design.
    */
    const { data: audit, error } = await admin
      .from("psychology_audits")
      .select("id, archetype, email, email_sent_at")
      .eq("id", auditId)
      .maybeSingle();

    if (error || !audit) return json({ error: "Audit not found" }, 404);
    if (!audit.email) return json({ error: "No email on that audit" }, 400);

    /*
      Already sent. The trigger fires once, but a retry or a replayed
      webhook must not put a second copy of the same email in somebody's
      inbox - the check is here rather than trusted upstream.
    */
    if (audit.email_sent_at) return json({ skipped: "already sent" });

    const breakdown = BREAKDOWNS[audit.archetype as string];
    if (!breakdown) {
      console.error("send-audit-email: unknown archetype", audit.archetype);
      return json({ error: "Unknown archetype" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY missing - breakdown not sent to", audit.email);
      return json({ error: "Email not configured" }, 503);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TradeX <noreply@tradexnova.com>",
        to: [audit.email],
        subject: breakdown.subject,
        html: renderEmail(breakdown),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      /* Logged rather than swallowed: an address captured and never mailed
         is the exact failure this function exists to prevent, and it is
         invisible from the outside. */
      console.error(`send-audit-email: Resend ${res.status} for ${auditId}`, detail.slice(0, 300));
      return json({ error: "Send failed" }, 502);
    }

    /* Stamped only after Resend accepted it, so the column means "sent"
       rather than "attempted". */
    await admin
      .from("psychology_audits")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", auditId);

    return json({ sent: true, archetype: audit.archetype });
  } catch (err) {
    console.error("send-audit-email failed:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
