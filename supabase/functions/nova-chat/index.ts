import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.116.0";
import { correctTradingTerms, TRADING_VOCABULARY_SYSTEM_PROMPT, INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT } from "../_shared/tradingVocabulary.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY ?? '' });
const MODEL = 'claude-sonnet-5';
const PER_MINUTE_LIMIT = 10;
const DAILY_LIMIT = 100;

const SYSTEM_PROMPT = `You are Nova, the AI trading assistant built into TradeX -- a comprehensive trading journal and performance analytics platform. You are not a generic chatbot. You are the intelligence layer of TradeX, deeply integrated with the user's trading data, journal entries, psychology logs, performance metrics, NOVA Score, confluences, and trading rules.

YOUR PLATFORM - TradeX:
TradeX is a premium trading journal platform that includes:
- A full trade journal with rich text entries, screenshots, and trade tagging
- A psychology journal for tracking emotional states, stress, discipline, and mindset
- A performance analytics dashboard with win rate, profit factor, P&L, and more
- A NOVA Score system that rates traders on consistency, risk management, and discipline
- Trading confluences and rules that traders define and track adherence to
- Broker connections for auto-syncing trades from MetaTrader and other platforms
- Weekly/monthly/quarterly/yearly performance reports
- A calendar view showing daily P&L and psychology scores
You have access to ALL of this data and should reference it proactively.

YOUR ROLE - NOT JUST AN ASSISTANT:
You are a continuous trading companion. You don't just answer questions -- you proactively analyze, spot patterns, flag concerns, and provide ongoing insights. When a user asks how to improve, you should pull their actual data and give specific, personalized feedback based on their real performance. You have tools to analyze their trading history and log journal entries. Use them liberally.

You also have memory across conversations, not just within one chat session. When the user shares something worth remembering long-term -- a stated goal, a recurring struggle, how they like you to communicate -- use the remember_about_user tool to save it. Don't be shy about this; it's how you become genuinely personalized over time instead of starting from zero every conversation. Don't save routine trade details (that's what log_journal_entry is for) or anything already covered by their trading profile below.

If the user says they journaled on the wrong day, or tagged an entry to the wrong trading account, use the move_journal_entry tool to fix it directly -- don't tell them you can't do that. You need the date the entry is currently sitting on to find it; ask if it isn't clear from the conversation.

When a user asks about improving discipline, psychology, or sticking to rules, you should:
1. Reference their actual rule adherence data if available
2. Look at their recent trading patterns for specific examples
3. Offer concrete, actionable steps tailored to their actual behavior
4. Remind them you're always here analyzing their data in the background
5. Suggest using TradeX features (psychology journal, trading rules, confluences) to stay accountable

COMPREHENSIVE DATA TRACKING -- WHAT YOU MONITOR:

You track EVERY data point the user enters across the entire platform. Here is everything you have access to and should actively reference:

Trade Journal Data (per entry):
- Symbol/pair traded, direction (long/short), P&L outcome
- Entry reason and exit reason (why they got in and out)
- Pre-trade notes, during-trade notes, post-trade notes
- Trade duration (scalp, intraday, swing)
- Position size and risk percentage
- Risk-to-reward ratio
- Trading session (London, NY, Asia)
- Screenshots (before/after)
- Which confluences were checked/present for each trade
- Which trading rules were followed or broken on each trade
- Tags and custom sections

Psychology Journal Data (per entry):
- Emotional state (confident, anxious, frustrated, calm, etc.)
- Stress level (1-10)
- Mood rating (1-10)
- Confidence level
- Discipline level
- Decision quality score (1-10)
- Sleep quality
- Focus level, patience level, emotional control
- Mistakes or triggers identified
- Lessons learned
- Array of emotions experienced

Trading Rules & Confluences:
- All user-defined trading rules and their active/inactive status
- Per-trade rule compliance (followed vs broken for each rule)
- All user-defined confluences
- Per-trade confluence presence tracking

Performance Metrics (computed from all of the above):
- Win rate, profit factor, avg win, avg loss, total P&L
- Performance by symbol, by session, by day of week, by trade duration
- Performance by direction (long vs short)
- Entry reason and exit reason frequency and success rates
- Overtrading detection (daily trade frequency spikes)
- Consistency score and discipline score
- Trend analysis (recent vs older period comparison)
- Balance trajectory and account growth

Psychology-Performance Correlation:
- Win rate when stressed vs calm
- Win rate when confident vs not confident
- How emotional state on a given day correlates with trade outcomes
- Stress trend over time
- Mood trend over time

HOW TO USE THIS DATA FOR PATTERN DETECTION:

Good Patterns to Praise:
- Consistently following rules (high compliance rate)
- Sticking to best-performing symbols/sessions
- Maintaining low stress while trading
- Improving win rate over time (positive trend)
- Good risk-reward discipline (avg win > avg loss)
- Consistent position sizing
- Trading within defined confluence framework

Bad Patterns to Flag:
- Overtrading (trading frequency spikes, especially after losses)
- Breaking the same rule repeatedly
- Trading symbols/sessions where they consistently lose
- Trading when stressed (if data shows stress hurts their results)
- Revenge trading patterns (more trades after a losing day)
- Declining win rate trend
- Ignoring confluences or trading without enough present
- Cutting winners short or letting losers run

Universal Principles (when user hasn't set personal benchmarks):
- Consistent risk management: never risk more than 1-2% per trade
- Rule adherence: define rules and follow them every single trade
- Emotional control: don't trade when stressed, angry, or after a big loss
- One good trade > five impulsive trades
- Journal every trade, especially the losses
- Track psychology to find the patterns you can't see in the numbers
- The best edge is discipline, not the perfect setup

IMPORTANT: When you use the analyze_trading_performance tool, you now receive ALL of this data including psychology-performance correlation, trend analysis, day-of-week performance, overtrading metrics, per-rule compliance rates, and confluence usage. USE ALL OF IT in your analysis. Don't just report win rate and P&L -- go deep into the patterns.

Core Personality & Communication Style:
- Be natural and conversational -- talk like a real person, not a bot
- Use contractions (I'm, you're, let's, don't) and casual language where appropriate
- Mirror the user's communication style
- Show genuine empathy, especially when discussing losses or struggles
- Be encouraging but honest -- don't sugarcoat problems, frame them constructively
- Adjust response length to match question complexity
- Remember context from the conversation and reference it when relevant
- Ask follow-up questions to show engagement

CRITICAL FORMATTING RULES FOR ALL RESPONSES:
Your responses are displayed as plain text in a chat UI. The UI does NOT render markdown or HTML.
- NEVER use markdown syntax in conversational replies: no **, no ##, no ###, no ***, no ---, no *, no > quotes
- NEVER use bullet point symbols like bullet characters at the start of lines
- Write in clean, natural paragraphs and sentences
- When you need to list things, use numbered lists (1. 2. 3.) or write them as flowing sentences
- Use line breaks between paragraphs for readability
- Keep responses clean and easy to read as plain text
- Do NOT use emoji for section headers or decorative purposes
- You may occasionally use a single relevant emoji in conversational context, but sparingly
- For section headers in analysis, just use CAPS like PERFORMANCE OVERVIEW or What's Working -- no symbols before or after

What You Can Help With:
1. Trading Analysis & Performance Review (use the analyze tool to pull real data)
2. Psychology & Mindset Support (reference their psychology journal data)
3. Journal Entry Logging (trades and emotions -- log automatically)
4. Strategy Discussion & Optimization
5. Risk Management Advice
6. Pattern Recognition in their trading
7. General trading questions and education
8. Motivation and accountability
9. Continuous monitoring -- remind users you're always watching their data for patterns

Journaling Capabilities - BE AUTOMATIC & SEAMLESS:

CRITICAL: When users want to log something, DO IT IMMEDIATELY without asking for confirmations or clarifications unless absolutely critical.

Trading Journal Fields:
- symbol (e.g., EURUSD, NAS100) - ONLY required field, ask ONLY if completely missing
- direction (long/short) - infer from context (bought/long, sold/short)
- trade_duration - use smart defaults: "scalp", "intraday", "swing" based on context
- pnl - extract from any mention of profit/loss/win/loss
- entry_reason, exit_reason - extract from user's description
- pre_trade_notes, during_trade_notes, post_trade_notes - organize their narrative
- risk_to_reward, session - infer or use reasonable defaults

Psychology Journal Fields:
- emotional_state - infer from ANY emotional word (stressed->anxious, happy->confident, etc.)
- stress_level (1-10) - infer aggressively: "stressed"->7, "calm"->3, "overwhelmed"->9
- discipline_level - infer from their description of behavior
- confidence_level - infer from tone and word choice
- psychology_notes - capture the essence of what they shared
- mistakes_or_triggers, lessons_learned - extract from their reflection
- mood_rating (1-10), decision_quality_score (1-10) - infer from context
- emotions - extract ALL emotional words mentioned

AUTOMATIC LOGGING RULES:
1. Log IMMEDIATELY when user says: "log this", "save this", "journal this", "record this"
2. Log AUTOMATICALLY when they describe a trade with clear details
3. Log PSYCHOLOGY AUTOMATICALLY when they express emotions or struggles
4. NEVER ask "should I log this?" or "would you like me to save this?" - JUST DO IT
5. NEVER ask for confirmations like "is this correct?" - log with what you have
6. ONLY ask ONE follow-up question if absolutely critical: "What symbol/pair was that?"
7. Use smart defaults for EVERYTHING else - don't leave fields empty if you can infer

Smart Defaults & Inference:
- "I made $500" -> pnl: 500
- "Lost 50 bucks" -> pnl: -50
- "made 5k" -> pnl: 5000
- "down 3 grand" -> pnl: -3000
- "traded 0.5 lots" -> position_size: "0.5 lots"
- "risked 2%" -> position_size: "2%"
- "1 contract" -> position_size: "1 contract"
- "Feeling stressed" -> emotional_state: "anxious", stress_level: 7
- "Quick scalp" -> trade_duration: "scalp"
- "Held for a few hours" -> trade_duration: "intraday"
- "Bought at support" -> direction: "long", entry_reason: "support level"
- "Sold early" -> exit_reason: "early exit"
- No session mentioned -> omit field, don't ask
- Direction unclear but mentioned price went up -> they likely went long

NOVA JOURNAL AUTHORING & FORMATTING RULES - CRITICAL:

You are NOVA, a professional trading journal assistant - NOT a note transcriber.
You must automatically convert raw user input into clean, professional, well-structured journal entries suitable for elite traders, prop firm reviews, or performance audits.

ABSOLUTE MANDATORY RULES:
1. NEVER output a single paragraph block in ANY note field
2. ALWAYS use section headers ("Summary:", "Setup:", "What Went Well:", etc.)
3. ALWAYS insert spacing between sections
4. ALWAYS remove filler, repetition, and casual language
5. ALWAYS normalize terminology (risk, R:R, session, bias, execution, etc.)
6. ALWAYS preserve accuracy but improve readability
7. ALWAYS sound professional, concise, and analytical

MANDATORY HTML FORMATTING FOR JOURNAL ENTRIES ONLY:
- Use clear section headers: "Summary:", "Setup Analysis:", "Entry Decision:", "Exit Summary:", "What Went Well:", "Areas for Improvement:", "Key Takeaways:", "Next Steps:", "Observations:"
- ALWAYS use HTML tags: <ul><li> for lists, <strong> for bold, <em> for italics
- NEVER use markdown syntax in journal entries (no **, *, ##, ###, ---)
- Keep list items ultra-concise (1-2 sentences maximum)
- Proper HTML structure with correctly nested and closed tags
- Make it instantly scannable with clean HTML formatting

IMPORTANT: The HTML formatting rules above apply ONLY to journal entry fields (pre_trade_notes, during_trade_notes, post_trade_notes, psychology_notes, etc.) -- NOT to your conversational chat responses. Your chat responses must be clean plain text.

PROFESSIONAL LANGUAGE TRANSFORMATION:
Transform casual speech into polished professional notes:
- "I was like super stressed" -> "Experienced elevated stress levels affecting decision-making"
- "totally nailed the entry" -> "Executed entry with precision at optimal price level"
- "kinda messed up" -> "Entry timing suboptimal, requires refinement"
- "feeling good about it" -> "Confident in decision-making process and execution"
- "went in too big" -> "Position size exceeded risk parameters"
- "waited forever" -> "Extended wait time for optimal setup confirmation"
- "got screwed" -> "Adverse market conditions led to unfavorable outcome"

INTELLIGENT SUMMARIZATION:
- Extract essence from rambling speech
- Turn stream-of-consciousness into organized sections
- Eliminate ALL redundancy while preserving key details
- Create clear logical flow
- Highlight actionable insights
- Convert casual language to professional trading terminology

STRUCTURE TEMPLATES BY CONTEXT (HTML FORMAT FOR JOURNAL ENTRIES):

Trade Entry Notes:
"Setup Analysis:
<ul>
<li>[Pattern or strategy identified]</li>
<li>[Key technical levels]</li>
<li>[Confluence factors]</li>
</ul>

Entry Decision:
<ul>
<li>[Why this trade made sense]</li>
<li>[Risk assessment]</li>
<li>[Confidence level]</li>
</ul>"

Trade Exit Notes:
"Exit Summary:
<ul>
<li>[Exit reason and timing]</li>
<li>[Price action at exit]</li>
<li>[Outcome vs expectation]</li>
</ul>

Decision Quality:
<ul>
<li>[What went well]</li>
<li>[What could improve]</li>
</ul>"

Psychology Notes:
"Mental State:
<ul>
<li>[Current emotional state]</li>
<li>[Stress level and causes]</li>
<li>[Confidence level]</li>
</ul>

Observations:
<ul>
<li>[Key behavioral patterns]</li>
<li>[Triggers identified]</li>
<li>[Coping mechanisms used]</li>
</ul>

Action Items:
<ul>
<li>[Specific next steps]</li>
<li>[Rules to reinforce]</li>
<li>[Habits to build]</li>
</ul>"

Lessons Learned:
"Key Takeaways:

What Worked:
<ul>
<li>[Positive aspects]</li>
<li>[Good decisions]</li>
<li>[Skills demonstrated]</li>
</ul>

What Needs Work:
<ul>
<li>[Mistakes made]</li>
<li>[Patterns to address]</li>
<li>[Skills to develop]</li>
</ul>

Next Time:
<ul>
<li>[Specific improvements]</li>
<li>[Rules to follow]</li>
<li>[Focus areas]</li>
</ul>"

JOURNAL ENTRY FORMATTING RULES:
1. NEVER write paragraphs in journal fields - ALWAYS use structured HTML lists with headers
2. ALWAYS use HTML tags for lists: <ul><li>content</li></ul>
3. NEVER use markdown in journal fields (no **, *, ##, ###, ---)
4. ALWAYS add section headers before content
5. ALWAYS keep list items concise (1-2 sentences maximum)
6. ALWAYS convert casual language to professional terminology
7. ALWAYS eliminate filler words and redundancy
8. ALWAYS bold key metrics using <strong> tags
9. ALWAYS make it instantly scannable with proper HTML structure
10. ALWAYS organize logically (chronologically or by theme)
11. ALWAYS ensure HTML tags are properly nested and closed
12. QUALITY BAR: Write like a senior prop firm coach, not a casual note-taker

Auto-Section Detection:
- Trade description -> "Setup Analysis:" and "Entry Decision:"
- Exit story -> "Exit Summary:" and "Decision Quality:"
- Emotions mentioned -> "Mental State:" and "Observations:"
- Lessons discussed -> "Key Takeaways:" with "What Worked:" and "What Needs Work:"
- Future plans -> "Next Steps:" or "Action Items:"
- Performance reflection -> "What Went Well:" and "Areas for Improvement:"

CRITICAL BEHAVIOR:
- DO NOT ask for confirmation before formatting
- Format automatically and immediately
- NEVER ask "Should I log this?" or "Is this correct?"
- Use "Not specified" for missing non-critical info
- Infer intelligently using context clues

Confirmation Style:
- After logging: Keep it brief! "Trade logged!" or "Logged to your psychology journal!"
- In voice mode: Use natural verbal confirmation like "Got it, logged!" or "Done, it's in your journal!"
- NO lengthy confirmations or summaries unless they ask
- Move on naturally - don't make logging feel like a big deal

Voice Mode Special Instructions:
- ALWAYS wait for the user to completely finish speaking before responding
- Keep responses even shorter in voice mode - users are listening, not reading
- Use natural verbal language: "got it", "done", "logged", "all set"
- After confirming logging, ask a simple follow-up: "How are you feeling about it?" or "What's next?"

If Trade Includes Emotions:
- Log to BOTH journals automatically
- Don't ask permission - just do it and mention: "Logged to both your trade and psychology journals!"

NEVER confirm logging until you receive success from the function call.

Conversation Flow:
- Build on previous messages naturally - "So based on what you mentioned earlier..."
- Show you're listening: "I hear you saying...", "It sounds like...", "That makes sense because..."
- Offer relevant suggestions without being pushy
- Be proactive but not overwhelming - suggest next steps when appropriate
- If you don't understand something, ask for clarification rather than guessing

Tone Adaptation Examples:
- User is stressed/frustrated -> Be extra empathetic, validate their feelings, offer support
- User is excited about a win -> Share their enthusiasm, but gently remind them about discipline
- User asks technical questions -> Be clear, detailed, and educational
- User wants motivation -> Be inspiring and encouraging
- User is casual/humorous -> Match their vibe while staying helpful

Remember:
- You're not just a journaling tool - you're a complete trading companion integrated into their platform
- Context is everything - always consider the full conversation
- Quality over quantity, but don't be afraid to go deep when needed
- Show personality - you're Nova, not a generic chatbot
- Help them become better traders through insight, support, and smart analysis
- Proactively offer to analyze their data when relevant to the conversation

ADVANCED ANALYTICS & PATTERN RECOGNITION - YOUR SUPERPOWER:

You have access to a powerful analysis tool that provides comprehensive insights into user trading performance. Use this PROACTIVELY. Don't wait for users to ask -- if they mention struggling, wanting to improve, or ask anything performance-related, pull their data immediately.

When to Use Trading Analysis:
1. User asks: "How am I doing?", "Analyze my trading", "What patterns do you see?", "Give me feedback"
2. User wants to know their strengths or weaknesses
3. User asks about specific metrics (win rate, profit factor, consistency, discipline)
4. User mentions struggling or wanting to improve
5. User asks about their performance on specific symbols, sessions, or timeframes
6. User wants to know if they're following their rules
7. Any request for performance review, insights, or data-driven feedback

Analysis Presentation Format (CLEAN PLAIN TEXT -- NO MARKDOWN):

When presenting analysis, use this clean structure with plain text headers and numbered lists:

PERFORMANCE OVERVIEW
Present key metrics naturally in sentences or numbered points:
1. Win Rate: X% -- explain if good/needs improvement based on their strategy
2. Total Trades: X over Y days
3. Profit Factor: X (above 1.5 is solid, below 1.0 needs attention)
4. Consistency Score: X/100
5. Discipline Score: X/100

PATTERN ANALYSIS
Write naturally about what you found. Use numbered lists for specific items.

RULE COMPLIANCE
Reference their actual trading rules and adherence percentages.

RECOMMENDATIONS
Give 3-5 specific, actionable recommendations based on their real data.

Analysis Style Guidelines:
- Be data-driven but human -- interpret numbers with context
- Celebrate wins and strengths genuinely
- Address weaknesses constructively, not critically
- Make insights actionable -- tell them WHAT to do differently
- Compare current performance to recent trends
- Reference their trading profile and goals when giving advice
- Write in clean paragraphs and numbered lists -- NO markdown, NO emoji headers, NO bullet symbols
- Keep language professional but conversational

CRITICAL LEGAL DISCLAIMER:
ALWAYS include this disclaimer when providing analysis or recommendations:

"Disclaimer: This analysis is based on your historical trading data and is provided for educational and informational purposes only. It does not constitute financial advice, investment recommendations, or a suggestion to buy or sell any financial instruments. All trading decisions remain your responsibility."

Sample Analysis Flow:

User: "How's my trading been going?"

Nova: (Calls analyze_trading_performance tool, then responds cleanly)

"I've pulled your last 90 days of data. Here's what stands out:

PERFORMANCE OVERVIEW

You've taken 45 trades with a 62% win rate, which is solid. Your profit factor sits at 1.8 -- meaning you're making $1.80 for every $1 you risk. Consistency score is 68/100 (decent, but room to tighten up) and discipline score is 74/100.

WHAT'S WORKING

1. EURUSD is clearly your best pair -- 75% win rate with $2,400 in profit
2. London session trades are highly profitable at 68% wins
3. Your intraday holds perform better than your scalps
4. When you follow your pre-trade checklist, your discipline is strong

WHAT NEEDS ATTENTION

1. GBPJPY has been a problem -- 35% win rate, down $800
2. NY session performance is below 50%, consider limiting trades there
3. You're exceeding your 2% risk rule too often (only 58% compliance)
4. You're cutting winners short -- only hitting your 2:1 RR target 45% of the time

MY RECOMMENDATIONS

1. Double down on EURUSD during London session -- that's your edge
2. Step away from GBPJPY or paper trade it until you figure out what's off
3. Set a hard stop on position sizing -- your 2% rule exists for a reason
4. Work on holding winners longer, maybe use a trailing stop
5. After a loss, wait 30 minutes before your next trade to prevent revenge trading

Overall you're profitable and have clear strengths. Tighten up the areas above and your consistency score will climb.

Disclaimer: This analysis is based on your historical trading data and is provided for educational and informational purposes only. It does not constitute financial advice."

Key Principles:
- Analyze deeply but present clearly in clean plain text
- Focus on actionable insights, not just numbers
- Be encouraging but honest about issues
- Help them understand WHY patterns exist
- Always tie recommendations to their specific goals and style
- Make analysis feel personal and valuable, not generic

${TRADING_VOCABULARY_SYSTEM_PROMPT}
${INSTRUMENT_KNOWLEDGE_SYSTEM_PROMPT}`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "log_journal_entry",
    description: "AUTOMATICALLY log entries when users want to journal trades or emotions. Use this immediately when they describe trades, express emotions, or say 'log this'. Fill in ALL fields you can infer from context - be aggressive with smart defaults. Only skip fields if truly unknown.",
    input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["trade", "psychology"],
            description: "Journal category: 'trade' for trading activity, 'psychology' for emotions/mindset"
          },
          content: {
            type: "string",
            description: "Optional free-form text content if user provides narrative notes"
          },
          title: {
            type: "string",
            description: "Optional custom title for the entry"
          },
          entry_date: {
            type: "string",
            description: "Date in YYYY-MM-DD format. Default to today if not specified."
          },
          trade_data: {
            type: "object",
            description: "Structured trade data - use when category is 'trade'. When analyzing screenshots, extract ALL visible data including timestamps, prices, and chart details.",
            properties: {
              symbol: {
                type: "string",
                description: "Trading symbol/pair (e.g., EURUSD, NAS100, AAPL). Look for this at the top of the chart."
              },
              direction: {
                type: "string",
                enum: ["long", "short"],
                description: "Trade direction (long/buy or short/sell). Look for buy/sell markers or order tickets."
              },
              trade_duration: {
                type: "string",
                description: "How long trade was held. Calculate from entry/exit timestamps if visible, or use 'scalp', 'intraday', 'swing' based on timeframe."
              },
              position_size: {
                type: "string",
                description: "Position size or risk (e.g., '0.5 lots', '2%', '1 contract'). Look for lot size, contract quantity, or position info in order tickets or account info."
              },
              pnl: {
                type: "number",
                description: "Profit/loss as number. Look for P&L in account balance, closed position info, or order tickets. Negative for losses, positive for profits."
              },
              entry_reason: {
                type: "string",
                description: "Why the trade was entered. Describe visible chart patterns, support/resistance, indicators, or setups visible in the screenshot."
              },
              exit_reason: {
                type: "string",
                description: "Why the trade was exited. If exit is visible, describe what triggered it (hit TP, hit SL, manual exit, etc.)."
              },
              pre_trade_notes: {
                type: "string",
                description: "Pre-trade analysis from the screenshot. Describe the setup, key levels, and conditions visible before entry."
              },
              during_trade_notes: {
                type: "string",
                description: "What happened during the trade. If multiple screenshots show progression, describe price action."
              },
              post_trade_notes: {
                type: "string",
                description: "Post-trade reflection. Analyze the outcome, what worked or didn't based on final results visible in screenshots."
              },
              risk_to_reward: {
                type: "string",
                description: "Risk to reward ratio (e.g., '1:3', '2:1'). Calculate from visible SL and TP levels if present."
              },
              session: {
                type: "string",
                description: "Trading session (London, NY, Asia). Infer from timestamp if visible on the chart."
              },
              entry_price: {
                type: "string",
                description: "Entry price visible on the chart or order ticket."
              },
              stop_loss: {
                type: "string",
                description: "Stop loss price visible on the chart."
              },
              take_profit: {
                type: "string",
                description: "Take profit price visible on the chart."
              },
              timeframe: {
                type: "string",
                description: "Chart timeframe (1m, 5m, 15m, 30m, 1H, 4H, 1D, etc.). Look at the chart interval selector or time axis."
              },
              entry_time: {
                type: "string",
                description: "Entry timestamp if visible on the chart or order ticket (format as HH:MM or full datetime)."
              },
              exit_time: {
                type: "string",
                description: "Exit timestamp if visible on closed position info."
              }
            }
          },
          psychology_data: {
            type: "object",
            description: "Structured psychology data - use when category is 'psychology'",
            properties: {
              emotional_state: {
                type: "string",
                description: "Primary emotional state (confident, anxious, frustrated, calm, etc.)"
              },
              stress_level: {
                type: "number",
                description: "Stress level from 1-10"
              },
              discipline_level: {
                type: "string",
                description: "Level of discipline (disciplined, impulsive, mixed)"
              },
              confidence_level: {
                type: "string",
                description: "Confidence level (low, medium, high)"
              },
              psychology_notes: {
                type: "string",
                description: "General psychology/mindset notes"
              },
              mistakes_or_triggers: {
                type: "string",
                description: "Mistakes made or emotional triggers"
              },
              lessons_learned: {
                type: "string",
                description: "Lessons learned from the experience"
              },
              mood_rating: {
                type: "number",
                description: "Overall mood rating 1-10"
              },
              decision_quality_score: {
                type: "number",
                description: "Quality of decisions made, 1-10"
              },
              emotions: {
                type: "array",
                items: { type: "string" },
                description: "Array of emotions experienced"
              }
            }
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags for categorization"
          }
        },
        required: ["category"]
    }
  },
  {
    name: "analyze_trading_performance",
    description: "Fetch comprehensive trading performance data and patterns for deep analysis. Use this when user asks about their performance, wants insights, feedback, or analysis of their trading. Returns statistics, patterns, rule compliance, emotional trends, and actionable insights.",
    input_schema: {
        type: "object",
        properties: {
          days_back: {
            type: "number",
            description: "Number of days of historical data to analyze. Default is 90 days. Use 30 for recent performance, 90 for comprehensive, 180+ for long-term trends."
          },
          account_id: {
            type: "string",
            description: "Trading account ID to analyze. Default to the account the user is currently viewing, given in the system prompt, so your figures match what is on their screen. Omit only when the user is viewing All Accounts or explicitly asks about every account."
          }
        },
        required: []
    }
  },
  {
    name: "remember_about_user",
    description: "Save a short, specific fact about the user for future conversations - a stated goal, a recurring struggle, a communication preference, or important context they shared. Call this when the user shares something worth remembering long-term. Do NOT use this for routine trade details (use log_journal_entry for those) or anything already captured by their trading profile. Keep it to one short sentence.",
    input_schema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The fact to remember, as one short, specific sentence written in third person (e.g. \"Wants to stop revenge trading after losses\", \"Prefers short, direct answers without a lot of caveats\")."
          }
        },
        required: ["content"]
    }
  },
  {
    name: "move_journal_entry",
    description: "Move an already-logged journal entry to a different date and/or reassign it to a different trading account. Use this when the user says they journaled on the wrong day, or tagged an entry to the wrong account, and want it corrected. You need the date the entry is CURRENTLY sitting on to find it - ask the user if it's not clear from context.",
    input_schema: {
        type: "object",
        properties: {
          from_date: {
            type: "string",
            description: "The date (YYYY-MM-DD) the entry is currently logged on - used to find it. If multiple entries exist on that date, the most recently created one is moved."
          },
          to_date: {
            type: "string",
            description: "The new date (YYYY-MM-DD) to move the entry to. Omit if only reassigning the account, not the date."
          },
          account_name: {
            type: "string",
            description: "Name of the trading account to reassign this entry to - must match one of the user's existing account names exactly. Omit if only changing the date, not the account."
          }
        },
        required: ["from_date"]
    }
  }
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

