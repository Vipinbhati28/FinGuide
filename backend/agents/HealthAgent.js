'use strict';

/**
 * HealthAgent — Responsible for financial health scoring.
 *
 * Two modes:
 *   1. algorithmicScore(data)  — deterministic, pure math, instant (<5ms)
 *   2. enrichedScore(userId, data) — algorithmic base + AI narrative summary
 *
 * The coordinator calls enrichedScore() for the AI insights page and
 * algorithmicScore() for the lightweight dashboard widget, so the numeric
 * score is ALWAYS the same regardless of which endpoint is called.
 */

const gemini = require('./shared/GeminiClient');
const cache  = require('./shared/AgentCache');
const healthScoreService = require('../services/healthScoreService');

const TTL = 30 * 60 * 1000; // 30 min

class HealthAgent {

    /**
     * Pure algorithmic score — no AI call.
     * Accepts pre-fetched financial data so the coordinator can share one DB fetch.
     * @param   {Object} financialData — from financeDataService.getUserFinancialData()
     * @returns {HealthScoreResult}
     */
    algorithmicScore(financialData) {
        return healthScoreService.calculateScoreFromData(financialData);
    }

    /**
     * Algorithmic score + AI narrative + personalised tips.
     * Result is cached for 30 min per user.
     *
     * @param   {string} userId
     * @param   {Object} financialData
     * @returns {Promise<Object>}
     */
    async enrichedScore(userId, financialData) {
        const cacheKey = `health:${userId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Deterministic base — score/grade will never be overridden by AI
        const base = this.algorithmicScore(financialData);
        const d    = financialData;

        const prompt = `
You are a certified financial analyst providing personalised feedback.
An algorithm has already scored this user's financial health — do NOT change the numbers.

Score: ${base.score}/100   Grade: ${base.grade}
Strengths:      ${base.strengths.join('; ')}
Weaknesses:     ${base.weaknesses.join('; ')}
Recommendations:${base.recommendations.join('; ')}

User context:
  Monthly Income:    ₹${d.monthlyIncome}
  Monthly Expenses:  ₹${d.monthlyExpense}
  Savings Rate:      ${d.savingsRate}%
  Budget Used:       ${d.budgetUtilization}%
  Top categories:    ${d.categoryBreakdown.slice(0, 4).map(c => c.category).join(', ')}

Return ONLY valid JSON with this exact schema:
{
  "score":   ${base.score},
  "grade":   "${base.grade}",
  "summary": "<3-sentence narrative using the user's real numbers>",
  "breakdown":      ${JSON.stringify(base.breakdown)},
  "strengths":      ${JSON.stringify(base.strengths)},
  "weaknesses":     ${JSON.stringify(base.weaknesses)},
  "recommendations":${JSON.stringify(base.recommendations)},
  "tips": ["<highly specific tip 1>", "<tip 2>", "<tip 3>", "<tip 4>", "<tip 5>"]
}`;

        const aiResult = await gemini.generateJSON(prompt);

        // Hard-pin algorithmic values — AI can never override them
        const result = {
            ...aiResult,
            score:        base.score,
            grade:        base.grade,
            breakdown:    base.breakdown,
            strengths:    base.strengths,
            weaknesses:   base.weaknesses,
            recommendations: base.recommendations,
        };

        cache.set(cacheKey, result, TTL);
        return result;
    }
}

module.exports = new HealthAgent();
