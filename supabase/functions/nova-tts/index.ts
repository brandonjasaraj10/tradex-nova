import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

/*
  Speech is the most expensive thing per month in the whole product. It bills
  per character on tts-1-hd (the higher-quality, double-price tier, kept
  deliberately) with no caching to soften it - unlike chat, where a cached
  system prompt keeps 150 messages near $2. Modelled out, a daily voice user
  was costing more in speech alone than the founder plan brings in.

  150/day caps one account around $2.70/day. That is still five spoken
  replies an hour, all day, so it stays clear of real conversation while
  making an unattended loop bounded.
*/
const PER_MINUTE_LIMIT = 15;
const DAILY_LIMIT = 150;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    /*
      Identity from the caller's own JWT, never the request body - a
      body-supplied id would let anyone spend someone else's quota.
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
        p_feature: 'tts',
      })
      .single();

    // A failing limiter must not silence Nova - log and continue.
    if (usageError) {
      console.error('Rate limit check failed:', usageError);
    } else if (usageCheck && !(usageCheck as any).allowed) {
      const message = (usageCheck as any).reason === 'daily_limit'
        ? "You've reached today's limit for Nova speaking out loud. It resets at midnight - she can still reply in text."
        : "Give it a moment before asking Nova to speak again.";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text }: RequestPayload = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: 'nova',
        input: text,
        speed: 1.0,
        response_format: 'opus',
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI TTS API error:', errorData);
      throw new Error('TTS generation failed');
    }

    const audioData = await openaiResponse.arrayBuffer();

    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/ogg',
        'Content-Length': audioData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error in nova-tts function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate speech',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});