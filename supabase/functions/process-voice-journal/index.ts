import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.116.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { correctTradingTerms, TRADING_VOCABULARY_SYSTEM_PROMPT, INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT } from "../_shared/tradingVocabulary.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY ?? '' });
const MODEL = 'claude-sonnet-5';

/*
  Every call here bills Anthropic (~$0.023 - the instrument vocabulary makes
  this a ~5,500 token request). Unmetered, one signed-in account looping this
  could run up roughly $1,900/day.

  300/day caps a single account near $6.75. Measured heavy journalling is
  about 5 organizes a day, so the fence sits well clear of anyone real -
  20/minute exists only to stop a retry loop, since nobody dictates a journal
  entry every three seconds.
*/
const PER_MINUTE_LIMIT = 20;
const DAILY_LIMIT = 300;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { transcript, systemPrompt, existingEntry } = await req.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    /*
      Identity comes from the caller's own JWT, never the request body - a
      body-supplied id would let anyone spend someone else's quota and make
      the limit meaningless.
    */
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usageCheck, error: usageError } = await supabaseClient
      .rpc('check_and_increment_nova_usage', {
        p_user_id: authUser.id,
        p_per_minute_limit: PER_MINUTE_LIMIT,
        p_daily_limit: DAILY_LIMIT,
        p_feature: 'voice_journal',
      })
      .single();

    /*
      A failing limiter must not take the feature down with it - log and
      carry on, same as nova-chat. The cost ceiling matters, but not more
      than the product working.
    */
    if (usageError) {
      console.error('Rate limit check failed:', usageError);
    } else if (usageCheck && !(usageCheck as any).allowed) {
      const message = (usageCheck as any).reason === 'daily_limit'
        ? "You've hit today's limit for organizing entries with Nova. It resets at midnight."
        : "That's a lot at once - give it a few seconds and try again.";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply trading term corrections to transcript
    const correctedTranscript = correctTradingTerms(transcript);

    console.log('Processing voice journal:', {
      hasTranscript: !!transcript,
      hasSystemPrompt: !!systemPrompt,
      hasExistingEntry: !!existingEntry,
      corrected: correctedTranscript !== transcript
    });

    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Enhance system prompt with trading vocabulary instructions
    const enhancedSystemPrompt = systemPrompt + TRADING_VOCABULARY_SYSTEM_PROMPT + INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT;
    console.log('System prompt length:', enhancedSystemPrompt.length);

    /*
      Tuned for latency - "Organize with Nova" was taking well over 20
      seconds and users sit and watch it.

      effort 'low': this is mechanical extraction into a fixed schema, not
      a reasoning problem. Medium effort spends thinking tokens deliberating
      over a task whose answer is already stated in the transcript.

      max_tokens 2048: the reply is one small JSON object. 8192 left room
      for a runaway response to keep generating long past the useful answer,
      and generation length is the dominant cost here.
    */
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low' },
      system: enhancedSystemPrompt,
      messages: [{ role: 'user', content: correctedTranscript }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const jsonResponse = textBlock?.text;

    if (!jsonResponse) {
      throw new Error('No response from Claude');
    }

    return new Response(
      JSON.stringify({ result: jsonResponse }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing voice journal:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process voice journal',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
