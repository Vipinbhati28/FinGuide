'use strict';

/**
 * ReportAgent — Generates the monthly financial report narrative and PDF.
 *
 * Two responsibilities:
 *   1. generateNarrative(userId, year, month) → AI-written JSON report
 *   2. generatePDF(reportData)                → pdfkit PDF Buffer
 *
 * The PDF uses a clean, structured layout with sections matching the 6-part
 * report schema: Executive Summary, Income, Expenses, Budget, Predictions, Recommendations.
 */

const PDFDocument = require('pdfkit');
const gemini      = require('./shared/GeminiClient');
const cache       = require('./shared/AgentCache');
const financeDataService = require('../services/financeDataService');
const PredictionHistory  = require('../models/PredictionHistory');

const TTL = 2 * 60 * 60 * 1000; // 2 hr

// ─── Colour palette used in PDF ──────────────────────────────────────────────
const COLORS = {
    primary:    '#875cf5',
    dark:       '#1f2937',
    muted:      '#6b7280',
    light:      '#f9fafb',
    border:     '#e5e7eb',
    success:    '#059669',
    danger:     '#dc2626',
};

class ReportAgent {

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — AI Narrative
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Generates (or returns cached) a full-month AI financial report.
     * @param   {string} userId
     * @param   {number} year
     * @param   {number} month  1–12
     * @returns {Promise<Object>} merged AI report + rawData
     */
    async generateNarrative(userId, year, month) {
        const cacheKey = `report:${userId}:${year}:${month}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const [d, latestPred] = await Promise.all([
            financeDataService.getMonthlyReportData(userId, year, month),
            PredictionHistory.findOne({ userId }).sort({ createdAt: -1 }).lean().catch(() => null),
        ]);

        if (d.transactionCount === 0) {
            throw new Error('No transactions found for this period.');
        }

        const prompt = `
You are a senior financial analyst writing a formal monthly financial report in Indian Rupees.

Report Period: ${d.reportMonth}

Key Metrics:
  Total Income:        ₹${d.totalIncome}
  Total Expenses:      ₹${d.totalExpense}
  Net Savings:         ₹${d.netSavings} (${d.savingsRate}% rate)
  Budget Limit:        ₹${d.totalBudget}
  Budget Used:         ₹${d.budgetUsed}  Budget Remaining: ₹${d.budgetLeft}
  Transactions:        ${d.transactionCount}
  Daily Avg Spend:     ₹${d.dailyAvgSpend}
  vs Previous Month:   Income ${d.incomeChange > 0 ? '+' : ''}${d.incomeChange}%,
                       Expenses ${d.expenseChange > 0 ? '+' : ''}${d.expenseChange}%
  Category Breakdown:  ${JSON.stringify(d.categoryBreakdown)}
  Income Sources:      ${JSON.stringify(d.incomeSources)}
${latestPred ? `  Next Month Prediction: ₹${latestPred.predictedExpense} (${latestPred.confidence}% confidence)` : ''}

Return ONLY valid JSON:
{
  "reportTitle":      "Financial Report — ${d.reportMonth}",
  "generatedAt":      "<ISO 8601>",
  "executiveSummary": "<4-5 sentence professional summary>",
  "performanceScore": <integer 0-100>,
  "performanceGrade": <"Excellent"|"Good"|"Average"|"Below Average"|"Poor">,
  "highlights": [
    { "type": <"achievement"|"concern"|"insight">, "title": "<short>", "description": "<1 sentence>" }
  ],
  "incomeAnalysis": {
    "summary": "<2-sentence analysis>",
    "sources": [{ "name": "<source>", "amount": <number>, "percentage": <number> }]
  },
  "expenseAnalysis": {
    "summary": "<2-sentence analysis>",
    "topCategories": [{ "category": "<name>", "amount": <number>, "percentage": <number>, "vs_budget": "<over budget|under budget|on track>" }]
  },
  "budgetAnalysis": {
    "summary": "<2-sentence budget adherence analysis>",
    "utilized": <integer 0-100>,
    "status": <"under_budget"|"on_track"|"over_budget">,
    "recommendations": ["<rec 1>", "<rec 2>"]
  },
  "predictionAnalysis": {
    "nextMonthForecast": <number or null>,
    "confidence": <number or null>,
    "trend": "<increasing|decreasing|stable or null>",
    "summary": "<1-sentence forward-looking comment>"
  },
  "goalsAndRecommendations": {
    "nextMonthGoals":  ["<goal 1>", "<goal 2>", "<goal 3>"],
    "actionItems":     ["<action 1>", "<action 2>", "<action 3>"],
    "longTermAdvice":  "<2-sentence wealth-building advice>"
  },
  "motivationalMessage": "<personalised closing message>"
}`;

        const aiReport = await gemini.generateJSON(prompt);
        const result   = { ...aiReport, rawData: d };

        cache.set(cacheKey, result, TTL);
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — PDF Generation
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Renders the report JSON into a PDF and returns it as a Buffer.
     * Uses pdfkit for pure-Node.js PDF generation (no browser dependency).
     *
     * @param   {Object} report — output of generateNarrative()
     * @returns {Promise<Buffer>}
     */
    generatePDF(report) {
        return new Promise((resolve, reject) => {
            const doc    = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data',  chunk => chunks.push(chunk));
            doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            this._renderPDF(doc, report);
            doc.end();
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — PDF Renderer
    // ═══════════════════════════════════════════════════════════════════════════

    _renderPDF(doc, r) {
        const raw = r.rawData || {};
        const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

        // ── Cover ─────────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 130).fill(COLORS.primary);
        doc.fillColor('white')
           .fontSize(22).font('Helvetica-Bold').text('FinGuide', 50, 40)
           .fontSize(12).font('Helvetica').text('AI Financial Report', 50, 68);
        doc.fontSize(16).font('Helvetica-Bold').text(r.reportTitle || '', 50, 95);

        // Performance badge
        const score = r.performanceScore || 0;
        doc.rect(doc.page.width - 110, 40, 80, 80).fill('rgba(255,255,255,0.15)');
        doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
           .text(String(score), doc.page.width - 100, 52, { width: 60, align: 'center' });
        doc.fontSize(9).text(r.performanceGrade || '', doc.page.width - 100, 85, { width: 60, align: 'center' });

        doc.y = 155;
        doc.fillColor(COLORS.dark);

        // ── Key Metrics bar ───────────────────────────────────────────────────
        this._sectionTitle(doc, 'Financial Summary');
        this._metricTable(doc, [
            ['Total Income',    fmt(raw.totalIncome),   'Total Expenses',   fmt(raw.totalExpense)],
            ['Net Savings',     fmt(raw.netSavings),    'Savings Rate',     `${raw.savingsRate || 0}%`],
            ['Budget Limit',    fmt(raw.totalBudget),   'Budget Used',      fmt(raw.budgetUsed)],
            ['Daily Avg Spend', fmt(raw.dailyAvgSpend), 'Transactions',     String(raw.transactionCount || 0)],
        ]);

        // ── Executive Summary ─────────────────────────────────────────────────
        this._sectionTitle(doc, '1. Executive Summary');
        this._body(doc, r.executiveSummary);

        // ── Income Analysis ───────────────────────────────────────────────────
        this._sectionTitle(doc, '2. Income Analysis');
        this._body(doc, r.incomeAnalysis?.summary);
        if (r.incomeAnalysis?.sources?.length) {
            r.incomeAnalysis.sources.forEach(s => {
                this._keyValue(doc, s.name, `${fmt(s.amount)}  (${s.percentage}%)`);
            });
        }

        // ── Expense Analysis ──────────────────────────────────────────────────
        this._sectionTitle(doc, '3. Expense Analysis');
        this._body(doc, r.expenseAnalysis?.summary);
        if (r.expenseAnalysis?.topCategories?.length) {
            r.expenseAnalysis.topCategories.forEach(c => {
                this._keyValue(doc, c.category, `${fmt(c.amount)}  ${c.vs_budget || ''}`);
            });
        }

        // ── Budget Analysis ───────────────────────────────────────────────────
        this._sectionTitle(doc, '4. Budget Analysis');
        this._body(doc, r.budgetAnalysis?.summary);
        const utilized = r.budgetAnalysis?.utilized ?? r.budgetPerformance?.utilized ?? 0;
        this._progressBar(doc, utilized, r.budgetAnalysis?.status ?? r.budgetPerformance?.status);

        // ── Prediction Analysis ───────────────────────────────────────────────
        this._sectionTitle(doc, '5. Prediction Analysis');
        if (r.predictionAnalysis) {
            const p = r.predictionAnalysis;
            if (p.nextMonthForecast) {
                this._keyValue(doc, 'Next Month Forecast', fmt(p.nextMonthForecast));
            }
            if (p.confidence != null) {
                this._keyValue(doc, 'Confidence', `${p.confidence}%`);
            }
            this._body(doc, p.summary);
        } else {
            this._body(doc, 'No prediction data available for this period.');
        }

        // ── Recommendations ───────────────────────────────────────────────────
        this._sectionTitle(doc, '6. Recommendations');
        const goals   = r.goalsAndRecommendations?.nextMonthGoals   || [];
        const actions = r.goalsAndRecommendations?.actionItems       || [];
        if (goals.length) {
            doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica-Bold').text('Next Month Goals', { continued: false });
            goals.forEach((g, i) => this._bullet(doc, `${i + 1}. ${g}`));
        }
        if (actions.length) {
            doc.moveDown(0.4).fontSize(9).fillColor(COLORS.muted).font('Helvetica-Bold').text('Action Items');
            actions.forEach(a => this._bullet(doc, `✓ ${a}`));
        }
        if (r.goalsAndRecommendations?.longTermAdvice) {
            doc.moveDown(0.4);
            this._body(doc, r.goalsAndRecommendations.longTermAdvice);
        }

        // ── Closing ───────────────────────────────────────────────────────────
        if (r.motivationalMessage) {
            doc.moveDown(0.8)
               .rect(50, doc.y, doc.page.width - 100, 50).fill('#f3f0ff')
               .fillColor(COLORS.primary).fontSize(10).font('Helvetica-Oblique')
               .text(r.motivationalMessage, 60, doc.y - 40, { width: doc.page.width - 120 });
        }

        // Footer
        doc.fillColor(COLORS.muted).fontSize(8)
           .text(`Generated by FinGuide AI  •  ${new Date().toLocaleString('en-IN')}`,
               50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
    }

    // ── PDF Layout Helpers ────────────────────────────────────────────────────

    _sectionTitle(doc, title) {
        doc.moveDown(0.6)
           .rect(50, doc.y, doc.page.width - 100, 1).fill(COLORS.border)
           .moveDown(0.15)
           .fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
           .text(title)
           .moveDown(0.25)
           .fillColor(COLORS.dark);
    }

    _body(doc, text) {
        if (!text) return;
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark).text(text, { lineGap: 3 }).moveDown(0.4);
    }

    _bullet(doc, text) {
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
           .text(text, { indent: 12, lineGap: 2 });
    }

    _keyValue(doc, label, value) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text(label, { continued: true })
           .font('Helvetica').fillColor(COLORS.dark).text(`   ${value}`);
    }

    _metricTable(doc, rows) {
        const colW = (doc.page.width - 100) / 2;
        rows.forEach(([l1, v1, l2, v2]) => {
            const y = doc.y;
            doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
               .text(l1, 50, y, { width: colW / 2 })
               .font('Helvetica-Bold').fillColor(COLORS.dark)
               .text(v1, 50 + colW / 2, y, { width: colW / 2 })
               .font('Helvetica').fillColor(COLORS.muted)
               .text(l2, 50 + colW, y, { width: colW / 2 })
               .font('Helvetica-Bold').fillColor(COLORS.dark)
               .text(v2, 50 + colW + colW / 2, y, { width: colW / 2 });
            doc.y = y + 16;
        });
        doc.moveDown(0.5);
    }

    _progressBar(doc, pct, status) {
        const x = 50, y = doc.y, w = doc.page.width - 100, h = 10;
        const color = status === 'over_budget' ? COLORS.danger
            : status === 'on_track'             ? '#f59e0b'
            : COLORS.success;
        doc.rect(x, y, w, h).fill(COLORS.border);
        doc.rect(x, y, Math.min(w, (pct / 100) * w), h).fill(color);
        doc.fillColor(COLORS.muted).fontSize(8)
           .text(`${pct}% utilized  •  ${(status || '').replace('_', ' ')}`, x, y + 14);
        doc.y = y + 30;
    }
}

module.exports = new ReportAgent();
