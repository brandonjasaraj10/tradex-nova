import { createClient } from 'npm:@supabase/supabase-js@2';

/*
  Sends one email to people who signed up and never subscribed.

  Called by pg_cron once a day (see migration 20260913230000). Authenticated
  with the same X-Cron-Secret the reconciliation job uses, so it cannot be
  triggered from the outside.

  Shaped by the abandonment research rather than guesswork:

  - The subject carries the first name (worth ~22% on open rate) and names
    the thing that was abandoned (~10-15%). 98% of these people have a
    usable first name; the rest get a name-free version rather than "Hi
    there", which reads worse than no name at all.
  - One call to action, not three.
  - No discount. It teaches the next person to abandon and undercuts
    everyone paying full price. The guarantee is the offer instead.
  - No fabricated social proof. The research says testimonials help here;
    there are none real to use, and inventing them for an email to people
    who have not bought yet is exactly what cannot be defended later.
  - Sent 16:00 UTC - mid-morning in Denver, the 8-10am local window that
    performs best for the timezone most of this audience is in.

  Operationally:

  - It is capped per run. tradexnova.com has little sending history and the
    backlog is 250 people; posting that in one night is how a young domain
    gets filtered, which would take password resets down with it.
  - New signups are served before the backlog. Taking the oldest 25 first
    would mean somebody who signs up today waits three weeks for an email
    that is supposed to arrive the next day.
  - It checks the suppression list before every send, and every email carries
    a real one-click unsubscribe - both the visible link and the
    List-Unsubscribe header that Gmail and Apple Mail surface themselves.
  - It refuses to run at all unless internal_config.abandon_emails_enabled is
    'true', so deploying this is not the same act as starting to send.
*/

const SITE = 'https://www.tradexnova.com';
const FROM = 'TradeX <noreply@tradexnova.com>';
const LOGO_URL = 'https://www.tradexnova.com/tradex_logo.png';

/* Total sends per run. ~12 new signups a day at current volume, so this
   leaves room for roughly 13 backlog messages and drains 250 in ~19 days. */
const DAILY_CAP = 25;

/* Long enough that it does not feel like surveillance, short enough that
   they still remember signing up. */
const WAIT_HOURS = 24;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
};

type Candidate = { id: string; email: string; created_at: string; first_name: string | null };

/* Guard against a name that would embarrass the send - a pasted email
   address, a blank, or something long enough to wrap the subject line. */
function usableName(raw: string | null): string | null {
  const name = (raw ?? '').trim();
  if (!name || name.length > 20 || name.includes('@')) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function subjectFor(name: string | null): string {
  return name
    ? `${name}, you signed up for TradeX but never got in`
    : 'You signed up for TradeX but never got in';
}

function buildHtml(unsubscribeUrl: string): string {
  /*
    Written for somebody who signed up, saw a price, and left - not for a
    lapsed user. They have not used the product, so there is nothing to
    remind them of; what there is to say is why the thing costs money and
    why they are not risking anything by trying it.

    No discount. Discounting an abandoned signup teaches the next person to
    abandon, and it would undercut everyone already paying full price.
    No countdown, no invented scarcity - the site does not do that anywhere
    else and this is not the place to start.
  */
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0A0A0A" style="background-color:#0A0A0A;border:1px solid #1f1f1f;border-radius:14px;">
                <tr>
                  <td style="padding:36px 32px;">
                    <h1 style="margin:0 0 14px 0;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">You made an account but never got in</h1>

                    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#8b8b8b;">
                      No hard sell here. You signed up for TradeX, hit the price, and stopped &mdash; which is a completely reasonable thing to do with a subscription you have not tried.
                    </p>

                    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#8b8b8b;">
                      So the one thing worth knowing: there is a <span style="color:#ffffff;">14-day money back guarantee on both plans</span>. Use it properly for two weeks &mdash; log your trades, ask Nova what you keep doing wrong &mdash; and if it does not tell you something you did not already know, send one email and you get your money back. No questions, no retention call.
                    </p>

                    <p style="margin:0 0 28px 0;font-size:15px;line-height:1.65;color:#8b8b8b;">
                      That is the whole offer. Two weeks to find out, and a way out if it is not for you.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:999px;">
                          <a href="${SITE}/payment" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#000000;text-decoration:none;">Pick a plan</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6b6b6b;">
                      Not sure yet? The <a href="${SITE}/features" style="color:#8b8b8b;">features page</a> shows what it actually looks like, and the <a href="${SITE}/faq" style="color:#8b8b8b;">FAQ</a> answers the awkward questions properly, including the ones where the answer is no.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 8px 0 8px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#555555;">
                You are getting this once because you created a TradeX account.<br>
                <a href="${unsubscribeUrl}" style="color:#777777;">Unsubscribe</a> and we will not email you about this again.
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('X-Cron-Secret');
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  /* The kill switch. Deploying and sending are separate decisions. */
  const { data: flag } = await supabase
    .from('internal_config')
    .select('value')
    .eq('key', 'abandon_emails_enabled')
    .maybeSingle();

  const enabled = flag?.value === 'true';

  /*
    A dry run reports exactly who would be emailed without sending anything,
    which is how this gets verified against real data before it is armed.
  */
  const dryRun = !enabled || new URL(req.url).searchParams.get('dry_run') === '1';

  const { data: rows, error } = await supabase.rpc('abandon_email_candidates', {
    wait_hours: WAIT_HOURS,
    max_rows: DAILY_CAP,
  });

  if (error) {
    console.error('candidate lookup failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const candidates = (rows ?? []) as Candidate[];

  if (dryRun) {
    return new Response(
      JSON.stringify({
        dry_run: true,
        enabled,
        would_send: candidates.length,
        cap: DAILY_CAP,
        sample: candidates.slice(0, 3).map((c) => ({
          created_at: c.created_at,
          email: c.email.replace(/^(.).*(@.*)$/, '$1***$2'),
        })),
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const person of candidates) {
    /*
      The record is written BEFORE the send, not after. If Resend succeeds
      and this function then crashes, an after-the-fact write would be lost
      and the person would be emailed again on the next run. Erring towards
      never sending twice is the right direction for an unsolicited email.
    */
    const { data: record, error: recordError } = await supabase
      .from('abandon_signup_emails')
      .insert({ user_id: person.id })
      .select('unsubscribe_token')
      .single();

    if (recordError || !record) {
      failures.push(`record ${person.id}: ${recordError?.message}`);
      continue;
    }

    const unsubscribeUrl =
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/email-unsubscribe?token=${record.unsubscribe_token}`;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [person.email],
          subject: 'The part nobody tells you about trying TradeX',
          html: buildHtml(unsubscribeUrl),
          /* Surfaced by Gmail and Apple Mail as a native unsubscribe button,
             which is both required for bulk mail and the single best thing
             for sender reputation - it gives people an alternative to the
             spam button. */
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });

      if (!res.ok) {
        failures.push(`send ${person.id}: ${res.status} ${await res.text()}`);
        continue;
      }
      sent += 1;
    } catch (err) {
      failures.push(`send ${person.id}: ${(err as Error).message}`);
    }
  }

  if (failures.length) console.error('abandon email failures:', failures);

  return new Response(
    JSON.stringify({ sent, attempted: candidates.length, failed: failures.length }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