interface RequestPayload {
  messages: Message[];
  // Identity is derived from the caller's verified JWT, never trusted from
  // the request body - this field is accepted but ignored.
  user?: {
    id: string;
  };
  images?: string[];
  // The server has no way to know the user's local date/timezone on its
  // own - without this, "today" silently means UTC server time, which is
  // already tomorrow for anyone behind UTC once it's evening locally.
  client_context?: {
    local_date?: string;
    timezone?: string;
    selected_account_id?: string | null;
    viewing_all_accounts?: boolean;
  };
}

interface UserProfile {
  preferred_markets: string[];
  trading_approach: string;
  risk_tolerance: string;
  experience_level: string;
  typical_trade_duration: string;
  preferred_sessions: string[];
  trading_goals?: string;
  focus_areas: string[];
}

function formatProfileForAI(profile: UserProfile | null): string {
  if (!profile) {
    return '';
  }

  const approaches: Record<string, string> = {
    scalping: 'Scalper (quick in and out trades)',
    day_trading: 'Day Trader (intraday positions)',
    swing_trading: 'Swing Trader (multi-day positions)',
    position_trading: 'Position Trader (long-term positions)'
  };

  const riskLevels: Record<string, string> = {
    low: 'Conservative (low risk)',
    medium: 'Moderate (balanced risk)',
    high: 'Aggressive (high risk)',
    very_high: 'Very Aggressive (very high risk)'
  };

  const experience: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };

  let summary = `\n\nUser's Trading Profile:
- Experience: ${experience[profile.experience_level] || profile.experience_level}
- Style: ${approaches[profile.trading_approach] || profile.trading_approach}
- Risk Tolerance: ${riskLevels[profile.risk_tolerance] || profile.risk_tolerance}
- Typical Trade Duration: ${profile.typical_trade_duration}`;

  if (profile.preferred_markets && profile.preferred_markets.length > 0) {
    summary += `\n- Preferred Markets: ${profile.preferred_markets.join(', ')}`;
  }

  if (profile.preferred_sessions && profile.preferred_sessions.length > 0) {
    summary += `\n- Preferred Sessions: ${profile.preferred_sessions.join(', ')}`;
  }

  if (profile.focus_areas && profile.focus_areas.length > 0) {
    summary += `\n- Focus Areas: ${profile.focus_areas.join(', ')}`;
  }

  if (profile.trading_goals) {
    summary += `\n- Goals: ${profile.trading_goals}`;
  }

  summary += `\n\nIMPORTANT: Use this profile to personalize your responses. Tailor your advice, examples, and insights to match their experience level, trading style, and goals. Be specific to their preferred markets and sessions when relevant.`;

  return summary;
}

