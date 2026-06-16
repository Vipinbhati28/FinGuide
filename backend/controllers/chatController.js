/**
 * chatController — Financial Advisor Chatbot with MongoDB-persisted history.
 *
 * Before each Gemini call, a rich financial context is assembled from:
 *   • Live income/expense data  (financeDataService)
 *   • Current health score      (healthScoreService)
 *   • Latest expense prediction (predictionService)
 *   • Budget status             (financeDataService)
 *   • Spending trends           (financeDataService.monthlyTrends)
 *   • Top expense categories    (financeDataService.categoryBreakdown)
 *
 * All exchanges are persisted to ChatHistory (MongoDB) so the conversation
 * survives page reloads and server restarts.
 *
 * Routes:
 *   GET    /api/v1/chat/history   — load full history for display
 *   POST   /api/v1/chat/message   — send message, receive AI reply, persist both
 *   DELETE /api/v1/chat/clear     — clear all history for the user
 */

'use strict';

const FinanceAgent       = require('../agents/FinanceAgent');
const financeDataService = require('../services/financeDataService');
const healthScoreService = require('../services/healthScoreService');
const predictionService  = require('../services/predictionService');
const ChatHistory        = require('../models/ChatHistory');
const PredictionHistory  = require('../models/PredictionHistory');

// ─── Context Builder ──────────────────────────────────────────────────────────
/**
 * Assembles a comprehensive financial context string to inject into every
 * Gemini chat session. This ensures the advisor always answers using the
 * user's real, current financial data — not generic advice.
 *
 * Runs three parallel fetches to minimise latency.
 *
 * @param   {string} userId
 * @returns {Promise<string>} multi-line context block
 */
async function buildFinancialContext(userId) {
    // Fetch financial data first, then run health score + prediction in parallel
    const data = await financeDataService.getUserFinancialData(userId);
    const [healthScore, latestPrediction] = await Promise.all([
        Promise.resolve(healthScoreService.calculateScoreFromData(data)).catch(() => null),
        PredictionHistory.findOne({ userId }).sort({ createdAt: -1 }).lean().catch(() => null),
    ]);

    const balance    = data.totalIncome - data.totalExpense;
    const topCats    = data.categoryBreakdown
        .slice(0, 5)
        .map(c => `    ${c.category}: ₹${c.total.toLocaleString('en-IN')}`)
        .join('\n');
    const momChange  = data.momChange > 0 ? `+${data.momChange}%` : `${data.momChange}%`;
    const monthlyTrend = data.monthlyTrends
        .slice(-3)
        .map(m => `    ${m.month}: ₹${m.amount.toLocaleString('en-IN')}`)
        .join('\n');

    return `
════════════════════════════════════════════
  FINGUIDE AI — FINANCIAL ADVISOR CONTEXT
  Updated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
════════════════════════════════════════════

INCOME & BALANCE:
  Net Balance (all-time):    ₹${balance.toLocaleString('en-IN')}
  Monthly Income (30d):      ₹${data.monthlyIncome.toLocaleString('en-IN')}
  Monthly Expenses (30d):    ₹${data.monthlyExpense.toLocaleString('en-IN')}
  Savings Rate:              ${data.savingsRate}%

BUDGET:
  Monthly Budget:            ₹${data.totalBudget.toLocaleString('en-IN')}
  Budget Used:               ₹${data.budgetUsed.toLocaleString('en-IN')} (${data.budgetUtilization}%)
  Budget Remaining:          ₹${data.budgetLeft.toLocaleString('en-IN')}

FINANCIAL HEALTH SCORE:
  Score:  ${healthScore?.score ?? 'N/A'} / 100  (Grade: ${healthScore?.grade ?? 'N/A'})
  Weaknesses: ${healthScore?.weaknesses?.slice(0, 2).join('; ') ?? 'N/A'}

TOP SPENDING CATEGORIES (last 30 days):
${topCats || '  No expense data'}

SPENDING TREND:
  Month-over-Month Change: ${momChange}
  Recent Monthly Spend:
${monthlyTrend || '  No trend data'}

${latestPrediction ? `NEXT MONTH PREDICTION:
  Predicted Expense:  ₹${latestPrediction.predictedExpense?.toLocaleString('en-IN') ?? 'N/A'}
  Predicted Savings:  ₹${latestPrediction.predictedSavings?.toLocaleString('en-IN') ?? 'N/A'}
  Confidence:         ${latestPrediction.confidence ?? 'N/A'}%
  Trend:              ${latestPrediction.trend ?? 'N/A'}` : ''}

════════════════════════════════════════════
ADVISOR RULES:
  • Always reference the user's actual numbers in your answers.
  • Be concise — 2-4 paragraphs max unless the user asks for detail.
  • Use ₹ for all currency amounts.
  • For investment or stock picks, recommend a SEBI-registered advisor.
  • Be encouraging but honest about overspending or poor habits.
  • Suggest specific, actionable steps (not generic advice).
════════════════════════════════════════════`.trim();
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/history
 * Returns the full conversation history for the authenticated user.
 */
exports.getHistory = async (req, res) => {
    try {
        const doc = await ChatHistory.findOne({ userId: req.user.id }).lean();
        res.json({ messages: doc?.messages || [] });
    } catch (error) {
        console.error('[chatController:getHistory]', error.message);
        res.status(500).json({ message: 'Failed to load chat history.' });
    }
};

/**
 * POST /api/v1/chat/message
 * Body: { message: string }
 *
 * 1. Builds financial context from live data.
 * 2. Loads recent history from DB for Gemini context window.
 * 3. Calls FinanceAgent.financialChat() which routes through Gemini.
 * 4. Persists both user message and AI reply to ChatHistory.
 */
exports.sendMessage = async (req, res) => {
    const { message } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ message: 'message is required.' });
    }

    try {
        const userId = req.user.id;

        // Load last 20 messages to keep Gemini context manageable
        const recentMessages = await ChatHistory.getRecent(userId, 20);

        // Build comprehensive financial context for this request
        const systemContext = await buildFinancialContext(userId);

        // Prepare history in FinanceAgent's expected format
        const historyForAgent = recentMessages.map(m => ({
            role:    m.role,
            content: m.content,
        }));

        // Call Gemini through FinanceAgent with injected context
        const { reply, timestamp } = await FinanceAgent.financialChat(
            userId,
            message.trim(),
            historyForAgent,
            systemContext  // pass the pre-built context to override the default
        );

        // Persist both sides of the exchange to MongoDB
        await ChatHistory.appendExchange(userId, message.trim(), reply);

        res.json({ reply, timestamp });
    } catch (error) {
        console.error('[chatController:sendMessage]', error.message);
        res.status(500).json({ message: 'Failed to get advisor response.' });
    }
};

/**
 * DELETE /api/v1/chat/clear
 * Removes all chat history for the user and resets the conversation.
 */
exports.clearHistory = async (req, res) => {
    try {
        await ChatHistory.findOneAndUpdate(
            { userId: req.user.id },
            { $set: { messages: [] } }
        );
        // Also clear FinanceAgent's in-memory cache for this user
        FinanceAgent.invalidateUser(req.user.id);
        res.json({ message: 'Chat history cleared.' });
    } catch (error) {
        console.error('[chatController:clearHistory]', error.message);
        res.status(500).json({ message: 'Failed to clear history.' });
    }
};
