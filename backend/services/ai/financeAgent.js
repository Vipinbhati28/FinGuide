'use strict';

/**
 * financeAgent — Unified AI orchestrator for all FinGuide features.
 *
 * Every AI-powered endpoint routes through here. No other file makes
 * direct calls to openRouterService.
 *
 * Public API (mirrors FinanceAgentCoordinator for drop-in replacement):
 *   healthScore(userId)
 *   algorithmicHealthScore(data)
 *   generateBudgetAdvice(userId)
 *   analyzeSpendingPatterns(userId)
 *   predictExpenses(userId)
 *   rawPrediction(userId)
 *   predictionHistory(userId)
 *   financialChat(userId, message, history, systemContext)
 *   processVoiceCommand(userId, transcript)
 *   generateMonthlyReport(userId, year, month)
 *   generateMonthlyReportPDF(userId, year, month)
 *   runAllAnalysis(userId)
 *   invalidateUser(userId)
 */

const PDFDocument = require('pdfkit');

const openRouter         = require('./openRouterService');
const aiCache            = require('./aiCache');
const prompts            = require('./promptBuilder');
const financeDataService = require('../financeDataService');
const healthScoreService = require('../healthScoreService');
const predictionService  = require('../predictionService');
const PredictionHistory  = require('../../models/PredictionHistory');

// Cache TTLs (ms)
const TTL = {
    CTX:        2  * 60 * 1000,
    HEALTH:     30 * 60 * 1000,
    BUDGET:     30 * 60 * 1000,
    SPENDING:   60 * 60 * 1000,
    PREDICTION: 60 * 60 * 1000,
    REPORT:      2 * 60 * 60 * 1000,
};

// PDF colour palette
const C = {
    primary: '#875cf5',
    dark:    '#1f2937',
    muted:   '#6b7280',
    border:  '#e5e7eb',
    success: '#059669',
    danger:  '#dc2626',
    warn:    '#f59e0b',
    accent:  '#f3f0ff',
};

// ── Helper ─────────────────────────────────────────────────────────────────────

function aiError(msg) {
    const err = new Error(msg);
    err.isAIServiceError = true;
    return err;
}

// ── Main class ────────────────────────────────────────────────────────────────

class FinanceAgent {

    // ── Context ────────────────────────────────────────────────────────────────

    async _getContext(userId) {
        if (!userId) throw new Error('userId is required');
        const key    = `ctx:${userId}`;
        const cached = aiCache.get(key);
        if (cached) return cached;
        const data = await financeDataService.getUserFinancialData(userId);
        aiCache.set(key, data, TTL.CTX);
        return data;
    }

    invalidateUser(userId) {
        aiCache.invalidateUser(userId);
    }

    // ── Health Score ───────────────────────────────────────────────────────────

    algorithmicHealthScore(data) {
        return healthScoreService.calculateScoreFromData(data);
    }

    async healthScore(userId) {
        const key    = `health:${userId}`;
        const cached = aiCache.get(key);
        if (cached) return cached;

        const data = await this._getContext(userId);
        const base = this.algorithmicHealthScore(data);

        try {
            const ai = await openRouter.chatJSON(prompts.healthScore(base, data));
            // Always trust the algorithmic numbers; AI provides narrative only
            const result = {
                ...ai,
                score:           base.score,
                grade:           base.grade,
                breakdown:       base.breakdown,
                strengths:       base.strengths,
                weaknesses:      base.weaknesses,
                recommendations: base.recommendations,
            };
            aiCache.set(key, result, TTL.HEALTH);
            return result;
        } catch (err) {
            console.error(`[FinanceAgent:healthScore] AI failed for ${userId}: ${err.message}`);
            const fallback = { ...base, summary: null, tips: base.recommendations, aiError: true };
            aiCache.set(key, fallback, 60_000); // 1-min TTL so it retries sooner
            return fallback;
        }
    }

    // ── Budget Recommendation ──────────────────────────────────────────────────

    async generateBudgetAdvice(userId) {
        const key    = `budget:${userId}`;
        const cached = aiCache.get(key);
        if (cached) return cached;

        const data = await this._getContext(userId);

        try {
            const result = await openRouter.chatJSON(prompts.budgetRecommendation(data));
            aiCache.set(key, result, TTL.BUDGET);
            return result;
        } catch (err) {
            console.error(`[FinanceAgent:budgetAdvice] AI failed for ${userId}: ${err.message}`);
            throw aiError('AI budget recommendation unavailable. Please try again in a moment.');
        }
    }

