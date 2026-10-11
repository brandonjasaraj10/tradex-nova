import { createClient } from 'npm:@supabase/supabase-js@2';

/*
  The four trial emails - see migration 20261011120000 for why they exist.

  Run once a day by pg_cron behind X-Cron-Secret. Each run sends each
  trialling person AT MOST ONE email: whichever is the latest one due that
  they have not had. Somebody whose day-3 email was missed (the job was off,
  say) does not get day 3 and day 7 in the same morning - they get day 7.
  The billing reminder always wins when it is due.

  Refuses to send unless internal_config.trial_emails_enabled is 'true'; a
  call with ?dry_run=1, or any call while it is off, reports exactly who
  would get what and sends nothing.
*/

const SITE = 'https://www.tradexnova.com';
const FROM = 'Brandon at TradeX <noreply@tradexnova.com>';
const DAY = 24 * 60 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
};

type Kind = 'day1' | 'day3' | 'day7' | 'reminder';

type Candidate = {
  user_id: string;
  email: string;
  first_name: string | null;
  trial_start: string;
  trial_end: string;
  unit_amount: number | null;
  billing_interval: string | null;
  plan_type: string | null;
  onboarding_profile: Record<string, string> | null;
  struggle: string | null;
  journaled_days: number;
  suppressed: boolean;
  sent_kinds: string[];
};

