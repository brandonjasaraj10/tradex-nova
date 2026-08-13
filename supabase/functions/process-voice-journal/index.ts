import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { correctTradingTerms, TRADING_VOCABULARY_SYSTEM_PROMPT } from "../_shared/tradingVocabulary.ts";

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

    // Apply trading term corrections to transcript
    const correctedTranscript = correctTradingTerms(transcript);

    console.log('Processing voice journal:', {
      hasTranscript: !!transcript,
      hasSystemPrompt: !!systemPrompt,
      hasExistingEntry: !!existingEntry,
      corrected: correctedTranscript !== transcript
    });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API Key status:', OPENAI_API_KEY ? 'Present (length: ' + OPENAI_API_KEY.length + ')' : 'MISSING');

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Enhance system prompt with trading vocabulary instructions
    const enhancedSystemPrompt = systemPrompt + TRADING_VOCABULARY_SYSTEM_PROMPT;
    console.log('System prompt length:', enhancedSystemPrompt.length);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          { role: 'user', content: correctedTranscript }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      throw new Error('Failed to process voice input with OpenAI');
    }

    const data = await openaiResponse.json();
    const jsonResponse = data.choices[0]?.message?.content;

    if (!jsonResponse) {
      throw new Error('No response from OpenAI');
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
