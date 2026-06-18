'use strict';

/**
 * aiController — Thin HTTP adapter for the FinanceAgentCoordinator.
 *
 * Responsibilities:
 *   1. Extract and validate HTTP request inputs (params, body, query).
 *   2. Delegate to the appropriate coordinator method.
 *   3. Return the result or a standardised error response.
 *
 * Zero business logic, zero DB queries, zero prompt construction here.
 */

const coordinator = require('../agents/FinanceAgentCoordinator');
const moment      = require('moment');
const { isValidObjectId } = require('mongoose');

// ── Centralised error handler ─────────────────────────────────────────────────
function sendError(res, feature, error) {
    const msg = error?.message ?? String(error);

    // Classify to choose HTTP status + user-facing text
    const isNoData = msg.includes('No transactions');
    const isGemini = error?.isAIServiceError ||
                     msg.includes('GoogleGenerativeAI') ||
                     msg.includes('generativelanguage.googleapis') ||
                     msg.includes('fetch') ||
                     msg.includes('not valid JSON');
    const isMongo  = msg.includes('BSON') ||
                     msg.includes('MongoServerError') ||
                     msg.includes('MongoNetworkError') ||
                     msg.includes('buffering timed out');

    // Structured log: always timestamp + feature + full message
    console.error(`[AI:${feature}] ${new Date().toISOString()} — ${msg}`);
    if (process.env.NODE_ENV !== 'production') console.error(error?.stack ?? '(no stack)');

    const status  = isNoData ? 404 : isGemini ? 503 : 500;
    const message = isNoData
        ? msg
        : isGemini
            ? 'AI service temporarily unavailable. Please try again in a moment.'
            : isMongo
                ? 'Database error. Please try again.'
                : 'Internal server error. Please try again later.';

    res.status(status).json({
        message,
        ...(process.env.NODE_ENV !== 'production' && { detail: msg }),
    });
}

// ── Auth + input guard ────────────────────────────────────────────────────────
function validateUser(req, res) {
    if (!req.user || !req.user.id) {
        res.status(401).json({ message: 'Authentication required.' });
        return false;
    }
    if (!isValidObjectId(req.user.id)) {
        res.status(400).json({ message: 'Invalid user ID.' });
        return false;
    }
    return true;
}

// ── Feature 1: Health Score ───────────────────────────────────────────────────
exports.getHealthScore = async (req, res) => {
    if (!validateUser(req, res)) return;
    try {
        console.log(`[AI:healthScore] user=${req.user.id}`);
        res.json(await coordinator.healthScore(String(req.user.id)));
    } catch (error) { sendError(res, 'healthScore', error); }
};

// ── Feature 2: Budget Recommendation ─────────────────────────────────────────
exports.getBudgetRecommendation = async (req, res) => {
    if (!validateUser(req, res)) return;
    try {
        console.log(`[AI:budgetAdvice] user=${req.user.id}`);
        res.json(await coordinator.generateBudgetAdvice(String(req.user.id)));
    } catch (error) { sendError(res, 'budgetAdvice', error); }
};

// ── Feature 3: Spending Analysis ──────────────────────────────────────────────
exports.getSpendingAnalysis = async (req, res) => {
    if (!validateUser(req, res)) return;
    try {
        console.log(`[AI:spendingAnalysis] user=${req.user.id}`);
        res.json(await coordinator.analyzeSpendingPatterns(String(req.user.id)));
    } catch (error) { sendError(res, 'spendingAnalysis', error); }
};

// ── Feature 4: Expense Prediction ────────────────────────────────────────────
exports.getExpensePrediction = async (req, res) => {
    if (!validateUser(req, res)) return;
    try {
        console.log(`[AI:expensePrediction] user=${req.user.id}`);
        res.json(await coordinator.predictExpenses(String(req.user.id)));
    } catch (error) { sendError(res, 'predictExpenses', error); }
};

// ── Feature 5: Chat ───────────────────────────────────────────────────────────
// Body: { message: string, history?: [{role,content}] }
exports.chat = async (req, res) => {
    if (!validateUser(req, res)) return;
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'message is required.' });
    if (!Array.isArray(history)) return res.status(400).json({ message: 'history must be an array.' });
    try {
        console.log(`[AI:chat] user=${req.user.id} msgLen=${message.trim().length}`);
        const result = await coordinator.financialChat(String(req.user.id), message.trim(), history);
        res.json(result);
    } catch (error) { sendError(res, 'chat', error); }
};

// ── Feature 6: Voice ──────────────────────────────────────────────────────────
// Body: { transcript: string }
exports.processVoice = async (req, res) => {
    if (!validateUser(req, res)) return;
    const { transcript } = req.body;
    if (!transcript?.trim()) return res.status(400).json({ message: 'transcript is required.' });
    try {
        console.log(`[AI:voice] user=${req.user.id}`);
        const result = await coordinator.processVoiceCommand(String(req.user.id), transcript.trim());
        res.json(result);
    } catch (error) { sendError(res, 'voice', error); }
};

// ── Feature 7: Monthly Report (JSON) ─────────────────────────────────────────
// GET /api/v1/ai/monthly-report?year=2024&month=6
exports.getMonthlyReport = async (req, res) => {
    if (!validateUser(req, res)) return;
    const year  = parseInt(req.query.year,  10) || moment().year();
    const month = parseInt(req.query.month, 10) || moment().month() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1–12.' });
    try {
        console.log(`[AI:monthlyReport] user=${req.user.id} period=${year}-${month}`);
        const result = await coordinator.generateMonthlyReport(String(req.user.id), year, month);
        res.json(result);
    } catch (error) { sendError(res, 'monthlyReport', error); }
};

// ── Feature 7b: Monthly Report PDF Download ───────────────────────────────────
// GET /api/v1/ai/monthly-report/download?year=2024&month=6
exports.downloadMonthlyReport = async (req, res) => {
    if (!validateUser(req, res)) return;
    const year  = parseInt(req.query.year,  10) || moment().year();
    const month = parseInt(req.query.month, 10) || moment().month() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1–12.' });

    try {
        console.log(`[AI:downloadPDF] user=${req.user.id} period=${year}-${month}`);
        const { pdf, report } = await coordinator.generateMonthlyReportPDF(
            String(req.user.id), year, month
        );
        const filename = `FinGuide-Report-${report.rawData?.reportMonth?.replace(' ', '-') ?? `${year}-${month}`}.pdf`;

        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      pdf.length,
        });
        res.send(pdf);
    } catch (error) {
        sendError(res, 'downloadPDF', error);
    }
};

// ── Feature 8: Run All (for dashboard parallel load) ──────────────────────────
// GET /api/v1/ai/all
exports.runAllAnalysis = async (req, res) => {
    if (!validateUser(req, res)) return;
    try {
        console.log(`[AI:runAll] user=${req.user.id}`);
        res.json(await coordinator.runAllAnalysis(String(req.user.id)));
    } catch (error) { sendError(res, 'runAll', error); }
};
