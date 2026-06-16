'use strict';

/**
 * PredictionAgent — Delegates to the deterministic predictionService
 * and optionally enriches the output with an AI narrative.
 *
 * The numeric predictions (predictedExpense, predictedSavings, confidence)
 * always come from the statistical engine (WMA + Linear Regression).
 * AI is only used for the written narrative that explains the forecast.
 */

const predictionService = require('../services/predictionService');
const gemini = require('./shared/GeminiClient');
const cache  = require('./shared/AgentCache');

const TTL = 60 * 60 * 1000; // 1 hr

class PredictionAgent {

    /**
     * Generates (or returns cached) next-month prediction.
     * @param   {string} userId
     * @returns {Promise<Object>}
     */
    async getPrediction(userId) {
        return predictionService.generatePrediction(userId);
    }

    /**
     * Returns the last 12 months of prediction history with actuals backfilled.
     * @param   {string} userId
     * @returns {Promise<Array>}
     */
    async getHistory(userId) {
        return predictionService.getHistory(userId);
    }

    /**
     * Prediction + AI narrative explaining the forecast in plain language.
     * @param   {string} userId
     * @param   {Object} financialData
     * @returns {Promise<Object>}
     */
    async getEnrichedPrediction(userId, financialData) {
        const cacheKey = `prediction:${userId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const pred = await predictionService.generatePrediction(userId);
        const d    = financialData;

        const prompt = `
You are a financial forecasting expert. Explain this prediction in plain language.

Statistical Prediction (numbers are fixed — do not change them):
  Predicted Expense:  ₹${pred.predictedExpense}
  Predicted Savings:  ₹${pred.predictedSavings}
  Confidence:         ${pred.confidence}%
  Trend:              ${pred.trend}
  Algorithm:          ${pred.algorithm}
  Data Months:        ${pred.dataMonths}
  Category Forecasts: ${JSON.stringify(pred.categoryPredictions?.slice(0, 5))}

User context:
  Current Monthly Income:  ₹${d.monthlyIncome}
  Recent Monthly Expense:  ₹${d.monthlyExpense}
  Month-over-Month Change: ${d.momChange}%

Return ONLY valid JSON:
{
  "summary": "<2-sentence plain-language explanation of what the forecast means for this user>",
  "riskFactors": ["<risk 1>", "<risk 2>"],
  "savingOpportunities": ["<opportunity 1>", "<opportunity 2>"],
  "confidenceExplanation": "<1 sentence on why confidence is ${pred.confidence}%>"
}`;

        const narrative = await gemini.generateJSON(prompt);
        const result = { ...pred, ...narrative };

        cache.set(cacheKey, result, TTL);
        return result;
    }
}

module.exports = new PredictionAgent();
