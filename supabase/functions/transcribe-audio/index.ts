import { createClient } from 'npm:@supabase/supabase-js@2';

/*
  Turns a short voice recording into text, for browsers with no built-in
  speech recognition.

  WHY THIS EXISTS

  The mic everywhere in TradeX used the browser's own speech recognition,
  which only exists in some browsers - and not at all in Instagram's in-app
  browser, where most new visitors arrive. So for most people the mic simply
  never appeared, and "journal by voice", the thing the ads lead with, was
  invisible on the first screen where it mattered. Recording the audio in the
  page and transcribing it here works in nearly any modern browser.

  OpenAI's transcription, because the key is already configured for Nova's
  spoken replies (nova-tts) and Anthropic has no speech-to-text. The trading
  vocabulary goes in as a prompt so "euro dollar" and "NQ" survive.

  LIMITS, SAME SHAPE AS process-voice-journal

  Signed-in callers only (identity from their JWT). An account without an
  active subscription gets 3 a day, 3 a minute - enough for onboarding's one
  entry plus retries. Recordings over ~3 MB (several minutes) are refused.
*/

const PER_MINUTE_LIMIT = 10;
const DAILY_LIMIT = 150;
const UNPAID_PER_MINUTE_LIMIT = 3;
const UNPAID_DAILY_LIMIT = 3;
const MAX_BYTES = 3 * 1024 * 1024;

const VOCABULARY =
  'Trading journal entry. Terms: long, short, lot, lots, contract, stop loss, take profit, R, pips, ' +
  'EURUSD, GBPUSD, USDJPY, XAUUSD, gold, NQ, ES, nasdaq, S&P, BTC, ETH, prop firm, challenge, funded, ' +
  'drawdown, revenge trade, London open, New York session, breakeven, scaled out.';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'Transcription is not configured' }, 500);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  /* Fails closed to the unpaid limits. */
  const { data: subscribed, error: subError } = await supabase.rpc('has_active_subscription');
  if (subError) console.error('Subscription check failed:', subError);
  const paid = subscribed === true;

  let audio: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('audio');
    audio = f instanceof File ? f : null;
  } catch {
    return json({ error: 'Expected an audio recording' }, 400);
  }
  if (!audio || audio.size === 0) return json({ error: 'Expected an audio recording' }, 400);
  if (audio.size > MAX_BYTES) return json({ error: 'That recording is a bit long - keep it to a minute or two.' }, 413);

  const { data: usage, error: usageError } = await supabase
    .rpc('check_and_increment_nova_usage', {
      p_user_id: user.id,
      p_per_minute_limit: paid ? PER_MINUTE_LIMIT : UNPAID_PER_MINUTE_LIMIT,
      p_daily_limit: paid ? DAILY_LIMIT : UNPAID_DAILY_LIMIT,
      p_feature: 'transcribe',
    })
    .single();
  if (usageError) {
    console.error('Rate limit check failed:', usageError);
  } else if (usage && !(usage as { allowed: boolean }).allowed) {
    const daily = (usage as { reason: string }).reason === 'daily_limit';
    return json({
      error: daily
        ? (paid ? "You've hit today's voice limit. It resets at midnight." : "That's the free voice entries used for today - you can still type it.")
        : "That's a lot at once - give it a few seconds and try again.",
    }, 429);
  }

  const upstream = new FormData();
  upstream.append('file', audio, audio.name || 'entry.webm');
  upstream.append('model', 'gpt-4o-mini-transcribe');
  upstream.append('prompt', VOCABULARY);
  upstream.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });
  if (!res.ok) {
    console.error('Transcription failed:', res.status, await res.text());
    return json({ error: 'Could not make out that recording - try again, or type it.' }, 502);
  }
  const { text } = await res.json();
  return json({ text: (text ?? '').trim() });
});
