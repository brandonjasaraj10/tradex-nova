import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { clientSafeMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradeJournalData {
  symbol?: string;
  direction?: 'long' | 'short';
  trade_duration?: string;
  entry_reason?: string;
  exit_reason?: string;
  pre_trade_notes?: string;
  during_trade_notes?: string;
  post_trade_notes?: string;
  pnl?: number | string;
  risk_to_reward?: string;
  session?: string;
  position_size?: string;
  entry_price?: string;
  stop_loss?: string;
  take_profit?: string;
  timeframe?: string;
  entry_time?: string;
  exit_time?: string;
}

interface PsychologyJournalData {
  emotional_state?: string;
  stress_level?: number;
  discipline_level?: string;
  confidence_level?: string;
  psychology_notes?: string;
  mistakes_or_triggers?: string;
  lessons_learned?: string;
  mood_rating?: number;
  decision_quality_score?: number;
  emotions?: string[];
}

interface JournalLogRequest {
  content?: string;
  category: 'trade' | 'psychology';
  title?: string;
  mood?: string;
  tags?: string[];
  entry_date?: string;
  trade_data?: TradeJournalData;
  psychology_data?: PsychologyJournalData;
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

    const payload: JournalLogRequest = await req.json();

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

    if (!payload.category) {
      return new Response(
        JSON.stringify({ error: 'Category is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const hasContent = payload.content && payload.content.trim().length > 0;
    const hasTradeData = payload.trade_data && Object.keys(payload.trade_data).length > 0;
    const hasPsychologyData = payload.psychology_data && Object.keys(payload.psychology_data).length > 0;

    if (!hasContent && !hasTradeData && !hasPsychologyData) {
      return new Response(
        JSON.stringify({ error: 'At least content, trade_data, or psychology_data is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const folderName = 'Daily Journal';
    const templateType = 'daily';

    let folder;

    const { data: existingByType } = await supabaseClient
      .from('journal_folders')
      .select('*')
      .eq('user_id', userId)
      .eq('template_type', templateType)
      .maybeSingle();

    if (existingByType) {
      folder = existingByType;
    } else {
      const { data: existingByName } = await supabaseClient
        .from('journal_folders')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', folderName)
        .maybeSingle();

      if (existingByName) {
        const { data: updated } = await supabaseClient
          .from('journal_folders')
          .update({ template_type: templateType })
          .eq('id', existingByName.id)
          .select()
          .single();

        folder = updated || existingByName;
      } else {
      const { data: maxOrder } = await supabaseClient
        .from('journal_folders')
        .select('order_index')
        .eq('user_id', userId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxOrder?.order_index ?? -1) + 1;

      const { data: newFolder, error: folderError } = await supabaseClient
        .from('journal_folders')
        .insert({
          user_id: userId,
          name: folderName,
          description: 'Your daily trading journal for all trades and reflections',
          color: '#3B82F6',
          order_index: nextOrder,
          template_type: templateType,
        })
        .select()
        .single();

      if (folderError) throw folderError;
      folder = newFolder;
      }
    }

    // Last-resort fallback only - a server-side Deno function has no way to
    // know the user's timezone on its own, so this is UTC "today", not
    // theirs. nova-chat (the only real caller) now always resolves and
    // passes entry_date itself using the client's actual local date before
    // reaching here; this only fires if that resolution somehow failed.
    const entryDate = payload.entry_date || new Date().toISOString().split('T')[0];

    const { data: entriesForDate } = await supabaseClient
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('folder_id', folder.id)
      .eq('entry_date', entryDate)
      .order('created_at', { ascending: true });

    const allEntriesForDate = entriesForDate || [];

    // A trade log whose symbol doesn't match any entry already logged
    // today is a different position, not more detail on one already
    // here - each position gets its own entry, since symbol/direction/
    // position_size/manual_pnl can each only hold one trade's values.
    // Psychology-only logs (and trades matching an existing entry's
    // symbol) still merge into that entry, same as before.
    const newSymbol = payload.category === 'trade' ? payload.trade_data?.symbol?.trim().toUpperCase() : undefined;
    const existingEntry = newSymbol
      ? allEntriesForDate.find((e: any) => (e.symbol || '').trim().toUpperCase() === newSymbol)
      : allEntriesForDate[allEntriesForDate.length - 1];

    // Still the same trading day/session, so a freshly split-off position
    // entry carries forward the day's mood/psychology context - only the
    // position-specific fields below reset, not the whole day.
    const carryOverTemplateData = (!existingEntry && allEntriesForDate.length > 0)
      ? (allEntriesForDate[allEntriesForDate.length - 1].template_data || {})
      : {};

    let templateData: any = { ...carryOverTemplateData };
    let symbol: string | undefined;
    let tradeDuration: string | undefined;
    let positionSize: string | undefined;
    let manualPnl: number | undefined;
    let entryTitle: string | undefined;
    let entryMood: string | undefined;
    let entryContent: string = '';

    if (payload.category === 'trade' && payload.trade_data) {
      const td = payload.trade_data;
      symbol = td.symbol;
      tradeDuration = td.trade_duration;
      positionSize = td.position_size;
      manualPnl = typeof td.pnl === 'number' ? td.pnl : undefined;

      templateData = {
        ...carryOverTemplateData,
        direction: td.direction,
        entry_reason: td.entry_reason,
        exit_reason: td.exit_reason,
        pre_trade_notes: td.pre_trade_notes,
        during_trade_notes: td.during_trade_notes,
        post_trade_notes: td.post_trade_notes,
        pnl: td.pnl,
        risk_to_reward: td.risk_to_reward,
        session: td.session,
        entry_price: td.entry_price,
        stop_loss: td.stop_loss,
        take_profit: td.take_profit,
        timeframe: td.timeframe,
        entry_time: td.entry_time,
        exit_time: td.exit_time,
      };

      if (payload.content) {
        entryContent = payload.content;
      } else {
        const parts: string[] = [];
        if (td.pre_trade_notes) parts.push(`**Pre-Trade:** ${td.pre_trade_notes}`);
        if (td.during_trade_notes) parts.push(`**During Trade:** ${td.during_trade_notes}`);
        if (td.post_trade_notes) parts.push(`**Post-Trade:** ${td.post_trade_notes}`);
        if (td.entry_reason) parts.push(`**Entry Reason:** ${td.entry_reason}`);
        if (td.exit_reason) parts.push(`**Exit Reason:** ${td.exit_reason}`);
        entryContent = parts.join('\n\n');
      }

      entryTitle = payload.title || `${symbol || 'Trade'} ${td.direction || ''} - ${entryDate}`.trim();
    } else if (payload.category === 'psychology' && payload.psychology_data) {
      const pd = payload.psychology_data;
      entryMood = payload.mood || pd.emotional_state;

      templateData = {
        ...carryOverTemplateData,
        emotional_state: pd.emotional_state,
        stress_level: pd.stress_level,
        discipline_level: pd.discipline_level,
        confidence_level: pd.confidence_level,
        mistakes_or_triggers: pd.mistakes_or_triggers,
        lessons_learned: pd.lessons_learned,
        mood_rating: pd.mood_rating,
        decision_quality_score: pd.decision_quality_score,
        emotions: pd.emotions,
      };

      if (payload.content) {
        entryContent = payload.content;
      } else {
        const parts: string[] = [];
        if (pd.psychology_notes) parts.push(pd.psychology_notes);
        if (pd.emotional_state) parts.push(`**Emotional State:** ${pd.emotional_state}`);
        if (pd.stress_level) parts.push(`**Stress Level:** ${pd.stress_level}/10`);
        if (pd.mistakes_or_triggers) parts.push(`**Triggers:** ${pd.mistakes_or_triggers}`);
        if (pd.lessons_learned) parts.push(`**Lessons:** ${pd.lessons_learned}`);
        entryContent = parts.join('\n\n');
      }

      entryTitle = payload.title || `Psychology Entry - ${entryDate}`;
    } else {
      entryContent = payload.content || '';
      entryTitle = payload.title || `${folderName} Entry - ${entryDate}`;
    }

    let journalEntry;

    if (existingEntry) {
      const mergedTemplateData = {
        ...(existingEntry.template_data || {}),
        ...templateData,
      };

      const updatedContent = existingEntry.content && entryContent
        ? `${existingEntry.content}\n\n---\n\n${entryContent}`
        : entryContent || existingEntry.content;

      const { data: updated, error: updateError } = await supabaseClient
        .from('journal_entries')
        .update({
          content: updatedContent,
          title: entryTitle || existingEntry.title,
          mood: entryMood || existingEntry.mood,
          tags: payload.tags || existingEntry.tags,
          symbol: symbol || existingEntry.symbol,
          trade_duration: tradeDuration || existingEntry.trade_duration,
          position_size: positionSize || existingEntry.position_size,
          manual_pnl: manualPnl !== undefined ? manualPnl : existingEntry.manual_pnl,
          template_data: mergedTemplateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingEntry.id)
        .select()
        .single();

      if (updateError) throw updateError;
      journalEntry = updated;
    } else {
      const { data: created, error: createError } = await supabaseClient
        .from('journal_entries')
        .insert({
          user_id: userId,
          folder_id: folder.id,
          entry_date: entryDate,
          title: entryTitle,
          content: entryContent,
          mood: entryMood,
          tags: payload.tags || [],
          attachments: [],
          symbol,
          trade_duration: tradeDuration,
          position_size: positionSize,
          manual_pnl: manualPnl,
          template_data: templateData,
        })
        .select()
        .single();

      if (createError) throw createError;
      journalEntry = created;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Entry logged in ${folderName} journal`,
        entry: journalEntry,
        folder: folder,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error logging journal entry:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to log journal entry',
        details: clientSafeMessage(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
