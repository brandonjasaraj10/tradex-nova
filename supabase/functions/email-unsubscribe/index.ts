import { createClient } from 'npm:@supabase/supabase-js@2';

/*
  One-click unsubscribe.

  verify_jwt is off on purpose, and it is the right call here: somebody who
  wants out of an email should not have to remember a password to get out of
  it, and a sign-in wall on an unsubscribe link is the fastest way to be
  reported as spam instead. The token in the link is a random UUID tied to a
  single send, which is the proof - it grants nothing except the ability to
  stop receiving mail.

  Handles POST as well as GET because Gmail and Apple Mail's native
  unsubscribe button sends a POST (RFC 8058 one-click). Refusing that is a
  common bug and it costs sender reputation - the button appears to fail and
  the reader presses spam instead.
*/

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

function page(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:460px;margin:0 auto;padding:80px 24px;text-align:center;">
    <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.4px;margin:0 0 12px;">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#8b8b8b;margin:0 0 28px;">${body}</p>
    <a href="https://www.tradexnova.com" style="display:inline-block;padding:12px 26px;border-radius:999px;background:#fff;color:#000;font-size:14px;font-weight:600;text-decoration:none;">Back to TradeX</a>
  </div>
</body></html>`,
    { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const token = new URL(req.url).searchParams.get('token');
  if (!token) return page('Link not recognised', 'That unsubscribe link is missing its code.');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  /*
    Two kinds of token now reach this one endpoint.

    An abandoned-signup token belongs to an account, and the address has to
    be looked up through auth. An audit token belongs to somebody who has no
    account at all - they answered six questions and left an email - so the
    address is on the row itself.

    One endpoint rather than two because an unsubscribe link should work
    whatever it came from, and because the suppression list is shared: a
    person who opts out through one email must not keep receiving the other.
  */
  const { data: abandonRecord } = await supabase
    .from('abandon_signup_emails')
    .select('user_id')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  const { data: auditRecord } = abandonRecord ? { data: null } : await supabase
    .from('psychology_audits')
    .select('email')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (!abandonRecord && !auditRecord) {
    return page('Link not recognised', 'That unsubscribe link is not one of ours, or it has already been used.');
  }

  let email: string | undefined;
  let userId: string | null = null;
  let reason: string;

  if (abandonRecord) {
    const { data: user } = await supabase.auth.admin.getUserById(abandonRecord.user_id);
    email = user?.user?.email;
    userId = abandonRecord.user_id;
    reason = 'unsubscribed_abandon_email';
  } else {
    email = (auditRecord as { email: string | null } | null)?.email ?? undefined;
    reason = 'unsubscribed_audit_email';
  }

  if (!email) return page('Something went wrong', 'We could not find that address. Email tradenovaai@gmail.com and we will take care of it.');

  await supabase.from('email_suppressions').insert({
    user_id: userId,
    email,
    reason,
  });

  return page(
    'Unsubscribed',
    'You will not get any more emails like that one. Account and password emails still work, because you would want those.',
  );
});
