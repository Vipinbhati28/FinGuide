/**
 * healthScoreService — Deterministic, algorithm-based financial health scoring.
 *
 * Computes a 0–100 score from five weighted dimensions using only arithmetic
 * on the user's real transaction data. No AI/Gemini calls are made here.
 * This makes the score fast (<100ms), consistent, and explainable.
 *
 * Score Dimensions (total = 100 pts):
 *  ┌─────────────────────────────────┬──────┐
 *  │ Savings Ratio                   │ 25pt │
 *  │ Spending Ratio                  │ 25pt │
 *  │ Budget Adherence                │ 25pt │
 *  │ Transaction Consistency         │ 15pt │
 *  │ Financial Growth Trend          │ 10pt │
 *  └─────────────────────────────────┴──────┘
 *
 * Grade thresholds:
 *   80–100 → Excellent
 *   60–79  → Good
 *   40–59  → Average
 *   0–39   → Poor
 *
 * The service is used:
 *  1. Directly by healthScoreController for the fast /api/v1/finance/health-score endpoint.
 *  2. By FinanceAgent.healthScore() as the deterministic base before adding AI narrative.
 *  3. By chatController to inject health score into chatbot context.
 */

'use strict';

const financeDataService = require('./financeDataService');

// ─── Grade thresholds ─────────────────────────────────────────────────────────
const GRADE = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Poor';
};

// ─── Linear regression helper (used for growth trend) ────────────────────────
/**
 * Fits y = mx + b to the given points and returns the slope (m).
 * @param {number[]} values — ordered list of monthly expense amounts
 * @returns {number} slope (positive = expenses growing, negative = shrinking)
 */
