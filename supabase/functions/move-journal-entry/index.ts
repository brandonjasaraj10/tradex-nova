import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { clientSafeMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MoveEntryRequest {
  from_date: string;
  to_date?: string;
  account_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const payload: MoveEntryRequest = await req.json();

    if (!payload.from_date) {
      return new Response(
        JSON.stringify({ error: 'from_date is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.to_date && !payload.account_name) {
      return new Response(
        JSON.stringify({ error: 'Provide to_date, account_name, or both' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    const userId = user.id;

    const { data: folder } = await supabaseClient
      .from('journal_folders')
      .select('id')
      .eq('user_id', userId)
      .eq('template_type', 'daily')
      .maybeSingle();

    if (!folder) {
      return new Response(
        JSON.stringify({ error: `No journal entry found on ${payload.from_date}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: entry } = await supabaseClient
      .from('journal_entries')
      .select('id, entry_date, title, account_id')
      .eq('user_id', userId)
      .eq('folder_id', folder.id)
      .eq('entry_date', payload.from_date)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!entry) {
      return new Response(
        JSON.stringify({ error: `No journal entry found on ${payload.from_date}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, unknown> = {};

    if (payload.to_date) {
      updates.entry_date = payload.to_date;
    }

    let matchedAccountName: string | null = null;
    if (payload.account_name) {
      const { data: account } = await supabaseClient
        .from('user_broker_connections')
        .select('id, account_name')
        .eq('user_id', userId)
        .ilike('account_name', payload.account_name)
        .maybeSingle();

      if (!account) {
        return new Response(
          JSON.stringify({ error: `No trading account named "${payload.account_name}" found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      updates.account_id = account.id;
      matchedAccountName = account.account_name;
    }

    const { data: updated, error: updateError } = await supabaseClient
      .from('journal_entries')
      .update(updates)
      .eq('id', entry.id)
      .select('id, entry_date, title, account_id')
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Moved "${entry.title || 'entry'}" from ${payload.from_date}${payload.to_date ? ` to ${payload.to_date}` : ''}${matchedAccountName ? `, reassigned to ${matchedAccountName}` : ''}`,
        entry: updated,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error moving journal entry:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to move journal entry',
        details: clientSafeMessage(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
