/**
 * FinanceAgent — The single orchestration layer for all AI-powered financial features.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                       HTTP Request                              │
 * │                           ↓                                     │
 * │                    aiController.js          (thin HTTP adapter) │
 * │                           ↓                                     │
 * │ ┌─────────────────── FinanceAgent ───────────────────────────┐  │
 * │ │                                                            │  │
 * │ │  ┌──────────────────────────────────────────────────────┐  │  │
 * │ │  │ Public API (7 methods)                               │  │  │
 * │ │  │  healthScore()          analyzeSpendingPatterns()    │  │  │
 * │ │  │  generateBudgetAdvice() predictExpenses()            │  │  │
 * │ │  │  financialChat()        processVoiceCommand()        │  │  │
 * │ │  │  generateMonthlyReport()                             │  │  │
 * │ │  └──────────────────────────────────────────────────────┘  │  │
 * │ │                                                            │  │
 * │ │  ┌────────────────────┐  ┌──────────────────────────────┐  │  │
 * │ │  │  TTL Cache (Map)   │  │  Gemini Client (single inst) │  │  │
 * │ │  │  _cache            │  │  _model.generateContent()    │  │  │
 * │ │  │  _getCached()      │  │  _model.startChat()          │  │  │
 * │ │  │  _setCache()       │  │  ↑ ALL calls route here      │  │  │
 * │ │  │  invalidateUser()  │  │    via _callGemini()         │  │  │
 * │ │  └────────────────────┘  └──────────────────────────────┘  │  │
 * │ │                                                            │  │
 * │ └─────────────────────────┬──────────────────────────────────┘  │
 * │                           │ _loadData()                         │
 * │                           ↓                                     │
 * │                  financeDataService.js      (pure MongoDB layer) │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Design Rules:
 *  1. No other file may import @google/generative-ai or call Gemini directly.
 *  2. No other file may fetch financial data for AI; that flows through _loadData().
 *  3. The controller never constructs prompts or parses AI responses.
 *  4. All caching lives here — callers are cache-unaware.
 */

'use strict';

const OpenAI = require('openai');
const financeDataService = require('../services/financeDataService');
const healthScoreService = require('../services/healthScoreService');
const moment = require('moment');

// ─── Cache TTLs (milliseconds) ────────────────────────────────────────────────
// Analysis features are cached because their inputs (DB aggregates) change only
// when the user adds new transactions — which is infrequent relative to how often
// they might visit the Insights page.
const TTL = {
    /** Short-lived DB data cache: prevents duplicate DB roundtrips when multiple
     *  features are called within a single page-load burst. */
    DATA: 2 * 60 * 1000,               // 2 min

    /** Financial health score — recalculate at most every 30 min. */
    HEALTH_SCORE: 30 * 60 * 1000,      // 30 min

    /** Budget advice — monthly spending patterns don't shift minute-to-minute. */
    BUDGET_ADVICE: 30 * 60 * 1000,     // 30 min

    /** Spending pattern analysis uses 6-month aggregates; very stable. */
    SPENDING_ANALYSIS: 60 * 60 * 1000, // 1 hr

    /** Expense prediction uses 3-month history; re-run hourly is sufficient. */
    EXPENSE_PREDICTION: 60 * 60 * 1000, // 1 hr

    /** Historical monthly reports are immutable once the month is over. */
    MONTHLY_REPORT: 2 * 60 * 60 * 1000, // 2 hr
};

// ─── FinanceAgent ──────────────────────────────────────────────────────────────