function linearRegressionSlope(values) {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    values.forEach((y, i) => {
        sumX  += i;
        sumY  += y;
        sumXY += i * y;
        sumX2 += i * i;
    });

    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

// ─── HealthScoreService ───────────────────────────────────────────────────────

class HealthScoreService {

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Main entry point
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Calculates the complete financial health score for `userId`.
     * Fetches financial data from financeDataService, applies the five scoring
     * functions, and assembles the result object.
     *
     * @param   {string} userId
     * @returns {Promise<HealthScoreResult>}
     */
    async calculateScore(userId) {
        const d = await financeDataService.getUserFinancialData(userId);
        return this.calculateScoreFromData(d);
    }

    /**
     * Same as calculateScore() but accepts pre-fetched financial data.
     * Use this inside FinanceAgent to avoid a duplicate DB roundtrip.
     *
     * @param   {Object} d — result of financeDataService.getUserFinancialData()
     * @returns {HealthScoreResult}
     */
    calculateScoreFromData(d) {
        // ── Compute each dimension ─────────────────────────────────────────────
        const dimensions = [
            this._scoreSavingsRatio(d.monthlyIncome, d.monthlyExpense),
            this._scoreSpendingRatio(d.monthlyIncome, d.monthlyExpense),
            this._scoreBudgetAdherence(d.totalBudget, d.monthlyExpense),
            this._scoreConsistency(d.monthlyTrends),
            this._scoreGrowthTrend(d.monthlyTrends),
        ];

        // ── Aggregate ─────────────────────────────────────────────────────────
        const totalScore = dimensions.reduce((sum, dim) => sum + dim.points, 0);
        const grade      = GRADE(totalScore);

        // ── Collect strengths / weaknesses / recommendations ──────────────────
        const strengths       = dimensions.flatMap(d => d.strengths       || []).filter(Boolean);
        const weaknesses      = dimensions.flatMap(d => d.weaknesses      || []).filter(Boolean);
        const recommendations = dimensions.flatMap(d => d.recommendations || []).filter(Boolean);

        return {
            score: totalScore,
            grade,
            breakdown: dimensions.map(({ key, label, points, max, pct }) => ({
                key,
                label,
                points,
                max,
                pct, // 0–100, used by the progress bar in the widget
            })),
            strengths:       strengths.slice(0, 4),
            weaknesses:      weaknesses.slice(0, 4),
            recommendations: recommendations.slice(0, 5),
            meta: {
                calculatedAt:   new Date().toISOString(),
                monthlyIncome:  d.monthlyIncome,
                monthlyExpense: d.monthlyExpense,
                savingsRate:    d.savingsRate,
                budgetLeft:     d.budgetLeft,
                totalBudget:    d.totalBudget,
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Dimension 1: Savings Ratio (25 pts)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Measures what fraction of monthly income is saved.
     * savings_rate = (income − expense) / income
     *
     * Thresholds:
     *   ≥ 30%  → 25 pts (excellent)
     *   20-29% → 20 pts
     *   10-19% → 15 pts
     *   5-9%   → 10 pts
     *   1-4%   →  5 pts
     *   ≤ 0%   →  0 pts (spending ≥ income)
     */
    _scoreSavingsRatio(income, expense) {
        const MAX = 25;
        const rate = income > 0 ? (income - expense) / income : -1;

        let points;
        if      (rate >= 0.30) points = 25;
        else if (rate >= 0.20) points = 20;
        else if (rate >= 0.10) points = 15;
        else if (rate >= 0.05) points = 10;
        else if (rate > 0)     points = 5;
        else                   points = 0;

        const pct     = Math.round((points / MAX) * 100);
        const ratePct = Math.round(rate * 100);

        return {
            key:   'savings',
            label: 'Savings Rate',
            points,
            max:   MAX,
            pct,
            strengths: points >= 20 ? [
                `Strong savings rate of ${ratePct}% — you are building wealth consistently.`,
            ] : [],
            weaknesses: points < 10 ? [
                rate <= 0
                    ? 'Expenses exceed income — you are spending more than you earn.'
                    : `Low savings rate of ${ratePct}% — most income is being consumed by expenses.`,
            ] : [],
            recommendations: points < 20 ? [
                rate <= 0
                    ? 'Immediately audit your expenses to find categories to cut — spending cannot exceed income.'
                    : rate < 0.05
                        ? 'Set up an automatic savings transfer of at least 5% of your income on every payday.'
                        : rate < 0.10
                            ? 'Target a 10% savings rate by reducing your highest discretionary spending category.'
                            : 'Push your savings rate above 20% by automating transfers and avoiding lifestyle inflation.',
            ] : [],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Dimension 2: Spending Ratio (25 pts)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Measures what fraction of income is spent.
     * spending_ratio = expense / income
     *
     * A low spending ratio means more headroom for savings and investment.
     * Complement of savings ratio but scored independently to reward users
     * who have both low spending AND high income.
     *
     * Thresholds:
     *   ≤ 50%  → 25 pts
     *   51-65% → 20 pts
     *   66-75% → 15 pts
     *   76-85% → 10 pts
     *   86-95% →  5 pts
     *   > 95%  →  0 pts
     */
    _scoreSpendingRatio(income, expense) {
        const MAX   = 25;
        const ratio = income > 0 ? expense / income : 1;

        let points;
        if      (ratio <= 0.50) points = 25;
        else if (ratio <= 0.65) points = 20;
        else if (ratio <= 0.75) points = 15;
        else if (ratio <= 0.85) points = 10;
        else if (ratio <= 0.95) points = 5;
        else                    points = 0;

        const pct     = Math.round((points / MAX) * 100);
        const ratioPct = Math.round(ratio * 100);

        return {
            key:   'spending',
            label: 'Spending Ratio',
            points,
            max:   MAX,
            pct,
            strengths: points >= 20 ? [
                `Spending only ${ratioPct}% of income — excellent financial restraint.`,
            ] : [],
            weaknesses: points < 10 ? [
                `Spending ${ratioPct}% of income leaves very little margin for savings or emergencies.`,
            ] : [],
            recommendations: points < 20 ? [
                `Reduce spending from ${ratioPct}% of income toward 65% by reviewing your top 3 expense categories.`,
            ] : [],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Dimension 3: Budget Adherence (25 pts)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Measures how well the user stays within their set budget.
     * utilization = expense / budget
     *
     * No budget set → neutral score (12/25).
     *
     * Thresholds:
     *   ≤ 80%  → 25 pts (well under budget)
     *   81-90% → 20 pts
     *   91-100%→ 15 pts (at budget)
     *   101-115%→ 8 pts (slightly over)
     *   116-130%→ 4 pts (over budget)
     *   > 130% →  0 pts (way over)
     */
    _scoreBudgetAdherence(totalBudget, monthlyExpense) {
        const MAX = 25;

        if (totalBudget === 0) {
            return {
                key:   'budget',
                label: 'Budget Adherence',
                points: 12,
                max:    MAX,
                pct:    48,
                strengths:       [],
                weaknesses:      ['No active budget set — budgeting is a key tool for financial control.'],
                recommendations: ['Create a monthly budget today. Start with your average monthly expense as the ceiling.'],
            };
        }

        const utilization = monthlyExpense / totalBudget;
        const utilizePct  = Math.round(utilization * 100);

        let points;
        if      (utilization <= 0.80) points = 25;
        else if (utilization <= 0.90) points = 20;
        else if (utilization <= 1.00) points = 15;
        else if (utilization <= 1.15) points = 8;
        else if (utilization <= 1.30) points = 4;
        else                          points = 0;

        const pct = Math.round((points / MAX) * 100);

        return {
            key:   'budget',
            label: 'Budget Adherence',
            points,
            max:   MAX,
            pct,
            strengths: points >= 20 ? [
                `Excellent budget discipline — only ${utilizePct}% of your budget was used.`,
            ] : [],
            weaknesses: points < 10 ? [
                utilization > 1
                    ? `Exceeded your budget by ${utilizePct - 100}% — spending discipline needs improvement.`
                    : `Budget utilization at ${utilizePct}% leaves little buffer for unexpected expenses.`,
            ] : [],
            recommendations: points < 20 ? [
                utilization > 1.15
                    ? 'Review your highest-spend categories and set stricter weekly sub-limits.'
                    : 'Track your spending weekly against your budget to avoid end-of-month overruns.',
            ] : [],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Dimension 4: Transaction Consistency (15 pts)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Measures how regularly the user records financial transactions.
     * Regular recording implies better financial awareness and control.
     *
     * Scored by counting how many of the last 6 months have expense data.
     * (Using monthlyTrends from the 6-month aggregation pipeline.)
     *
     * Thresholds:
     *   5–6 months → 15 pts
     *   4 months   → 10 pts
     *   3 months   →  7 pts
     *   2 months   →  4 pts
     *   0–1 month  →  1 pt
     */
    _scoreConsistency(monthlyTrends) {
        const MAX        = 15;
        const monthCount = monthlyTrends.length; // months with expense data in last 6m

        let points;
        if      (monthCount >= 5) points = 15;
        else if (monthCount >= 4) points = 10;
        else if (monthCount >= 3) points = 7;
        else if (monthCount >= 2) points = 4;
        else                      points = 1;

        const pct = Math.round((points / MAX) * 100);

        return {
            key:   'consistency',
            label: 'Transaction Consistency',
            points,
            max:   MAX,
            pct,
            strengths: points >= 10 ? [
                `Consistent financial tracking across ${monthCount} of the last 6 months.`,
            ] : [],
            weaknesses: points < 7 ? [
                `Only ${monthCount} month(s) of tracked data — inconsistent recording limits insight accuracy.`,
            ] : [],
            recommendations: points < 10 ? [
                'Record every income and expense entry within the same day it occurs for accurate tracking.',
            ] : [],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Dimension 5: Financial Growth Trend (10 pts)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Measures whether monthly expenses are trending down (positive = improving
     * financial health) or up (negative = deteriorating).
     *
     * Uses linear regression slope on the last 6 months of expense totals.
     * Slope is in ₹/month; thresholds are calibrated for typical Indian income levels.
     *
     * Thresholds (slope per month):
     *   ≤ -500  → 10 pts (expenses falling quickly)
     *   -500 to -100 → 8 pts
     *   -100 to +100 → 6 pts (stable)
     *   +100 to +500 → 3 pts (rising)
     *   > +500  →  0 pts (rising fast)
     */
    _scoreGrowthTrend(monthlyTrends) {
        const MAX = 10;

        if (monthlyTrends.length < 2) {
            return {
                key:   'growth',
                label: 'Financial Growth Trend',
                points: 5,
                max:    MAX,
                pct:    50,
                strengths:       [],
                weaknesses:      [],
                recommendations: ['Add at least 2 months of data to unlock the growth trend analysis.'],
            };
        }

        const values = monthlyTrends.map(m => m.amount);
        const slope  = linearRegressionSlope(values);

        let points;
        let trendLabel;
        if      (slope <= -500) { points = 10; trendLabel = 'falling rapidly'; }
        else if (slope < -100)  { points = 8;  trendLabel = 'falling';        }
        else if (slope <= 100)  { points = 6;  trendLabel = 'stable';         }
        else if (slope <= 500)  { points = 3;  trendLabel = 'rising';         }
        else                    { points = 0;  trendLabel = 'rising rapidly'; }

        const pct = Math.round((points / MAX) * 100);

        return {
            key:   'growth',
            label: 'Financial Growth Trend',
            points,
            max:   MAX,
            pct,
            strengths: points >= 8 ? [
                `Expenses are trending downward — your financial health is improving month-over-month.`,
            ] : [],
            weaknesses: points < 4 ? [
                `Monthly expenses are ${trendLabel} (₹${Math.abs(Math.round(slope))}/month increase). This trajectory will reduce savings.`,
            ] : [],
            recommendations: points < 6 ? [
                slope > 100
                    ? 'Identify which categories grew most this month and set a hard cap for next month.'
                    : 'Maintain your current spending discipline — stable trends are healthy.',
            ] : [],
        };
    }
}

module.exports = new HealthScoreService();
