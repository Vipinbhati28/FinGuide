'use strict';

/**
 * BudgetAgent — Generates personalised budget allocations using the 50/30/20 rule.
 *
 * Receives pre-fetched financial data from the coordinator to avoid
 * a duplicate DB call when multiple agents are running in parallel.
 */

const gemini = require('./shared/GeminiClient');
const cache  = require('./shared/AgentCache');

const TTL = 30 * 60 * 1000; // 30 min

class BudgetAgent {

    /**
     * @param   {string} userId
     * @param   {Object} financialData — from financeDataService.getUserFinancialData()
     * @returns {Promise<Object>}
     */
    async getRecommendation(userId, financialData) {
        const cacheKey = `budget:${userId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const d = financialData;

        const prompt = `
You are a personal finance advisor applying the 50/30/20 budgeting rule.

User's Spending Profile:
  Monthly Income (last 30d):    ₹${d.monthlyIncome}
  Monthly Expenses (last 30d):  ₹${d.monthlyExpense}
  Avg Monthly Expenses:         ₹${d.avgMonthlyExpense}
  Current Budget Limit:         ₹${d.currentBudget}
  Category-wise Spend:          ${JSON.stringify(d.categoryBreakdown)}

Rules:
  - 50% → essential needs (rent, food, utilities, transport)
  - 30% → discretionary wants
  - 20% → savings + emergency fund
  - Adjust percentages to match the user's actual categories.
  - All amounts in Indian Rupees (₹).

Return ONLY valid JSON:
{
  "totalRecommendedBudget": <number>,
  "methodology": "<1-sentence explanation>",
  "categories": [
    {
      "name": "<category>",
      "recommended": <number>,
      "currentSpend": <number>,
      "percentage": <number 0-100>,
      "priority": <"essential"|"important"|"optional">,
      "tip": "<specific saving tip>"
    }
  ],
  "savingsTarget": <number>,
  "savingsPercentage": <number>,
  "emergencyFundMonths": <number>,
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]
}`;

        const result = await gemini.generateJSON(prompt);
        cache.set(cacheKey, result, TTL);
        return result;
    }
}

module.exports = new BudgetAgent();