function usableName(raw: string | null): string | null {
  const name = (raw ?? '').trim();
  if (!name || name.length > 20 || name.includes('@')) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const GOAL_PHRASE: Record<string, string> = {
  profitable: 'to become consistently profitable',
  pass_challenge: 'to pass your challenge',
  stop_blowing: 'to stop blowing accounts',
  consistent: 'to trade the same way every day',
  understand: 'to see why you do what you do',
};

/*
  The day-3 email: one thing to watch, from the struggle they picked. Short
  and specific beats a feature tour; each is something they can do on their
  very next trade inside the product they already have.
*/
const WATCH: Record<string, { subject: string; body: string }> = {
  revenge_trading: {
    subject: 'The one trade to watch this week',
    body: 'You said the trade after a loss is the one that costs you. So this week, before that trade, take the three taps first. If you come out a 1 or a 2 on steady, that is the trade to skip. That is the whole exercise.',
  },
  overtrading: {
    subject: 'Count them on your best day',
    body: 'You said you overtrade. This week, look at the calendar after a green day and count the trades. Most traders find their best days are their quietest, and seeing it in your own numbers lands differently from being told.',
  },
  breaking_rules: {
    subject: 'Tick it before, not after',
    body: 'You said you break your own rules. The checklist only works if it is ticked before the entry, not filled in afterwards to make the trade look better. Try it on your next three trades and watch your adherence number.',
  },
  not_sure: {
    subject: 'You do not need to know your pattern yet',
    body: 'You said you are not sure what is costing you. That is fine; finding it is the journal’s job, not yours. Keep logging, thirty seconds a trade, and Nova starts naming what it sees once there are a few entries to compare.',
  },
};

function money(cents: number | null, interval: string | null): string | null {
  if (!cents) return null;
  const amount = `$${(cents / 100).toFixed(2)}`;
  return interval === 'year' ? `${amount} for the year` : `${amount} a month`;
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' });
}

/* Which email is due today, if any. */
function due(c: Candidate, now: number): Kind | null {
  const start = new Date(c.trial_start).getTime();
  const end = new Date(c.trial_end).getTime();
  const sent = new Set(c.sent_kinds);
  const day = Math.floor((now - start) / DAY);

  /* Two days out, so it arrives with a full day to decide - and never after the charge. */
  if (!sent.has('reminder') && end - now <= 2.5 * DAY && end > now) return 'reminder';
  if (c.suppressed) return null;
  if (day >= 7 && !sent.has('day7')) return 'day7';
  if (day >= 3 && day < 7 && !sent.has('day3')) return 'day3';
  if (day >= 1 && day < 3 && !sent.has('day1')) return 'day1';
  return null;
}

function compose(kind: Kind, c: Candidate): { subject: string; heading: string; paragraphs: string[]; cta: string; href: string } {
  const name = usableName(c.first_name);
  const p = c.onboarding_profile ?? {};
  const target = Number(p.commit_days) || 14;
  const minutes = p.daily_minutes ? `${p.daily_minutes} minutes each` : 'thirty seconds a trade';
  const why = GOAL_PHRASE[p.goal ?? ''] ?? '';
  const done = c.journaled_days;

  if (kind === 'day1') {
    return {
      subject: name ? `${name}, your ${target} days start now` : `Your ${target} days start now`,
      heading: 'Your goal, in your own words',
      paragraphs: [
        `You set it yourself: <span style="color:#ffffff;">${target} trading days, ${minutes}</span>${why ? ` &mdash; ${why}` : ''}.`,
        done > 0
          ? `You have already journaled ${done === 1 ? 'one day' : `${done} days`}. Your dashboard keeps the count, so a day you skip shows up.`
          : 'Your first entry is the hard one. Thirty seconds after your next trade, typed messy or said out loud, and Nova does the rest.',
      ],
      cta: 'Log today’s trade',
      href: `${SITE}/journal`,
    };
  }

  if (kind === 'day3') {
    const w = WATCH[c.struggle ?? ''] ?? WATCH.not_sure;
    return { subject: w.subject, heading: w.subject, paragraphs: [w.body], cta: 'Open your journal', href: `${SITE}/journal` };
  }

  if (kind === 'day7') {
    return {
      subject: `Halfway: ${done} of ${target} days`,
      heading: `${done} of ${target} days`,
      paragraphs: [
        done === 0
          ? 'Nothing logged yet, and that is fine. Today counts as much as day one would have.'
          : `That is ${done} day${done === 1 ? '' : 's'} of entries Nova can actually compare. The more of them there are, the more specific it gets about what you keep doing.`,
        'Ask Nova one question this week: "What is my biggest leak right now?" It answers from your own entries, not from the internet.',
      ],
      cta: 'Ask Nova',
      href: `${SITE}/nova`,
    };
  }

  /* The reminder - plain, specific, and easy to act on either way. */
  const amount = money(c.unit_amount, c.billing_interval);
  return {
    subject: `Your free trial ends ${longDate(c.trial_end)}`,
    heading: 'Two days left on your trial',
    paragraphs: [
      `On <span style="color:#ffffff;">${longDate(c.trial_end)}</span> your trial ends and your first payment${amount ? ` of <span style="color:#ffffff;">${amount}</span>` : ''} is taken.`,
      'If TradeX is worth keeping, you do not need to do anything. If it is not, cancel in Settings under Billing &mdash; two clicks &mdash; and you will not be charged.',
      done > 0 ? `So far you have journaled ${done} day${done === 1 ? '' : 's'}.` : '',
    ].filter(Boolean),
    cta: 'Manage my plan',
    href: `${SITE}/settings`,
  };
}

function html(heading: string, paragraphs: string[], cta: string, href: string, unsubscribeUrl: string | null): string {
  const body = paragraphs
    .map((t) => `<p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#8b8b8b;">${t}</p>`)
    .join('');
  const footer = unsubscribeUrl
    ? `You are getting this because you started a TradeX trial.<br><a href="${unsubscribeUrl}" style="color:#777777;">Unsubscribe</a> from trial tips.`
    : 'This is a billing notice about your TradeX trial.';
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
                    <h1 style="margin:0 0 16px 0;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${heading}</h1>
                    ${body}
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px;">
                      <tr>
                        <td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:999px;">
                          <a href="${href}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#000000;text-decoration:none;">${cta}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 8px 0 8px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#555555;">${footer}</p>
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
  if (!cronSecret || req.headers.get('X-Cron-Secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  const { data: flag } = await supabase.from('internal_config').select('value').eq('key', 'trial_emails_enabled').maybeSingle();
  const enabled = flag?.value === 'true';
  const dryRun = !enabled || new URL(req.url).searchParams.get('dry_run') === '1';

  const { data: rows, error } = await supabase.rpc('trial_email_candidates');
  if (error) {
    console.error('trial candidate lookup failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const now = Date.now();
  const plan = ((rows ?? []) as Candidate[])
    .map((c) => ({ c, kind: due(c, now) }))
    .filter((x): x is { c: Candidate; kind: Kind } => x.kind !== null);

  if (dryRun) {
    return new Response(
      JSON.stringify({
        dry_run: true,
        enabled,
        trialing: (rows ?? []).length,
        would_send: plan.map(({ c, kind }) => ({ kind, email: c.email.replace(/^(.).*(@.*)$/, '$1***$2'), subject: compose(kind, c).subject })),
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const { c, kind } of plan) {
    /* Recorded before the send: never sending twice beats never missing one. */
    const { data: record, error: recordError } = await supabase
      .from('trial_emails')
      .insert({ user_id: c.user_id, kind })
      .select('unsubscribe_token')
      .single();
    if (recordError || !record) {
      failures.push(`record ${c.user_id}/${kind}: ${recordError?.message}`);
      continue;
    }

    /* The billing reminder carries no unsubscribe: it is a notice about money, not a tip. */
    const unsubscribeUrl = kind === 'reminder'
      ? null
      : `${Deno.env.get('SUPABASE_URL')}/functions/v1/email-unsubscribe?token=${record.unsubscribe_token}`;
    const m = compose(kind, c);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [c.email],
          subject: m.subject,
          html: html(m.heading, m.paragraphs, m.cta, m.href, unsubscribeUrl),
          ...(unsubscribeUrl
            ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
            : {}),
        }),
      });
      if (!res.ok) {
        failures.push(`send ${c.user_id}/${kind}: ${res.status} ${await res.text()}`);
        continue;
      }
      sent += 1;
    } catch (err) {
      failures.push(`send ${c.user_id}/${kind}: ${(err as Error).message}`);
    }
  }

  if (failures.length) console.error('trial email failures:', failures);
  return new Response(JSON.stringify({ sent, attempted: plan.length, failed: failures.length }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