    // ── Spending Analysis ──────────────────────────────────────────────────────

    async analyzeSpendingPatterns(userId) {
        const key    = `spending:${userId}`;
        const cached = aiCache.get(key);
        if (cached) return cached;

        const data = await this._getContext(userId);

        try {
            const result = await openRouter.chatJSON(prompts.spendingAnalysis(data));
            aiCache.set(key, result, TTL.SPENDING);
            return result;
        } catch (err) {
            console.error(`[FinanceAgent:spending] AI failed for ${userId}: ${err.message}`);
            throw aiError('AI spending analysis unavailable. Please try again in a moment.');
        }
    }

    // ── Expense Prediction ─────────────────────────────────────────────────────

    async predictExpenses(userId) {
        const key    = `prediction:${userId}`;
        const cached = aiCache.get(key);
        if (cached) return cached;

        const [pred, data] = await Promise.all([
            predictionService.generatePrediction(userId),
            this._getContext(userId),
        ]);

        let narrative = { summary: null, riskFactors: [], savingOpportunities: [], confidenceExplanation: null };
        try {
            narrative = await openRouter.chatJSON(prompts.expensePrediction(pred, data));
        } catch (err) {
            console.error(`[FinanceAgent:prediction] AI narrative failed for ${userId}: ${err.message}`);
        }

        const result = { ...pred, ...narrative };
        aiCache.set(key, result, TTL.PREDICTION);
        return result;
    }

    async rawPrediction(userId) {
        return predictionService.generatePrediction(userId);
    }

    async predictionHistory(userId) {
        return predictionService.getHistory(userId);
    }

    // ── Financial Chat ─────────────────────────────────────────────────────────

    async financialChat(userId, message, history = [], systemContext = null) {
        let sysPrompt = systemContext;

        if (!sysPrompt) {
            const d = await this._getContext(userId);
            sysPrompt = `You are FinGuide AI, a knowledgeable personal financial advisor.

User's Live Financial Snapshot:
  Net Balance:       Rs.${(d.totalIncome || 0) - (d.totalExpense || 0)}
  Monthly Income:    Rs.${d.monthlyIncome || 0}
  Monthly Expenses:  Rs.${d.monthlyExpense || 0}
  Savings Rate:      ${d.savingsRate || 0}%
  Top Categories:    ${(d.topCategories || []).join(', ')}
  Budget Remaining:  Rs.${d.budgetLeft || 0} of Rs.${d.totalBudget || 0}

Advisor Rules:
  - Reference the user's actual numbers when relevant.
  - Be concise: 2-4 paragraphs maximum per response.
  - Use Rs. for all currency amounts.
  - For investment or stock advice, recommend a SEBI-registered financial advisor.
  - Be encouraging but honest about overspending.`;
        }

        const messages = [
            { role: 'system', content: sysPrompt },
            ...history.map(m => ({
                role:    m.role === 'model' ? 'assistant' : m.role,
                content: m.content,
            })),
            { role: 'user', content: message },
        ];

        try {
            const reply = await openRouter.chat(messages);
            return { reply, timestamp: new Date().toISOString() };
        } catch (err) {
            console.error(`[FinanceAgent:chat] AI failed for ${userId}: ${err.message}`);
            return {
                reply:     "I'm having trouble connecting to the AI service right now. Please try again in a moment.",
                timestamp: new Date().toISOString(),
            };
        }
    }

    // ── Voice Command ──────────────────────────────────────────────────────────

    async processVoiceCommand(userId, transcript) {
        const data = await this._getContext(userId);

        try {
            return await openRouter.chatJSON(prompts.voiceCommand(transcript, data));
        } catch (err) {
            console.error(`[FinanceAgent:voice] AI failed for ${userId}: ${err.message}`);
            return {
                intent:   'general',
                response: "I'm having trouble connecting to the AI service right now. Please try again.",
                data:     { amount: null, category: null, timeframe: null },
                action:   { type: 'none', route: null, payload: null },
            };
        }
    }

    // ── Monthly Report ─────────────────────────────────────────────────────────

