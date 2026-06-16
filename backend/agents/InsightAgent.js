'use strict';

/**
 * InsightAgent — Detects spending trends, patterns, and anomalies over 6 months.
 *
 * Purely AI-driven (unlike HealthAgent and PredictionAgent which are algorithmic-first).
 * Uses Gemini to identify non-obvious patterns in the monthly spending series
 * that simple statistics would miss.
 */

const gemini = require('./shared/GeminiClient');
const cache  = require('./shared/AgentCache');

const TTL = 60 * 60 * 1000; // 1 hr

class InsightAgent {

    /**
     * @param   {string} userId
     * @param   {Object} financialData — from financeDataService.getUserFinancialData()
     * @returns {Promise<Object>}
     */
    async analyzeSpending(userId, financialData) {
        const cacheKey = `spending:${userId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const d = financialData;

        const prompt = `
You are a financial data analyst. Identify meaningful spending patterns and anomalies.

Monthly Expense History (last 6 months): ${JSON.stringify(d.monthlyTrends)}
Category Breakdown (last 30 days):       ${JSON.stringify(d.categoryBreakdown)}
Top 3 Spending Categories:               ${JSON.stringify(d.topCategories)}
Month-over-Month Change:                 ${d.momChange > 0 ? '+' : ''}${d.momChange}%

Return ONLY valid JSON:
{
  "overallTrend":    <"increasing"|"decreasing"|"stable">,
  "trendPercentage": <positive number>,
  "analysis":        "<3-sentence narrative identifying key patterns>",
  "patterns": [
    {
      "title":       "<short pattern name>",
      "description": "<what is happening and why it matters>",
      "impact":      <"positive"|"negative"|"neutral">,
      "category":    "<category name or null>"
    }
  ],
  "anomalies": [
    {
      "month":       "<MMM YYYY>",
      "category":    "<category name>",
      "description": "<why this is unusual>",
      "suggestion":  "<corrective action>"
    }
  ],
  "monthlyData": [
    { "month": "<MMM YYYY>", "amount": <number>, "changeFromPrev": <signed %> }
  ],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}`;

        const result = await gemini.generateJSON(prompt);
        cache.set(cacheKey, result, TTL);
        return result;
    }
}

module.exports = new InsightAgent();
