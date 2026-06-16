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

function sendError(res, feature, error) {
    console.error(`[Coordinator:${feature}]`, error.message);
    const status = error.message.includes('No transactions') ? 404 : 500;
    res.status(status).json({ message: error.message });
}

// ── Feature 1: Health Score ───────────────────────────────────────────────────
exports.getHealthScore = async (req, res) => {
    try { res.json(await coordinator.healthScore(req.user.id)); }
    catch (error) { sendError(res, 'healthScore', error); }
};

// ── Feature 2: Budget Recommendation ─────────────────────────────────────────
exports.getBudgetRecommendation = async (req, res) => {
    try { res.json(await coordinator.generateBudgetAdvice(req.user.id)); }
    catch (error) { sendError(res, 'budgetAdvice', error); }
};

// ── Feature 3: Spending Analysis ──────────────────────────────────────────────
exports.getSpendingAnalysis = async (req, res) => {
    try { res.json(await coordinator.analyzeSpendingPatterns(req.user.id)); }
    catch (error) { sendError(res, 'spendingAnalysis', error); }
};

// ── Feature 4: Expense Prediction ────────────────────────────────────────────
exports.getExpensePrediction = async (req, res) => {
    try { res.json(await coordinator.predictExpenses(req.user.id)); }
    catch (error) { sendError(res, 'predictExpenses', error); }
};

// ── Feature 5: Chat ───────────────────────────────────────────────────────────
// Body: { message: string, history?: [{role,content}] }
exports.chat = async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'message is required.' });
    try {
        const result = await coordinator.financialChat(req.user.id, message.trim(), history);
        res.json(result);
    } catch (error) { sendError(res, 'chat', error); }
};

// ── Feature 6: Voice ──────────────────────────────────────────────────────────
// Body: { transcript: string }
exports.processVoice = async (req, res) => {
    const { transcript } = req.body;
    if (!transcript?.trim()) return res.status(400).json({ message: 'transcript is required.' });
    try {
        const result = await coordinator.processVoiceCommand(req.user.id, transcript.trim());
        res.json(result);
    } catch (error) { sendError(res, 'voice', error); }
};

// ── Feature 7: Monthly Report (JSON) ─────────────────────────────────────────
// GET /api/v1/ai/monthly-report?year=2024&month=6
exports.getMonthlyReport = async (req, res) => {
    const year  = parseInt(req.query.year,  10) || moment().year();
    const month = parseInt(req.query.month, 10) || moment().month() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1–12.' });
    try {
        const result = await coordinator.generateMonthlyReport(req.user.id, year, month);
        res.json(result);
    } catch (error) { sendError(res, 'monthlyReport', error); }
};

// ── Feature 7b: Monthly Report PDF Download ───────────────────────────────────
// GET /api/v1/ai/monthly-report/download?year=2024&month=6
exports.downloadMonthlyReport = async (req, res) => {
    const year  = parseInt(req.query.year,  10) || moment().year();
    const month = parseInt(req.query.month, 10) || moment().month() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1–12.' });

    try {
        const { pdf, report } = await coordinator.generateMonthlyReportPDF(
            req.user.id, year, month
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
    try { res.json(await coordinator.runAllAnalysis(req.user.id)); }
    catch (error) { sendError(res, 'runAll', error); }
};
