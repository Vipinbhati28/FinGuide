'use strict';

/**
 * FinanceAgentCoordinator — Orchestrates the 6 specialized finance agents.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                     HTTP Controller Layer                            │
 * │                           ↓                                         │
 * │          FinanceAgentCoordinator  (this file)                        │
 * │                                                                      │
 * │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
 * │  │HealthAgt │ │BudgetAgt │ │PredictAgt│ │InsightAgt│               │
 * │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
 * │  ┌──────────┐ ┌──────────┐                                          │
 * │  │ReportAgt │ │AdvisorAgt│                                          │
 * │  └──────────┘ └──────────┘                                          │
 * │                    ↓ all share ↓                                     │
 * │   ┌────────────────┐   ┌────────────────────────────┐               │
 * │   │  GeminiClient  │   │    AgentCache (shared TTL) │               │
 * │   └────────────────┘   └────────────────────────────┘               │
 * │                    ↓ data from ↓                                     │
 * │              financeDataService  (MongoDB)                           │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * KEY DESIGN PRINCIPLES:
 *   1. The coordinator fetches financial data ONCE per user per request window
 *      (2-min shared context cache) and passes it to every agent.
 *      → No agent ever queries the DB independently for user data.
 *
 *   2. Each agent is responsible for ONE concern only (single-responsibility).
 *      → The coordinator wires them together without knowing their internals.
 *
 *   3. `runAllAnalysis(userId)` runs all analysis agents in parallel using
 *      Promise.allSettled, so a single agent failure doesn't block the dashboard.
 *
 *   4. The public API mirrors the old FinanceAgent so aiController.js needs
 *      minimal changes (drop-in replacement).
 */

'use strict';

const financeDataService = require('../services/financeDataService');
const cache              = require('./shared/AgentCache');

const healthAgent     = require('./HealthAgent');
const budgetAgent     = require('./BudgetAgent');
const predictionAgent = require('./PredictionAgent');
const insightAgent    = require('./InsightAgent');
const reportAgent     = require('./ReportAgent');
const advisorAgent    = require('./AdvisorAgent');

// Shared context TTL — short enough to stay fresh, long enough to cover a full
// page-load burst where multiple features request data within seconds of each other.
const CONTEXT_TTL = 2 * 60 * 1000; // 2 min

class FinanceAgentCoordinator {

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Shared Context
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Fetches (or returns cached) the full financial data snapshot for a user.
     * All agents that need this data should call this method, NOT financeDataService directly.
     *
     * @param   {string} userId
     * @returns {Promise<Object>} aggregated financial snapshot
     */
    async _getContext(userId) {
        const key    = `ctx:${userId}`;
        const cached = cache.get(key);
        if (cached) return cached;

        const data = await financeDataService.getUserFinancialData(userId);
        cache.set(key, data, CONTEXT_TTL);
        return data;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Feature API (mirrors old FinanceAgent public API)
    // ═══════════════════════════════════════════════════════════════════════════

    /** Feature 1 — Financial Health Score (algorithmic + AI narrative) */
    async healthScore(userId) {
        const data = await this._getContext(userId);
        return healthAgent.enrichedScore(userId, data);
    }

    /** Feature 1b — Algorithmic-only score (for dashboard widget, no AI) */
    async algorithmicHealthScore(userId) {
        const data = await this._getContext(userId);
        return healthAgent.algorithmicScore(data);
    }

    /** Feature 2 — AI Budget Recommendation */
    async generateBudgetAdvice(userId) {
        const data = await this._getContext(userId);
        return budgetAgent.getRecommendation(userId, data);
    }

    /** Feature 3 — Spending Pattern Analysis */
    async analyzeSpendingPatterns(userId) {
        const data = await this._getContext(userId);
        return insightAgent.analyzeSpending(userId, data);
    }

    /** Feature 4 — Expense Prediction (deterministic + AI narrative) */
    async predictExpenses(userId) {
        const data = await this._getContext(userId);
        return predictionAgent.getEnrichedPrediction(userId, data);
    }

    /** Feature 4b — Raw prediction (no AI narrative) */
    async rawPrediction(userId) {
        return predictionAgent.getPrediction(userId);
    }

    /** Feature 4c — Prediction history */
    async predictionHistory(userId) {
        return predictionAgent.getHistory(userId);
    }

    /** Feature 5 — Financial Advisor Chat */
    async financialChat(userId, message, history = [], systemContext = null) {
        const data = systemContext ? null : await this._getContext(userId);
        return advisorAgent.chat(userId, message, history, systemContext, data);
    }

    /** Feature 6 — Voice Command Processing */
    async processVoiceCommand(userId, transcript) {
        const data = await this._getContext(userId);
        return advisorAgent.processVoice(userId, transcript, data);
    }

    /** Feature 7 — Monthly Financial Report (AI narrative) */
    async generateMonthlyReport(userId, year, month) {
        return reportAgent.generateNarrative(userId, year, month);
    }

    /** Feature 7b — PDF download for monthly report */
    async generateMonthlyReportPDF(userId, year, month) {
        const report = await reportAgent.generateNarrative(userId, year, month);
        const pdf    = await reportAgent.generatePDF(report);
        return { pdf, report };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Parallel Execution (for full dashboard load)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Runs all four analysis agents in parallel using ONE shared DB fetch.
     * Uses Promise.allSettled so a single agent failure does not block the others.
     *
     * Returns an object with each feature's result or error.
     *
     * @param   {string} userId
     * @returns {Promise<{healthScore, budgetAdvice, spendingAnalysis, prediction}>}
     */
    async runAllAnalysis(userId) {
        const data = await this._getContext(userId);

        const [healthResult, budgetResult, spendingResult, predictionResult] =
            await Promise.allSettled([
                healthAgent.enrichedScore(userId, data),
                budgetAgent.getRecommendation(userId, data),
                insightAgent.analyzeSpending(userId, data),
                predictionAgent.getEnrichedPrediction(userId, data),
            ]);

        const unwrap = (settled) =>
            settled.status === 'fulfilled'
                ? { data: settled.value,  error: null }
                : { data: null, error: settled.reason?.message };

        return {
            healthScore:      unwrap(healthResult),
            budgetAdvice:     unwrap(budgetResult),
            spendingAnalysis: unwrap(spendingResult),
            prediction:       unwrap(predictionResult),
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Cache Management
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Removes all cached data for a user.
     * Call after the user adds/updates income, expenses, or budgets.
     * @param {string} userId
     */
    invalidateUser(userId) {
        cache.invalidatePattern(userId);
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────
module.exports = new FinanceAgentCoordinator();
