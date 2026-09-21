import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.116.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { correctTradingTerms, TRADING_VOCABULARY_SYSTEM_PROMPT, INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT } from "../_shared/tradingVocabulary.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY ?? '' });
const DEFAULT_MODEL = 'claude-sonnet-5';

/*
  Only these two, and only by exact name.

  The model is chosen by the caller so the live passes during dictation can
  use a faster one than a considered rewrite needs. It arrives in a request
  body, which is not trusted - an open field here would let anyone point
  this project's key at whatever model they liked and bill it to us.
*/
const ALLOWED_MODELS = new Set(['claude-sonnet-5', 'claude-haiku-4-5']);

/*
  Not every model takes it.

  Haiku 4.5 rejects output_config.effort outright - a 400 back from the API,
  which surfaced here as a 500 one second into the call. Sending the
  parameter unconditionally made the model field look broken when the model
  was fine.
*/
const MODELS_WITH_EFFORT = new Set(['claude-sonnet-5']);

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
    const { transcript, systemPrompt, balanceContext, existingEntry, stream, model } = await req.json();

    const selectedModel = typeof model === 'string' && ALLOWED_MODELS.has(model)
      ? model
      : DEFAULT_MODEL;

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

    /*
      Everything that does not change goes in front of one breakpoint.

      The first version of this cached only the vocabulary - about 1,965
      tokens - and left the caller's own prompt, 7,668 tokens and identical
      on every single call, to be re-read in full every time. That is three
      quarters of the cost of a call, and it was the half worth caching.

      The account balance is the only part that genuinely varies, so it goes
      after the breakpoint in its own block. Nothing else moves: the blocks
      are concatenated in the same order the single string used to be in, so
      the model reads exactly the same text it read before.
    */
    const stableBlocks: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: TRADING_VOCABULARY_SYSTEM_PROMPT + INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT,
      },
      /*
        Only when there is one. systemPrompt comes off the request body and
        can be absent; concatenating it used to make the string "undefined..."
        which was ugly but harmless, whereas an empty text block is rejected
        outright by the API.
      */
      ...(typeof systemPrompt === 'string' && systemPrompt.trim()
        ? [{ type: 'text', text: systemPrompt }]
        : []),
    ];

    /*
      The breakpoint sits on the LAST stable block, not a fixed one - a
      breakpoint only covers what precedes it, so pinning it to the
      vocabulary would leave the prompt after it uncached again. When there
      is no caller prompt, the vocabulary is the last stable block and takes
      it instead.
    */
    stableBlocks[stableBlocks.length - 1].cache_control = { type: 'ephemeral' };

    const systemBlocks = [
      ...stableBlocks,
      ...(typeof balanceContext === 'string' && balanceContext.trim()
        ? [{ type: 'text', text: balanceContext }]
        : []),
    ];
    console.log(
      'System prompt length:',
      (TRADING_VOCABULARY_SYSTEM_PROMPT + INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT + (systemPrompt ?? '') + (balanceContext ?? '')).length,
    );

    /*
      Streaming is opt-in, and deliberately so.

      Organize takes 8-10 seconds against a real transcript, and the
      measurement said almost all of it is Claude writing the answer, not
      reading the prompt - so there is no version of this that finishes
      quickly. What streaming changes is the waiting: the client can parse
      the JSON as it arrives and fill the entry in as it is written, instead
      of showing a spinner until the whole object lands.

      The flag matters because the edge function deploys to everyone the
      moment it ships, while the frontend that understands a stream does
      not. Without an opt-in, a deploy would hand the live site a response
      shape it cannot read. Old clients send no flag and get the same
      single JSON body they always did.
    */
    if (stream === true) {
      const claudeStream = anthropic.messages.stream({
        model: selectedModel,
        max_tokens: 2048,
        ...(MODELS_WITH_EFFORT.has(selectedModel) ? { output_config: { effort: 'low' as const } } : {}),
        system: systemBlocks,
        messages: [{ role: 'user', content: correctedTranscript }],
      });

      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          try {
            for await (const event of claudeStream) {
              if (
                event.type === 'content_block_delta' &&
                (event.delta as { type?: string }).type === 'text_delta'
              ) {
                send({ text: (event.delta as { text: string }).text });
              }
            }

            /*
              The final message carries the usage numbers, which is the only
              place the cache can be checked on a streamed call.
            */
            const final = await claudeStream.finalMessage();
            console.log('cache', JSON.stringify({
              created: (final.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
              read: (final.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
              input: final.usage.input_tokens,
              output: final.usage.output_tokens,
            }));
            send({ done: true });
          } catch (streamError) {
            /*
              An error partway through cannot change the status code - the
              200 and the headers are long gone. It has to travel as an
              event so the client can tell a failure from a short answer,
              rather than silently keeping half an entry.
            */
            console.error('Streaming error:', streamError);
            send({ error: (streamError as Error).message ?? 'stream failed' });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

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
      model: selectedModel,
      max_tokens: 2048,
      ...(MODELS_WITH_EFFORT.has(selectedModel) ? { output_config: { effort: 'low' as const } } : {}),
      system: systemBlocks,
      messages: [{ role: 'user', content: correctedTranscript }],
    });

    /*
      Logged so the cache can be checked rather than believed. A cold call
      reports cache_creation_input_tokens and a warm one reports
      cache_read_input_tokens; if the warm number never appears, the
      breakpoint is in the wrong place.
    */
    console.log('cache', JSON.stringify({
      created: (response.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
      read: (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
      input: response.usage.input_tokens,
    }));

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