    async generateMonthlyReport(userId, year, month) {
        const key    = `report:${userId}:${year}:${month}`;
        const cached = aiCache.get(key);
        if (cached) return cached;

        const [d, latestPred] = await Promise.all([
            financeDataService.getMonthlyReportData(userId, year, month),
            PredictionHistory.findOne({ userId }).sort({ createdAt: -1 }).lean().catch(() => null),
        ]);

        if (!d || d.transactionCount === 0) {
            throw new Error('No transactions found for this period.');
        }

        const aiReport = await openRouter.chatJSON(prompts.monthlyReport(d, latestPred));
        const result   = { ...aiReport, rawData: d };

        aiCache.set(key, result, TTL.REPORT);
        return result;
    }

    async generateMonthlyReportPDF(userId, year, month) {
        const report = await this.generateMonthlyReport(userId, year, month);
        const pdf    = await this._buildPDF(report);
        return { pdf, report };
    }

    // ── Run All (parallel dashboard load) ────────────────────────────────────

    async runAllAnalysis(userId) {
        await this._getContext(userId); // warm the ctx cache once for all sub-calls
        const [hRes, bRes, sRes, pRes] = await Promise.allSettled([
            this.healthScore(userId),
            this.generateBudgetAdvice(userId),
            this.analyzeSpendingPatterns(userId),
            this.predictExpenses(userId),
        ]);
        const unwrap = s => s.status === 'fulfilled'
            ? { data: s.value,  error: null }
            : { data: null,     error: s.reason?.message };
        return {
            healthScore:      unwrap(hRes),
            budgetAdvice:     unwrap(bRes),
            spendingAnalysis: unwrap(sRes),
            prediction:       unwrap(pRes),
        };
    }

    // ── PDF Builder ───────────────────────────────────────────────────────────

    _buildPDF(report) {
        return new Promise((resolve, reject) => {
            const doc    = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];
            doc.on('data',  c  => chunks.push(c));
            doc.on('end',   () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            this._renderPDF(doc, report);
            doc.end();
        });
    }

    _renderPDF(doc, r) {
        const raw = r.rawData || {};
        const fmt = n => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
        const W   = doc.page.width;

        // ── Cover band ──
        doc.rect(0, 0, W, 130).fill(C.primary);
        doc.fillColor('white')
           .fontSize(22).font('Helvetica-Bold').text('FinGuide', 50, 40)
           .fontSize(12).font('Helvetica').text('AI Financial Report', 50, 68);
        doc.fontSize(16).font('Helvetica-Bold').text(r.reportTitle || '', 50, 95);

        // Score badge
        const score = r.performanceScore || 0;
        doc.rect(W - 110, 40, 80, 80).fill('rgba(255,255,255,0.15)');
        doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
           .text(String(score), W - 100, 52, { width: 60, align: 'center' });
        doc.fontSize(9).font('Helvetica')
           .text(r.performanceGrade || '', W - 100, 84, { width: 60, align: 'center' });

        doc.y = 155;
        doc.fillColor(C.dark);

        // ── Metrics table ──
        this._sectionTitle(doc, 'Financial Summary');
        this._metricTable(doc, [
            ['Total Income',    fmt(raw.totalIncome),   'Total Expenses',  fmt(raw.totalExpense)],
            ['Net Savings',     fmt(raw.netSavings),    'Savings Rate',    `${raw.savingsRate || 0}%`],
            ['Budget Limit',    fmt(raw.totalBudget),   'Budget Used',     fmt(raw.budgetUsed)],
            ['Daily Avg Spend', fmt(raw.dailyAvgSpend), 'Transactions',    String(raw.transactionCount || 0)],
        ]);

        // ── Sections ──
        this._sectionTitle(doc, '1. Executive Summary');
        this._body(doc, r.executiveSummary);

        this._sectionTitle(doc, '2. Income Analysis');
        this._body(doc, r.incomeAnalysis?.summary);
        (r.incomeAnalysis?.sources || []).forEach(s =>
            this._keyValue(doc, s.name, `${fmt(s.amount)}  (${s.percentage}%)`));

        this._sectionTitle(doc, '3. Expense Analysis');
        this._body(doc, r.expenseAnalysis?.summary);
        (r.expenseAnalysis?.topCategories || []).forEach(c =>
            this._keyValue(doc, c.category, `${fmt(c.amount)}  ${c.vs_budget || ''}`));

        this._sectionTitle(doc, '4. Budget Analysis');
        this._body(doc, r.budgetAnalysis?.summary);
        const utilized = r.budgetAnalysis?.utilized ?? 0;
        this._progressBar(doc, utilized, r.budgetAnalysis?.status);

        this._sectionTitle(doc, '5. Prediction Analysis');
        if (r.predictionAnalysis?.summary) {
            const p = r.predictionAnalysis;
            if (p.nextMonthForecast) this._keyValue(doc, 'Next Month Forecast', fmt(p.nextMonthForecast));
            if (p.confidence != null) this._keyValue(doc, 'Confidence',          `${p.confidence}%`);
            this._body(doc, p.summary);
        } else {
            this._body(doc, 'No prediction data available for this period.');
        }

        this._sectionTitle(doc, '6. Recommendations');
        const goals   = r.goalsAndRecommendations?.nextMonthGoals || [];
        const actions = r.goalsAndRecommendations?.actionItems    || [];
        if (goals.length) {
            doc.fontSize(9).fillColor(C.muted).font('Helvetica-Bold').text('Next Month Goals');
            goals.forEach((g, i) => this._bullet(doc, `${i + 1}. ${g}`));
        }
        if (actions.length) {
            doc.moveDown(0.4).fontSize(9).fillColor(C.muted).font('Helvetica-Bold').text('Action Items');
            actions.forEach(a => this._bullet(doc, `✓ ${a}`));
        }
        if (r.goalsAndRecommendations?.longTermAdvice) {
            doc.moveDown(0.4);
            this._body(doc, r.goalsAndRecommendations.longTermAdvice);
        }

        // ── Motivational footer ──
        if (r.motivationalMessage) {
            doc.moveDown(0.8)
               .rect(50, doc.y, W - 100, 52).fill(C.accent)
               .fillColor(C.primary).fontSize(10).font('Helvetica-Oblique')
               .text(r.motivationalMessage, 62, doc.y - 40, { width: W - 124 });
        }

        // ── Page footer ──
        doc.fillColor(C.muted).fontSize(8)
           .text(
               `Generated by FinGuide AI  •  ${new Date().toLocaleString('en-IN')}`,
               50, doc.page.height - 40,
               { align: 'center', width: W - 100 }
           );
    }