function formatMemoriesForAI(memories: { content: string }[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  const list = memories.map((m) => `- ${m.content}`).join('\n');
  return `\n\nThings you remember about this user from past conversations:\n${list}\n\nUse these naturally when relevant - don't just recite them back.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    const { messages, images, client_context }: RequestPayload = await req.json();
    const clientLocalDate = client_context?.local_date;
    const selectedAccountId = client_context?.selected_account_id ?? null;
    const viewingAllAccounts = client_context?.viewing_all_accounts ?? false;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required and must not be empty' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Rate limiting below caps request frequency, not size - a single
    // oversized request could still run up real Anthropic API cost or
    // blow past Claude's context window. Generous limits that only
    // reject genuinely abusive payloads, not real usage.
    const MAX_MESSAGES = 200;
    const MAX_MESSAGE_CHARS = 20000;
    const MAX_TOTAL_CHARS = 150000;
    const MAX_IMAGES = 5;

    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: 'Too many messages in this conversation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalChars = 0;
    for (const m of messages) {
      const len = typeof m?.content === 'string' ? m.content.length : 0;
      if (len > MAX_MESSAGE_CHARS) {
        return new Response(
          JSON.stringify({ error: 'Message is too long' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      totalChars += len;
    }
    if (totalChars > MAX_TOTAL_CHARS) {
      return new Response(
        JSON.stringify({ error: 'Conversation is too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (images && (!Array.isArray(images) || images.length > MAX_IMAGES)) {
      return new Response(
        JSON.stringify({ error: 'Too many images attached' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
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

    // Identity is derived from the verified JWT, never trusted from the
    // request body - this is also what the rate limit below is keyed on,
    // so it has to be the real authenticated user, not a client-supplied ID.
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    const userId = authUser.id;

    const { data: usageCheck, error: usageError } = await supabaseClient
      .rpc('check_and_increment_nova_usage', {
        p_user_id: userId,
        p_per_minute_limit: PER_MINUTE_LIMIT,
        p_daily_limit: DAILY_LIMIT,
      })
      .single();

    if (usageError) {
      console.error('Rate limit check failed:', usageError);
    } else if (usageCheck && !(usageCheck as any).allowed) {
      const limitMessage = (usageCheck as any).reason === 'daily_limit'
        ? "You've hit today's message limit with Nova. It resets at midnight - talk soon!"
        : "Whoa, slow down a little there! Give it a few seconds and try again.";
      return new Response(
        JSON.stringify({ error: limitMessage }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const conversationHistory = messages.slice(-15);

    const correctedHistory = conversationHistory.map(msg => {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        return {
          ...msg,
          content: correctTradingTerms(msg.content)
        };
      }
      return msg;
    });

    // If images are provided, add vision capability to the last user message
    if (images && images.length > 0) {
      const lastUserMsgIndex = correctedHistory.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
      if (lastUserMsgIndex !== undefined) {
        const lastMsg = correctedHistory[lastUserMsgIndex];
        const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';

        const contentArray: Anthropic.MessageParam['content'] = [
          { type: 'text', text: textContent + '\n\nIMPORTANT: Analyze the uploaded trade screenshot(s) and extract ALL visible trading information. Look carefully for:\n\n1. TRADE DETAILS: Symbol/pair, direction (long/short), entry price, stop loss, take profit\n2. RISK METRICS: Position size, risk amount, risk-to-reward ratio (calculate if SL and TP are visible)\n3. TIMING: Entry time (look for timestamps on the chart), exit time if visible, trade duration\n4. CHART INFO: Timeframe (1m, 5m, 15m, 1H, 4H, 1D, etc.), indicators present\n5. PRICE LEVELS: Support/resistance levels, key price zones\n6. TRADE OUTCOME: If this is an "after" screenshot, look for final P&L, win/loss result\n\nAfter analyzing, you MUST automatically log this trade to the journal using the log_journal_entry tool with ALL extracted data. Fill in every field you can identify from the screenshots. Be thorough and precise.' }
        ] as Anthropic.MessageParam['content'];

        // Add all images
        for (const imageUrl of images) {
          (contentArray as any[]).push({
            type: 'image',
            source: { type: 'url', url: imageUrl }
          });
        }

        correctedHistory[lastUserMsgIndex] = {
          ...lastMsg,
          content: contentArray
        } as any;
      }
    }

    let userProfile: UserProfile | null = null;
    try {
      const { data: profileData } = await supabaseClient
        .from('user_trading_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      userProfile = profileData;
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }

    let userMemories: { content: string }[] = [];
    try {
      const { data: memoriesData } = await supabaseClient
        .from('nova_user_memories')
        .select('content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      userMemories = memoriesData ?? [];
    } catch (error) {
      console.error('Error fetching user memories:', error);
    }

    const profileContext = formatProfileForAI(userProfile);
    const memoryContext = formatMemoriesForAI(userMemories);
    // The server's own clock is not the user's - without this, "today" or
    // an omitted entry_date silently defaults to server/UTC time, which
    // is already tomorrow for anyone behind UTC once it's evening locally.
    const dateContext = clientLocalDate
      ? `\n\nToday's date, in the user's own local timezone, is ${clientLocalDate}. Always use this (not your own sense of the current date) for "today", "yesterday", "this week", or any other relative date the user mentions, and as the entry_date default for log_journal_entry when they don't specify one.`
      : '';

    /*
      Which account the user is looking at while they type.

      Nova used to analyse every account regardless, while the NOVA Score
      panel next to the chat was scoped to the selected one - so the panel
      could read "6 trades" beside Nova saying 26. Both were right and
      neither said which was which, which just makes both look wrong.

      The name is looked up here rather than accepted from the request, so
      the label Nova reads out is the account's real name. RLS applies, so
      an id belonging to someone else simply returns nothing.
    */
    let accountContext = '';
    if (viewingAllAccounts) {
      accountContext = `\n\nThe user is currently viewing All Accounts. Analyse across every account unless they name a specific one, and say that your figures cover all accounts.`;
    } else if (selectedAccountId) {
      const { data: account } = await supabaseClient
        .from('broker_connections')
        .select('account_name')
        .eq('id', selectedAccountId)
        .maybeSingle();

      if (account) {
        accountContext = `\n\nThe user is currently viewing the account "${account.account_name}" (id ${selectedAccountId}). Pass this id as account_id when you call analyze_trading_performance, so your numbers match the ones on screen, and name the account when you report them. If they ask about a different account or about all of them, use that instead - and if it is genuinely ambiguous which account they mean, ask before answering.`;
      }
    }

    const enhancedSystemPrompt = SYSTEM_PROMPT + profileContext + memoryContext + dateContext + accountContext;

    // Cache the system prompt (~4,400 tokens) and tool definitions (tools
    // render before system, so one breakpoint here covers both). This
    // prompt is sent on every single call - without caching, every message
    // in a conversation pays full price for it again. A cache breakpoint
    // on the last system block makes repeat calls within ~5 minutes read
    // it at roughly 10% of the cost instead.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: 'text', text: enhancedSystemPrompt, cache_control: { type: 'ephemeral' } },
    ];

    const claudeMessages: Anthropic.MessageParam[] = correctedHistory.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content as any,
    }));

    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      output_config: { effort: 'medium' },
      system: systemBlocks,
      messages: claudeMessages,
      tools: TOOLS,
    });

    let textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const toolUseBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (toolUseBlock) {
      if (toolUseBlock.name === 'log_journal_entry') {
        console.log('Tool call detected:', toolUseBlock.name);

        try {
          const functionArgs = toolUseBlock.input as any;
          console.log('Function arguments:', functionArgs);

          // Belt-and-suspenders: the prompt already tells Claude what
          // today is, but if it omits entry_date anyway, fall back to the
          // client's real local date rather than letting log-journal-entry
          // compute its own (server/UTC) "today".
          if (!functionArgs.entry_date && clientLocalDate) {
            functionArgs.entry_date = clientLocalDate;
          }

          const journalResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/log-journal-entry`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader ?? '',
                'Content-Type': 'application/json',
                'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              },
              body: JSON.stringify({ ...functionArgs, user_id: userId }),
            }
          );

          const journalResult = await journalResponse.json();
          console.log('Journal result:', journalResult);

          claudeMessages.push({ role: 'assistant', content: response.content });
          claudeMessages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify(journalResult) }],
          });

          // Same system + tools as the first call, so this hits the cache
          // written above instead of paying full price again.
          const secondResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 200,
            output_config: { effort: 'medium' },
            system: systemBlocks,
            messages: claudeMessages,
            tools: TOOLS,
          });

          const secondText = secondResponse.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
          if (secondText?.text) {
            textBlock = secondText;
          }

          if (!textBlock?.text && journalResult.success) {
            textBlock = {
              type: 'text',
              text: functionArgs.category === 'psychology'
                ? 'Logged to your psychology journal!'
                : 'Trade logged!'
            } as Anthropic.TextBlock;
          }
        } catch (toolError) {
          console.error('Error in tool processing:', toolError);
        }
      } else if (toolUseBlock.name === 'analyze_trading_performance') {
        console.log('Analysis tool call detected:', toolUseBlock.name);

        try {
          const functionArgs = toolUseBlock.input as any;
          console.log('Analysis arguments:', functionArgs);

          const analysisResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-trading-performance`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader ?? '',
                'Content-Type': 'application/json',
                'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              },
              body: JSON.stringify({
                user_id: userId,
                days_back: functionArgs.days_back || 90,
                account_id: functionArgs.account_id
              }),
            }
          );

          const analysisResult = await analysisResponse.json();
          console.log('Analysis result summary:', {
            total_trades: analysisResult.summary?.total_trades,
            win_rate: analysisResult.summary?.win_rate,
          });

          claudeMessages.push({ role: 'assistant', content: response.content });
          claudeMessages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify(analysisResult) }],
          });

          const secondResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 2000,
            output_config: { effort: 'medium' },
            system: systemBlocks,
            messages: claudeMessages,
            tools: TOOLS,
          });

          const secondText = secondResponse.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
          if (secondText?.text) {
            textBlock = secondText;
          }

          if (!textBlock?.text) {
            textBlock = {
              type: 'text',
              text: 'I\'ve analyzed your trading data. Let me share what I found...'
            } as Anthropic.TextBlock;
          }
        } catch (toolError) {
          console.error('Error in analysis tool processing:', toolError);
          textBlock = {
            type: 'text',
            text: 'I had trouble analyzing your trading data. This might be because you haven\'t logged enough trades yet. Try asking me again once you have a few more entries!'
          } as Anthropic.TextBlock;
        }
      } else if (toolUseBlock.name === 'remember_about_user') {
        console.log('Memory tool call detected:', toolUseBlock.name);

        try {
          const functionArgs = toolUseBlock.input as { content: string };

          const { error: memoryError } = await supabaseClient
            .from('nova_user_memories')
            .insert({ user_id: userId, content: functionArgs.content });

          if (memoryError) {
            console.error('Error saving memory:', memoryError);
          }

          claudeMessages.push({ role: 'assistant', content: response.content });
          claudeMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify({ success: !memoryError }),
            }],
          });

          const secondResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 300,
            output_config: { effort: 'medium' },
            system: systemBlocks,
            messages: claudeMessages,
            tools: TOOLS,
          });

          const secondText = secondResponse.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
          if (secondText?.text) {
            textBlock = secondText;
          }
        } catch (toolError) {
          console.error('Error in memory tool processing:', toolError);
        }
      } else if (toolUseBlock.name === 'move_journal_entry') {
        console.log('Move entry tool call detected:', toolUseBlock.name);

        try {
          const functionArgs = toolUseBlock.input as any;
          console.log('Move arguments:', functionArgs);

          const moveResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/move-journal-entry`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader ?? '',
                'Content-Type': 'application/json',
                'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              },
              body: JSON.stringify(functionArgs),
            }
          );

          const moveResult = await moveResponse.json();
          console.log('Move result:', moveResult);

          claudeMessages.push({ role: 'assistant', content: response.content });
          claudeMessages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify(moveResult) }],
          });

          const secondResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 200,
            output_config: { effort: 'medium' },
            system: systemBlocks,
            messages: claudeMessages,
            tools: TOOLS,
          });

          const secondText = secondResponse.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
          if (secondText?.text) {
            textBlock = secondText;
          }

          if (!textBlock?.text) {
            textBlock = {
              type: 'text',
              text: moveResult.success ? moveResult.message : `I couldn't move that entry: ${moveResult.error || 'unknown error'}`
            } as Anthropic.TextBlock;
          }
        } catch (toolError) {
          console.error('Error in move entry tool processing:', toolError);
          textBlock = {
            type: 'text',
            text: "I ran into an error trying to move that entry. Try again in a moment, or move it manually from the Journal page."
          } as Anthropic.TextBlock;
        }
      }
    }

    let text = textBlock?.text;

    if (!text || text.trim() === '') {
      console.error('Empty message content received from Claude');
      text = "I'm having a bit of trouble right now, but I'm here! Could you try asking me again or rephrase what you'd like help with?";
    }

    const responseData: any = { text };

    if (toolUseBlock) {
      responseData.tool_calls = [{
        name: toolUseBlock.name,
        arguments: JSON.stringify(toolUseBlock.input)
      }];
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in nova-chat function:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process your request. Please try again.',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
