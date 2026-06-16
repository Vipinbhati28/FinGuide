'use strict';

/**
 * AdvisorAgent — User-facing financial chatbot and voice command processor.
 *
 * Chat is stateless: the full conversation history is passed in on each call
 * and stored in MongoDB by the chat controller (not here). This keeps the agent
 * pure and testable.
 *
 * Voice processing returns a structured intent object; the frontend hook
 * executes the actual actions (navigate, add expense, etc.).
 */

const gemini = require('./shared/GeminiClient');

class AdvisorAgent {

    /**
     * Multi-turn chat with pre-built financial context.
     *
     * @param   {string} userId
     * @param   {string} message         — user's current question
     * @param   {Array}  history         — [{role, content}] prior turns
     * @param   {string|null} systemContext — pre-built rich context string (from chatController)
     * @param   {Object|null} financialData — fallback if no systemContext
     * @returns {Promise<{reply: string, timestamp: string}>}
     */
    async chat(userId, message, history = [], systemContext = null, financialData = null) {
        // Build system prompt from whichever source is available
        const systemPrompt = systemContext ?? this._buildFallbackPrompt(financialData);

        const geminiHistory = [
            { role: 'user',  parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: "Understood! I'm FinGuide AI, your personal financial advisor with access to your live data. What would you like to know?" }] },
            ...history.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        ];

        const session = gemini.startChat(geminiHistory);
        let result;
        try {
            result = await session.sendMessage(message);
        } catch (geminiErr) {
            console.error(`[AdvisorAgent] chat failed for user ${userId}: ${geminiErr.message}`);
            return {
                reply:     'I\'m having trouble connecting to the AI service right now. Please try again in a moment.',
                timestamp: new Date().toISOString(),
            };
        }

        return {
            reply:     result.response.text().trim(),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Parses a voice transcript into a structured intent.
     *
     * The frontend hook handles EXECUTION of the action (navigate, API call).
     * This method only classifies intent and generates a spoken response.
     *
     * @param   {string} userId
     * @param   {string} transcript
     * @param   {Object} financialData
     * @returns {Promise<Object>}
     */
    async processVoice(userId, transcript, financialData) {
        const d = financialData ?? {};

        const prompt = `
You are FinGuide Voice Assistant. Parse this spoken command into a structured response.

Spoken Command: "${transcript}"

User's Financial Snapshot:
  Balance:          ₹${(d.totalIncome || 0) - (d.totalExpense || 0)}
  Monthly Income:   ₹${d.monthlyIncome || 0}
  Monthly Expenses: ₹${d.monthlyExpense || 0}
  Budget Remaining: ₹${d.budgetLeft || 0} of ₹${d.totalBudget || 0}
  Top Categories:   ${(d.topCategories || []).join(', ')}

Intent taxonomy:
  balance_query | expense_query | income_query | budget_query |
  add_expense | add_income | advice | navigate | general

Navigation routes: /dashboard /income /expense /budget /ai-insights /chatbot /report /predictions

"response" must sound natural when spoken aloud — conversational, max 2 sentences.
For add_expense intent: extract amount and category from the transcript.
For navigate intent: set action.route to the matching route.

Return ONLY valid JSON:
{
  "intent": "<intent>",
  "response": "<spoken reply with real numbers>",
  "data": {
    "amount":    <number|null>,
    "category":  "<category|null>",
    "timeframe": <"today"|"week"|"month"|null>
  },
  "action": {
    "type":     <"navigate"|"add_expense"|"add_income"|"none">,
    "route":    <"/<page>"|null>,
    "payload":  <{amount, category, description}|null>
  }
}`;

        try {
            return await gemini.generateJSON(prompt);
        } catch (geminiErr) {
            console.error(`[AdvisorAgent] voice failed for user ${userId}: ${geminiErr.message}`);
            return {
                intent: 'general',
                response: 'I\'m having trouble connecting to the AI service right now. Please try again.',
                data: { amount: null, category: null, timeframe: null },
                action: { type: 'none', route: null, payload: null },
            };
        }
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _buildFallbackPrompt(d) {
        if (!d) return 'You are FinGuide AI, a personal financial advisor. Be helpful and concise.';
        return `
You are FinGuide AI, a personal financial advisor.
User context: Balance ₹${(d.totalIncome || 0) - (d.totalExpense || 0)},
Monthly income ₹${d.monthlyIncome || 0}, Monthly expenses ₹${d.monthlyExpense || 0},
Savings rate ${d.savingsRate || 0}%, Budget remaining ₹${d.budgetLeft || 0}.
Be concise (2-4 paragraphs). Use ₹. Reference the user's actual numbers.`.trim();
    }
}

module.exports = new AdvisorAgent();
