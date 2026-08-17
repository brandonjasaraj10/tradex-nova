import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.116.0";
import { correctTradingTerms, TRADING_VOCABULARY_SYSTEM_PROMPT } from "../_shared/tradingVocabulary.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY ?? '' });
const MODEL = 'claude-sonnet-5';

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

    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Enhance system prompt with trading vocabulary instructions
    const enhancedSystemPrompt = systemPrompt + TRADING_VOCABULARY_SYSTEM_PROMPT;
    console.log('System prompt length:', enhancedSystemPrompt.length);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      output_config: { effort: 'medium' },
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
