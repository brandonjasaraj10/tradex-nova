import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  feedback?: 'up' | 'down' | null;
}

export class NovaAIService {
  private sessionId: string;
  private userId: string | null = null;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || crypto.randomUUID();
  }

  async initialize() {
    const { data: { user } } = await supabase.auth.getUser();
    this.userId = user?.id || null;
  }

  async loadChatHistory(): Promise<ChatMessage[]> {
    if (!this.userId) return [];

    const { data, error } = await supabase
      .from('nova_chat_messages')
      .select('*')
      .eq('user_id', this.userId)
      .eq('session_id', this.sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading chat history:', error);
      return [];
    }

    const feedbackMap = await this.loadFeedbackMap(data.map(msg => msg.id));

    return data.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
      feedback: feedbackMap.get(msg.id) ?? null
    }));
  }

  async loadFeedbackMap(messageIds: string[]): Promise<Map<string, 'up' | 'down'>> {
    const feedbackMap = new Map<string, 'up' | 'down'>();
    if (!this.userId || messageIds.length === 0) return feedbackMap;

    const { data, error } = await supabase
      .from('nova_message_feedback')
      .select('message_id, rating')
      .eq('user_id', this.userId)
      .in('message_id', messageIds);

    if (error) {
      console.error('Error loading message feedback:', error);
      return feedbackMap;
    }

    for (const row of data) {
      feedbackMap.set(row.message_id, row.rating);
    }
    return feedbackMap;
  }

  async submitFeedback(messageId: string, rating: 'up' | 'down' | null): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    if (rating === null) {
      const { error } = await supabase
        .from('nova_message_feedback')
        .delete()
        .eq('user_id', this.userId)
        .eq('message_id', messageId);

      if (error) {
        console.error('Error clearing message feedback:', error);
        throw error;
      }
      return;
    }

    const { error } = await supabase
      .from('nova_message_feedback')
      .upsert(
        {
          user_id: this.userId,
          message_id: messageId,
          rating,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'message_id,user_id' }
      );

    if (error) {
      console.error('Error saving message feedback:', error);
      throw error;
    }
  }

  async saveMessage(role: 'user' | 'assistant', content: string, id?: string): Promise<string> {
    if (!this.userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('nova_chat_messages')
      .insert({
        id,
        user_id: this.userId,
        role,
        content,
        session_id: this.sessionId
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving message:', error);
      throw error;
    }

    return data.id;
  }

  async clearHistory(): Promise<void> {
    if (!this.userId) return;

    const { error } = await supabase
      .from('nova_chat_messages')
      .delete()
      .eq('user_id', this.userId)
      .eq('session_id', this.sessionId);

    if (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }

  async generateResponse(userMessage: string, conversationHistory: ChatMessage[], images?: string[]): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return 'Please log in to use Nova AI assistant.';
      }

      const messages = [
        ...conversationHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: 'user', content: userMessage }
      ];

      const requestBody: any = {
        messages,
        user: { id: session.user.id }
      };

      if (images && images.length > 0) {
        requestBody.images = images;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nova-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        console.error('Nova AI API error:', response.statusText);
        return this.getFallbackResponse(userMessage, conversationHistory);
      }

      const data = await response.json();

      if (data.error) {
        console.error('Nova AI error:', data.error);
        return this.getFallbackResponse(userMessage, conversationHistory);
      }

      if (data.tool_calls && data.tool_calls.length > 0) {
        window.dispatchEvent(new CustomEvent('nova-tool-call', {
          detail: { tool_calls: data.tool_calls }
        }));
      }

      return data.text;
    } catch (error) {
      console.error('Error calling Nova AI:', error);
      return this.getFallbackResponse(userMessage, conversationHistory);
    }
  }

  private async getFallbackResponse(userMessage: string, conversationHistory: ChatMessage[]): Promise<string> {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('analyze') || lowerMessage.includes('performance')) {
      const insights = await this.getPerformanceInsights();
      return `I've analyzed your recent trading activity. Here's what I found:\n\n${insights}`;
    }

    if (lowerMessage.includes('confluence') || lowerMessage.includes('trading plan') || lowerMessage.includes('rules')) {
      const confluences = await this.getConfluences();
      return `Here are your trading confluences:\n\n${confluences}\n\nWould you like me to help you add, edit, or analyze these rules?`;
    }

    if (lowerMessage.includes('trade') && (lowerMessage.includes('recent') || lowerMessage.includes('latest'))) {
      const trades = await this.getRecentTrades();
      return `Here are your recent trades:\n\n${trades}`;
    }

    if (lowerMessage.includes('score') || lowerMessage.includes('nova score')) {
      const score = await this.getNovaScore();
      return `Your current NOVA Score:\n\n${score}`;
    }

    if (lowerMessage.includes('psychology') || lowerMessage.includes('mental') || lowerMessage.includes('emotional') || lowerMessage.includes('mindset')) {
      const psychologyInsights = await this.getPsychologyInsights();
      return psychologyInsights;
    }

    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      return this.getHelpMessage();
    }

    if (lowerMessage.includes('insight') || lowerMessage.includes('pattern') || lowerMessage.includes('trend')) {
      return await this.getPatternInsights();
    }

    return this.getContextualResponse(userMessage, conversationHistory);
  }

  private async getPerformanceInsights(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'Please log in to view your performance metrics.';

      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })
        .limit(50);

      if (!trades || trades.length === 0) {
        return 'No trades found yet. Start adding trades and I\'ll give you a full performance breakdown!';
      }

      const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
      const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
      const winRate = (winningTrades.length / trades.length * 100).toFixed(1);
      const avgWin = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / (winningTrades.length || 1);
      const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / (losingTrades.length || 1));
      const avgRR = (avgWin / avgLoss).toFixed(2);

      return `Here's a quick look at your recent performance:\n\nWin Rate: ${winRate}%\nAverage R:R: ${avgRR}:1\nTotal Trades: ${trades.length}\nWinning Trades: ${winningTrades.length}\nLosing Trades: ${losingTrades.length}\n\nWould you like me to dig deeper into specific patterns or time periods?`;
    } catch (error) {
      console.error('Error getting performance insights:', error);
      return 'Unable to fetch performance data right now. Please try again.';
    }
  }

  private async getConfluences(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'Please log in to view your confluences.';

      const { data: confluences } = await supabase
        .from('trading_confluences')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!confluences || confluences.length === 0) {
        return 'No confluences set up yet.\n\nConfluences are key rules that must align before taking a trade. Would you like me to help you set some up?';
      }

      const confluenceList = confluences.map((c, i) =>
        `${i + 1}. ${c.name}${c.description ? ` - ${c.description}` : ''}`
      ).join('\n');

      return `Your Trading Confluences:\n\n${confluenceList}\n\nMinimum Required: ${confluences[0]?.minimum_required || 3}\n\nThese are your trading rules. All must align before entering a trade.`;
    } catch (error) {
      console.error('Error getting confluences:', error);
      return 'Unable to fetch confluence data. Please try again.';
    }
  }

  private async getRecentTrades(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'Please log in to view your trades.';

      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })
        .limit(5);

      if (!trades || trades.length === 0) {
        return 'No trades found yet. Start logging your trades to track your progress!';
      }

      const tradeList = trades.map((t, i) => {
        const pnl = t.pnl || 0;
        const result = pnl > 0 ? 'W' : 'L';
        return `${i + 1}. ${t.symbol} (${result}) -- ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
      }).join('\n');

      return `Your Recent Trades:\n\n${tradeList}\n\nWould you like a detailed breakdown of any of these?`;
    } catch (error) {
      console.error('Error getting recent trades:', error);
      return 'Unable to fetch trade data. Please try again.';
    }
  }

  private async getNovaScore(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'Please log in to view your NOVA Score.';

      const { data: scoreData } = await supabase
        .from('nova_score')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!scoreData) {
        return 'Your NOVA Score will be calculated once you have enough trading data. Keep logging trades and I\'ll provide your personalized score!';
      }

      const factors = (scoreData.factors || {}) as any;
      return `Your NOVA Score: ${scoreData.score}/100\n\nBreakdown:\n1. Win Rate: ${factors.win_rate?.toFixed(1)}%\n2. Profit Factor: ${factors.profit_factor?.toFixed(2)}\n3. Avg W/L Ratio: ${factors.avg_win_loss_ratio?.toFixed(2)}\n4. Total Trades: ${factors.total_trades}\n\nThis score reflects your overall trading consistency and performance.`;
    } catch (error) {
      console.error('Error getting NOVA score:', error);
      return 'Unable to fetch NOVA Score right now. Please try again.';
    }
  }

  private async getPatternInsights(): Promise<string> {
    return 'Based on your trading history, here are some areas I can analyze:\n\n1. Best trading times and sessions\n2. Highest win rate setups\n3. Most profitable pairs or symbols\n4. Risk management and position sizing patterns\n\nWould you like me to pull your data and dive deeper into any of these?';
  }

  private async getPsychologyInsights(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'Please log in to view your psychology insights.';

      const { data: entries } = await supabase
        .from('journal_entries')
        .select('template_data, created_at')
        .eq('user_id', user.id)
        .not('template_data', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!entries || entries.length === 0) {
        return 'I don\'t have any psychology journal entries from you yet. Start tracking your mental and emotional states and I\'ll give you personalized insights on patterns, stress levels, decision quality, and more.\n\nYou can log psychology entries through your journal or just tell me how you\'re feeling right now.';
      }

      const recentEntries = entries.filter(e => e.template_data && Object.keys(e.template_data).length > 0);
      if (recentEntries.length === 0) {
        return 'Start using the psychology template in your journal to unlock personalized insights! I\'ll analyze your emotional patterns over time.';
      }

      const avgMood = recentEntries
        .map(e => e.template_data?.pre_trade_mindset?.mood_rating)
        .filter(m => m !== undefined)
        .reduce((sum, rating, _, arr) => sum + rating / arr.length, 0);

      const avgDecisionQuality = recentEntries
        .map(e => e.template_data?.decision_quality_score)
        .filter(s => s !== undefined)
        .reduce((sum, score, _, arr) => sum + score / arr.length, 0);

      const latestEntry = recentEntries[0];
      const latestNovaScore = latestEntry?.template_data?.end_of_day_summary?.nova_score;
      const latestState = latestEntry?.template_data?.end_of_day_summary?.psychological_state;

      const allEmotions = recentEntries
        .flatMap(e => e.template_data?.emotional_checkin?.emotions || []);
      const emotionCounts = allEmotions.reduce((acc, emotion) => {
        acc[emotion] = (acc[emotion] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topEmotions = Object.entries(emotionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([emotion]) => emotion);

      let insight = 'PSYCHOLOGY INSIGHTS\n\n';

      if (latestNovaScore !== undefined) {
        insight += `Latest Psychology Score: ${latestNovaScore}/100\n`;
        insight += `Current State: ${latestState === 'excellent' ? 'Excellent' : latestState === 'moderate' ? 'Moderate' : 'Challenging'}\n\n`;
      }

      insight += `Your Patterns:\n`;
      insight += `Average Mood: ${avgMood.toFixed(1)}/10\n`;
      insight += `Decision Quality: ${avgDecisionQuality.toFixed(1)}/10\n`;

      if (topEmotions.length > 0) {
        insight += `Top Emotions: ${topEmotions.join(', ')}\n`;
      }

      insight += `\nRecommendation:\n`;
      if (avgMood < 6) {
        insight += 'Your mood has been below average. Consider taking breaks and practicing self-care before trading.';
      } else if (avgDecisionQuality < 6) {
        insight += 'Focus on improving decision quality by reviewing your trading rules before each trade.';
      } else {
        insight += 'You\'re maintaining good psychological balance. Keep tracking your mental state to identify patterns.';
      }

      insight += '\n\nI\'m continuously analyzing your psychology journal entries to spot trends and provide better support. Keep journaling!';

      return insight;
    } catch (error) {
      console.error('Error getting psychology insights:', error);
      return 'Unable to fetch psychology data right now. Please try again.';
    }
  }

  private getHelpMessage(): string {
    return `I'm Nova, the AI built into TradeX. I'm not just a chatbot -- I'm deeply connected to your trading data and I'm always analyzing it in the background. Here's what I can do:\n\n1. Performance Analysis -- I can pull your real trading data and break down your win rate, profit factor, best pairs, worst sessions, and more.\n\n2. Trading Plan Management -- I can review your confluences, check your rule adherence, and help you optimize your strategy.\n\n3. Trade Insights -- I'll spot patterns in your trading, identify what's working, and flag what needs attention.\n\n4. Psychology Support -- I track your emotional patterns, stress levels, and decision quality over time. I can help you build better mental habits.\n\n5. NOVA Score -- I'll explain your score breakdown and what you can do to improve it.\n\n6. Journal Logging -- Just tell me about a trade or how you're feeling, and I'll log it automatically.\n\nJust ask me anything about your trading and I'll pull the data to give you a real answer.`;
  }

  private getContextualResponse(message: string, history: ChatMessage[]): string {
    const recentTopics = history.slice(-3).map(m => m.content.toLowerCase());

    if (recentTopics.some(t => t.includes('confluence'))) {
      return 'Based on our conversation about confluences, would you like me to help you add a new rule or analyze how well you\'re following your existing ones?';
    }

    if (recentTopics.some(t => t.includes('performance') || t.includes('analyze'))) {
      return 'I can dive deeper into your performance metrics. Would you like me to analyze a specific time period or trading setup?';
    }

    return `I hear you. Right now I can help you with performance analysis, trading psychology, journal logging, rule compliance, pattern recognition, and your NOVA Score.\n\nCould you rephrase that or tell me a bit more about what you're looking for? I can also pull your recent trading data if that would help.`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  newSession(): void {
    this.sessionId = crypto.randomUUID();
  }
}

export async function sendNovaMessage(messages: Array<{ role: string; content: string }>): Promise<string> {
  const novaService = new NovaAIService();
  await novaService.initialize();

  const userMessage = messages[messages.length - 1]?.content || '';
  const chatHistory: ChatMessage[] = messages.slice(0, -1).map((msg, idx) => ({
    id: `msg-${idx}`,
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }));

  const response = await novaService.generateResponse(userMessage, chatHistory);
  return response;
}