class FinanceAgent {
    constructor() {
        // ── Gemini Setup ────────────────────────────────────────────────────────
        if (!process.env.XAI_API_KEY) {
            console.warn(
                '[FinanceAgent] XAI_API_KEY is not set. ' +
                'All AI features will throw at runtime. ' +
                'Add it to backend/.env and restart.'
            );
        }

        this._client = new OpenAI({
            apiKey:  process.env.XAI_API_KEY || '',
            baseURL: 'https://api.x.ai/v1',
        });
        this._model = 'grok-3-fast';

        // ── In-Memory Response Cache ─────────────────────────────────────────────
        /**
         * Map<cacheKey, { data: any, expiresAt: number }>
         *
         * Key conventions:
         *   "healthScore:{userId}"
         *   "budgetAdvice:{userId}"
         *   "spendingAnalysis:{userId}"
         *   "expensePrediction:{userId}"
         *   "monthlyReport:{userId}:{year}:{month}"
         *   "data:{userId}"                          ← DB result cache
         *
         * For multi-process / multi-instance deployments, replace this Map with a
         * Redis client (e.g. ioredis) using the same key conventions.
         */
        this._cache = new Map();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Cache Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Returns cached data for `key`, or null if missing / expired.
     * Expired entries are eagerly deleted to prevent stale reads.
     */
    _getCached(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }

    /**
     * Stores `data` under `key` with a TTL-derived absolute expiry timestamp.
     * @param {string} key
     * @param {*}      data
     * @param {number} ttlMs — time-to-live in milliseconds
     */
    _setCache(key, data, ttlMs) {
        this._cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    }

    /**
     * Removes all cached entries belonging to a specific user.
     * Call this after the user successfully adds income, expenses, or a budget
     * so the next feature request fetches fresh data.
     *
     * @param {string} userId
     */
    invalidateUser(userId) {
        const suffix = `:${userId}`;
        for (const key of this._cache.keys()) {
            if (key.includes(suffix)) {
                this._cache.delete(key);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Gemini Chokepoint
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * THE ONLY METHOD THAT CALLS GEMINI.
     * Every AI operation in this class routes through here, making it trivial to:
     *   - Add request logging / rate-limit guards in one place.
     *   - Swap the underlying model globally.
     *   - Inject a mock in tests.
     *
     * @param   {string} prompt — fully assembled prompt string
     * @returns {Promise<string>} raw text response from Gemini
     * @throws  on Gemini API error (network, quota, invalid key, etc.)
     */
    async _callGemini(prompt) {
        const completion = await this._client.chat.completions.create({
            model:    this._model,
            messages: [{ role: 'user', content: prompt }],
        });
        return completion.choices[0].message.content.trim();
    }

    /**
     * Calls Gemini and parses the response as JSON.
     *
     * Gemini sometimes wraps JSON in markdown fences (```json...```) even when
     * instructed not to. The cleaning step strips those before parsing.
     *
     * @param   {string} prompt — prompt that instructs Gemini to return JSON
     * @returns {Promise<Object>} parsed JSON object
     * @throws  {SyntaxError} if the response cannot be parsed as JSON (after cleaning)
     */
    async _callGeminiJSON(prompt) {
        // Append a hard instruction to ensure raw JSON output. Placed at the end
        // so it is closest to the generation start and less likely to be ignored.
        const fullPrompt =
            prompt +
            '\n\n===\nCRITICAL: Your ENTIRE response must be valid JSON. ' +
            'No markdown fences, no prose, no explanation — raw JSON only.';

        const raw = await this._callGemini(fullPrompt);

        // Strip ```json ... ``` or ``` ... ``` if present
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            throw new Error(
                `[FinanceAgent] Gemini returned non-JSON.\n` +
                `First 300 chars: ${cleaned.slice(0, 300)}`
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Data Loader
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Loads aggregated financial data for `userId` via financeDataService.
     *
     * Results are cached for TTL.DATA (2 min) so that multiple feature calls
     * triggered by a single page-load (e.g., AIInsights fetching all four tabs)
     * share one DB roundtrip instead of four.
     *
     * @param   {string} userId
     * @returns {Promise<Object>} aggregated financial snapshot
     */
    async _loadData(userId) {
        const key = `data:${userId}`;
        const cached = this._getCached(key);
        if (cached) return cached;

        const data = await financeDataService.getUserFinancialData(userId);
        this._setCache(key, data, TTL.DATA);
        return data;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 1: Financial Health Score
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Scores the user's overall financial health on a 0–100 scale across four
     * equally weighted dimensions (25 pts each):
     *
     *   • savingsHealth    — savings rate relative to total income
     *   • budgetAdherence  — how well the user stays within their set budget
     *   • incomeStability  — diversity and count of income sources
     *   • expenseControl   — expense-to-income ratio and category concentration
     *
     * Response is cached for TTL.HEALTH_SCORE. Invalidated by invalidateUser().
     *
     * @param   {string} userId
     * @returns {Promise<{score, grade, summary, breakdown, strengths, improvements, tips}>}
     */
    async healthScore(userId) {
        const cacheKey = `healthScore:${userId}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        const d = await this._loadData(userId);

        // Deterministic base — always computed algorithmically so the score number
        // is identical whether fetched from the widget (/finance/health-score)
        // or from this AI endpoint (/ai/health-score). AI only adds the narrative.
        const base = healthScoreService.calculateScoreFromData(d);

        const prompt = `
You are a certified financial analyst. A user's financial health has been scored algorithmically.
Your task is to write a personalised narrative summary and enhanced tips — do NOT change the score.

Algorithmic Score: ${base.score}/100  (Grade: ${base.grade})
Strengths identified: ${base.strengths.join('; ')}
Weaknesses identified: ${base.weaknesses.join('; ')}
Existing recommendations: ${base.recommendations.join('; ')}

User's Financial Snapshot:
- Monthly Income:      ₹${d.monthlyIncome}
- Monthly Expenses:    ₹${d.monthlyExpense}
- Savings Rate:        ${d.savingsRate}%
- Budget Utilisation:  ${d.budgetUtilization}%
- Top Categories:      ${d.categoryBreakdown.slice(0, 5).map(c => c.category).join(', ')}

Return this exact JSON schema (keep score and grade exactly as given above):
{
  "score":   ${base.score},
  "grade":   "${base.grade}",
  "summary": "<3-sentence engaging narrative that references the user's specific numbers and overall financial situation>",
  "breakdown": ${JSON.stringify(base.breakdown)},
  "strengths":    ${JSON.stringify(base.strengths)},
  "weaknesses":   ${JSON.stringify(base.weaknesses)},
  "tips":         ["<highly specific, actionable tip 1>", "<tip 2>", "<tip 3>", "<tip 4>", "<tip 5>"]
}`;

        const aiResult = await this._callGeminiJSON(prompt);
        // Guarantee score/grade can never be overridden by AI hallucination
        const result = { ...aiResult, score: base.score, grade: base.grade, breakdown: base.breakdown };
        this._setCache(cacheKey, result, TTL.HEALTH_SCORE);
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 2: AI Budget Recommendation (generateBudgetAdvice)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Recommends an optimal monthly budget allocation by category.
     *
     * Uses the 50/30/20 rule (50% needs, 30% wants, 20% savings) as a baseline,
     * then calibrates the distribution to the user's actual spending categories
     * and income level.
     *
     * Response is cached for TTL.BUDGET_ADVICE. Invalidated by invalidateUser().
     *
     * @param   {string} userId
     * @returns {Promise<{totalRecommendedBudget, methodology, categories[], savingsTarget, insights[]}>}
     */
    async generateBudgetAdvice(userId) {
        const cacheKey = `budgetAdvice:${userId}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        const d = await this._loadData(userId);

        const prompt = `
You are a personal finance advisor applying the 50/30/20 budgeting rule.

User's Spending Profile:
- Monthly Income (last 30 days):          ₹${d.monthlyIncome}
- Monthly Expenses (last 30 days):        ₹${d.monthlyExpense}
- Average Monthly Expenses (3-month avg): ₹${d.avgMonthlyExpense}
- Current Budget Limit:                   ₹${d.currentBudget}
- Category-wise Spend (last 30 days):     ${JSON.stringify(d.categoryBreakdown)}

Guidelines:
- 50% of income → essential needs (rent, food, utilities, transport)
- 30% → discretionary wants
- 20% → savings + emergency fund
- Adjust percentages to fit the user's actual categories.
- All amounts must be in Indian Rupees (₹).

Return this exact JSON schema:
{
  "totalRecommendedBudget": <number — total spending budget, excluding savings>,
  "methodology": "<1-sentence explanation of the allocation approach>",
  "categories": [
    {
      "name": "<category name>",
      "recommended": <number — ₹ per month>,
      "currentSpend": <number — what they actually spent>,
      "percentage": <number 0–100 — % of recommended budget>,
      "priority": <"essential" | "important" | "optional">,
      "tip": "<specific, practical saving tip for this category>"
    }
  ],
  "savingsTarget": <number — ₹ per month>,
  "savingsPercentage": <number — % of income>,
  "emergencyFundMonths": <number — target months of expenses in emergency fund>,
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]
}`;

        const result = await this._callGeminiJSON(prompt);
        this._setCache(cacheKey, result, TTL.BUDGET_ADVICE);
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 3: Spending Pattern Analysis
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Detects trends, anomalies, and recurring patterns across 6 months of spending.
     *
     * Returns a Recharts-compatible `monthlyData` array for the bar chart and a
     * narrative `analysis` string for the text summary.
     *
     * Response is cached for TTL.SPENDING_ANALYSIS. Invalidated by invalidateUser().
     *
     * @param   {string} userId
     * @returns {Promise<{overallTrend, trendPercentage, analysis, patterns[], anomalies[], monthlyData[], recommendations[]}>}
     */
    async analyzeSpendingPatterns(userId) {
        const cacheKey = `spendingAnalysis:${userId}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        const d = await this._loadData(userId);

        const prompt = `
You are a financial data analyst. Identify meaningful spending patterns and anomalies.

Monthly Expense History (last 6 months): ${JSON.stringify(d.monthlyTrends)}
Category Breakdown (last 30 days):       ${JSON.stringify(d.categoryBreakdown)}
Top 3 Spending Categories:               ${JSON.stringify(d.topCategories)}
Month-over-Month Change:                 ${d.momChange > 0 ? '+' : ''}${d.momChange}%

Return this exact JSON schema:
{
  "overallTrend":     <"increasing" | "decreasing" | "stable">,
  "trendPercentage":  <absolute % change as a positive number>,
  "analysis":         "<3-sentence narrative identifying key patterns and what drives them>",
  "patterns": [
    {
      "title":       "<short pattern name>",
      "description": "<what is happening and why it matters>",
      "impact":      <"positive" | "negative" | "neutral">,
      "category":    "<expense category name, or null if cross-category>"
    }
  ],
  "anomalies": [
    {
      "month":       "<MMM YYYY>",
      "category":    "<category name>",
      "description": "<why this month/category is unusual>",
      "suggestion":  "<concrete corrective action>"
    }
  ],
  "monthlyData": [
    { "month": "<MMM YYYY>", "amount": <number>, "changeFromPrev": <number — signed % change> }
  ],
  "recommendations": ["<prioritised recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}`;

        const result = await this._callGeminiJSON(prompt);
        this._setCache(cacheKey, result, TTL.SPENDING_ANALYSIS);
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 4: Expense Prediction
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Forecasts next month's total and per-category expenses using a weighted
     * trend model applied to the last 3 months of actual data.
     *
     * The `comparedToLastMonth` field uses the convention:
     *   positive → spending will INCREASE (bad)
     *   negative → spending will DECREASE (good)
     *
     * Response is cached for TTL.EXPENSE_PREDICTION. Invalidated by invalidateUser().
     *
     * @param   {string} userId
     * @returns {Promise<{predictedTotal, confidence, categoryPredictions[], riskFactors[], savingOpportunities[], budgetSuggestion}>}
     */
    async predictExpenses(userId) {
        const cacheKey = `expensePrediction:${userId}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        const d = await this._loadData(userId);

        const prompt = `
You are a financial forecasting expert. Predict next month's expenses.

Historical Monthly Expenses (last 3 months): ${JSON.stringify(d.historicalMonthly)}
Per-Category Historical Spending:            ${JSON.stringify(d.categoryHistory)}
3-Month Average Monthly Expense:             ₹${d.avgMonthlyExpense}
Last Month's Total Expense:                  ₹${d.lastMonthExpense}
Current Monthly Income:                      ₹${d.monthlyIncome}

Apply weighted trend analysis: give more weight to recent months.
Positive comparedToLastMonth means spending is predicted to increase.

Return this exact JSON schema:
{
  "predictedTotal":      <number — total ₹ predicted for next month>,
  "confidence":          <"high" | "medium" | "low">,
  "confidenceScore":     <integer 0–100>,
  "comparedToLastMonth": <signed number — positive = more spending, negative = less>,
  "comparedToAverage":   <signed number — vs 3-month avg>,
  "summary":             "<2-sentence plain-language prediction with specific amounts>",
  "categoryPredictions": [
    {
      "category":    "<category name>",
      "predicted":   <number>,
      "lastMonth":   <number>,
      "trend":       <"up" | "down" | "stable">,
      "changePercent": <signed number>
    }
  ],
  "riskFactors":         ["<spending risk 1>", "<spending risk 2>"],
  "savingOpportunities": ["<saving tip 1>", "<saving tip 2>"],
  "budgetSuggestion":    <number — recommended budget ceiling for next month>
}`;

        const result = await this._callGeminiJSON(prompt);
        this._setCache(cacheKey, result, TTL.EXPENSE_PREDICTION);
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 5: Financial Advisor Chat
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Multi-turn financial advisor chatbot backed by Gemini's native chat API.
     *
     * Each call reconstructs the Gemini chat session from the client-provided
     * history. This stateless approach is chosen because:
     *   - It is reliable across page reloads (server restarts don't lose context).
     *   - The client (Chatbot.jsx) already maintains the full message list.
     *   - It avoids in-memory session state that is hard to scale horizontally.
     *
     * The trade-off is re-sending history tokens on every call. For a production
     * system with long conversations, consider a sliding-window approach: keep only
     * the last N exchanges to cap token cost.
     *
     * Chat responses are NOT cached — they are inherently real-time and unique.
     *
     * @param   {string} userId
     * @param   {string} message        — the user's current question
     * @param   {Array}  history        — [{role: 'user'|'model', content: string}]
     * @returns {Promise<{reply: string, timestamp: string}>}
     */
    async financialChat(userId, message, history = [], systemContext = null) {
        // Use pre-built context from chatController when available (richer, includes
        // health score + predictions). Fall back to a basic snapshot from _loadData().
        let systemPrompt;
        if (systemContext) {
            systemPrompt = systemContext;
        } else {
            const d = await this._loadData(userId);
            systemPrompt = `
You are FinGuide AI, a knowledgeable personal financial advisor.

User's Live Financial Snapshot:
  Net Balance:       ₹${d.totalIncome - d.totalExpense}
  Monthly Income:    ₹${d.monthlyIncome}
  Monthly Expenses:  ₹${d.monthlyExpense}
  Savings Rate:      ${d.savingsRate}%
  Top Categories:    ${d.topCategories.join(', ')}
  Budget Remaining:  ₹${d.budgetLeft} of ₹${d.totalBudget}

Advisor Rules:
  - Always reference the user's actual numbers when relevant.
  - Be concise: 2–4 paragraphs maximum per response.
  - Use ₹ for all currency amounts.
  - For investment or stock advice, recommend a SEBI-registered financial advisor.
  - Be encouraging but honest about overspending.`.trim();
        }

        // Build OpenAI-format message array: system prompt → prior turns → current message
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({
                role:    msg.role === 'model' ? 'assistant' : msg.role,
                content: msg.content,
            })),
            { role: 'user', content: message },
        ];

        let reply;
        try {
            const completion = await this._client.chat.completions.create({
                model:    this._model,
                messages,
            });
            reply = completion.choices[0].message.content.trim();
        } catch (aiErr) {
            console.error(`[FinanceAgent:chat] xAI failed for user ${userId}: ${aiErr.message}`);
            return {
                reply:     "I'm having trouble connecting to the AI service right now. Please try again in a moment.",
                timestamp: new Date().toISOString(),
            };
        }
        return { reply, timestamp: new Date().toISOString() };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 6: Voice Command Processing
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Converts a raw voice transcript into a structured intent response.
     *
     * The frontend (Chatbot.jsx) uses the Web Speech API to capture the transcript,
     * then sends it here. This method:
     *   1. Classifies the intent (balance query, navigate, advice, etc.)
     *   2. Generates a natural spoken response using the user's live data.
     *   3. Returns an optional navigation action so the UI can route the user.
     *
     * Voice responses are NOT cached — they are real-time by nature.
     *
     * Intent taxonomy:
     *   balance_query | expense_query | income_query | budget_query |
     *   advice | navigate | general
     *
     * @param   {string} userId
     * @param   {string} transcript — raw output from Web Speech API
     * @returns {Promise<{intent, response, data: {amount, category, timeframe}, action: {type, route}}>}
     */
    async processVoiceCommand(userId, transcript) {
        const d = await this._loadData(userId);

        const prompt = `
You are FinGuide Voice Assistant. Parse this spoken command into a structured response.

Spoken Command: "${transcript}"

User's Financial Snapshot:
  Balance:           ₹${d.totalIncome - d.totalExpense}
  Monthly Income:    ₹${d.monthlyIncome}
  Monthly Expenses:  ₹${d.monthlyExpense}
  Budget Remaining:  ₹${d.budgetLeft} of ₹${d.totalBudget}
  Top Categories:    ${d.topCategories.join(', ')}

Intent taxonomy: balance_query | expense_query | income_query | budget_query | advice | navigate | general

"response" must sound natural when spoken aloud — conversational, max 2 sentences, use ₹ for amounts.
"route" for navigate intent must be one of: /dashboard /income /expense /budget /ai-insights /chatbot /report

Return this exact JSON schema:
{
  "intent": "<intent from taxonomy>",
  "response": "<natural spoken reply referencing actual numbers>",
  "data": {
    "amount":    <number | null>,
    "category":  "<category name | null>",
    "timeframe": <"today" | "week" | "month" | null>
  },
  "action": {
    "type":  <"navigate" | "none">,
    "route": <"/<page>" | null>
  }
}`;

        // Voice is real-time — no caching. Always call Gemini.
        return this._callGeminiJSON(prompt);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature 7: Monthly Financial Report
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Generates a comprehensive month-in-review report for the given year/month.
     *
     * Unlike the other features, this method fetches month-scoped data directly
     * from financeDataService.getMonthlyReportData() rather than through _loadData(),
     * because it needs a different aggregation window (a specific calendar month,
     * not the rolling 30-day window used elsewhere).
     *
     * Once generated, historical reports are cached aggressively (TTL.MONTHLY_REPORT)
     * because past months' data is immutable.
     *
     * The returned object merges the AI report with `rawData` so the frontend can
     * display numeric summaries without re-parsing the AI prose.
     *
     * @param   {string} userId
     * @param   {number} year   — e.g. 2024
     * @param   {number} month  — 1–12
     * @returns {Promise<Object>} AI report object merged with rawData
     * @throws  {Error} 'No transactions found for this period.' when month is empty
     */
    async generateMonthlyReport(userId, year, month) {
        const cacheKey = `monthlyReport:${userId}:${year}:${month}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        // Directly use the month-scoped data fetcher — bypasses _loadData() intentionally.
        const d = await financeDataService.getMonthlyReportData(userId, year, month);

        if (d.transactionCount === 0) {
            throw new Error('No transactions found for this period.');
        }

        const prompt = `
You are a senior financial analyst writing a formal monthly financial report.

Report Period: ${d.reportMonth}

Key Metrics:
  Total Income:         ₹${d.totalIncome}
  Total Expenses:       ₹${d.totalExpense}
  Net Savings:          ₹${d.netSavings} (${d.savingsRate}% savings rate)
  Budget Limit:         ₹${d.totalBudget}
  Budget Used:          ₹${d.budgetUsed}
  Budget Remaining:     ₹${d.budgetLeft}
  Total Transactions:   ${d.transactionCount}
  Daily Average Spend:  ₹${d.dailyAvgSpend}
  vs. Previous Month:   Income ${d.incomeChange > 0 ? '+' : ''}${d.incomeChange}%,
                        Expenses ${d.expenseChange > 0 ? '+' : ''}${d.expenseChange}%

Category Breakdown:     ${JSON.stringify(d.categoryBreakdown)}
Income Sources:         ${JSON.stringify(d.incomeSources)}

Return this exact JSON schema:
{
  "reportTitle":      "Financial Report — ${d.reportMonth}",
  "generatedAt":      "<ISO 8601 timestamp>",
  "executiveSummary": "<4–5 sentence professional summary covering income, spending, savings, and budget adherence>",
  "performanceScore": <integer 0–100>,
  "performanceGrade": <"Excellent" | "Good" | "Average" | "Below Average" | "Poor">,
  "highlights": [
    { "type": <"achievement" | "concern" | "insight">, "title": "<short title>", "description": "<1-sentence detail>" }
  ],
  "incomeAnalysis": {
    "summary": "<2-sentence income analysis>",
    "sources": [{ "name": "<source>", "amount": <number>, "percentage": <number> }]
  },
  "expenseAnalysis": {
    "summary": "<2-sentence expense analysis>",
    "topCategories": [
      { "category": "<name>", "amount": <number>, "percentage": <number>, "vs_budget": "<over budget | under budget | on track>" }
    ]
  },
  "budgetPerformance": {
    "summary": "<2-sentence budget adherence analysis>",
    "utilized": <integer 0–100>,
    "status":   <"under_budget" | "on_track" | "over_budget">
  },
  "goalsAndRecommendations": {
    "nextMonthGoals":  ["<goal 1>", "<goal 2>", "<goal 3>"],
    "actionItems":     ["<specific action 1>", "<specific action 2>", "<specific action 3>"],
    "longTermAdvice":  "<2-sentence long-term wealth-building advice>"
  },
  "motivationalMessage": "<personalised, encouraging closing message>"
}`;

        const aiReport = await this._callGeminiJSON(prompt);
        // Merge AI prose with raw numbers so the frontend can display both
        const result = { ...aiReport, rawData: d };

        this._setCache(cacheKey, result, TTL.MONTHLY_REPORT);
        return result;
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────
// Export a single instance so the in-memory cache and any future session state
// persist across HTTP requests within the same Node.js process.
// For multi-instance deployments, externalise the cache to Redis before scaling.
module.exports = new FinanceAgent();