    // ── PDF helpers ───────────────────────────────────────────────────────────

    _sectionTitle(doc, title) {
        doc.moveDown(0.6)
           .rect(50, doc.y, doc.page.width - 100, 1).fill(C.border)
           .moveDown(0.15)
           .fontSize(11).font('Helvetica-Bold').fillColor(C.primary).text(title)
           .moveDown(0.25).fillColor(C.dark);
    }

    _body(doc, text) {
        if (!text) return;
        doc.fontSize(9).font('Helvetica').fillColor(C.dark)
           .text(String(text), { lineGap: 3 }).moveDown(0.4);
    }

    _bullet(doc, text) {
        doc.fontSize(9).font('Helvetica').fillColor(C.dark)
           .text(String(text), { indent: 12, lineGap: 2 });
    }

    _keyValue(doc, label, value) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.muted).text(String(label), { continued: true })
           .font('Helvetica').fillColor(C.dark).text(`   ${value}`);
    }

    _metricTable(doc, rows) {
        const colW = (doc.page.width - 100) / 2;
        rows.forEach(([l1, v1, l2, v2]) => {
            const y = doc.y;
            doc.fontSize(8).font('Helvetica').fillColor(C.muted)
               .text(l1,  50,               y, { width: colW / 2 })
               .font('Helvetica-Bold').fillColor(C.dark)
               .text(v1,  50 + colW / 2,    y, { width: colW / 2 })
               .font('Helvetica').fillColor(C.muted)
               .text(l2,  50 + colW,         y, { width: colW / 2 })
               .font('Helvetica-Bold').fillColor(C.dark)
               .text(v2,  50 + colW * 1.5,   y, { width: colW / 2 });
            doc.y = y + 16;
        });
        doc.moveDown(0.5);
    }

    _progressBar(doc, pct, status) {
        const x = 50, y = doc.y, w = doc.page.width - 100, h = 10;
        const color = status === 'over_budget' ? C.danger
            : status === 'on_track'            ? C.warn
            : C.success;
        doc.rect(x, y, w, h).fill(C.border);
        doc.rect(x, y, Math.min(w, (Math.min(pct, 100) / 100) * w), h).fill(color);
        doc.fillColor(C.muted).fontSize(8)
           .text(`${pct}% utilized  •  ${(status || '').replace('_', ' ')}`, x, y + 14);
        doc.y = y + 30;
    }
}

module.exports = new FinanceAgent();
