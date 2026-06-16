/**
 * financeDataService — Pure data aggregation layer.
 *
 * Responsibility: Query the existing MongoDB collections (Income, Expense, Budget)
 * and return structured, AI-ready payloads. Zero AI logic lives here.
 *
 * Consumed exclusively by FinanceAgent via its _loadData() and
 * generateMonthlyReport() methods. Nothing else should import this directly.
 *
 * Collection dependency map:
 *   Income  → getUserFinancialData(), getMonthlyReportData()
 *   Expense → getUserFinancialData(), getMonthlyReportData(), _getMonthlyTrends(), _getCategoryHistory()
 *   Budget  → getUserFinancialData(), getMonthlyReportData()
 *
 * No new collections are created. All queries use indexes on userId and date.
 */

'use strict';

const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const { Types } = require('mongoose');
const moment = require('moment');

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/** Returns a Date `n` days before now. */
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// ─── FinanceDataService ────────────────────────────────────────────────────────

class FinanceDataService {

    // ═══════════════════════════════════════════════════════════════════════════
    // Rolling snapshot — used by all analysis features (Health, Budget, Spending, Prediction)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Aggregates a comprehensive financial snapshot for `userId`.
     *
     * All date windows are rolling (relative to now), not calendar-month:
     *   30-day  → recent income/expenses, active budgets, category breakdown
     *   60-day  → prev-month window for MoM change calculation
     *   90-day  → category history for expense prediction
     *  180-day  → monthly trend series for spending pattern analysis
     *
     * Runs parallel DB queries with Promise.all to minimise latency.
     *
     * @param   {string} userId
     * @returns {Promise<Object>} flat snapshot object — see return statement for field list
     */
    async getUserFinancialData(userId) {
        // MongoDB requires ObjectId for $match in aggregation pipelines
        const userObjectId = new Types.ObjectId(String(userId));

        const now = new Date();
        const since30  = daysAgo(30);
        const since60  = daysAgo(60);
        const since90  = daysAgo(90);
        const since180 = daysAgo(180);

        // ── Parallel Queries ─────────────────────────────────────────────────
        const [
            allIncomes,
            allExpenses,
            activeBudgets,
            last30Expenses,
            last30Income,
        ] = await Promise.all([
            // All-time totals (needed for net savings and source diversity)
            Income.find({ userId }).lean(),
            Expense.find({ userId }).lean(),

            // Active budgets: started before now and haven't ended yet
            Budget.find({
                userId,
                startDate: { $lte: now },
                endDate:   { $gte: now },
            }).lean(),

            // Recent expenses and income for the 30-day window
            Expense.find({ userId, date: { $gte: since30 } }).lean(),
            Income.find({  userId, date: { $gte: since30 } }).lean(),
        ]);

        // ── All-Time Aggregates ───────────────────────────────────────────────

        const totalIncome  = allIncomes.reduce((s, i) => s + i.amount, 0);
        const totalExpense = allExpenses.reduce((s, e) => s + e.amount, 0);
        const netSavings   = totalIncome - totalExpense;

        // Savings rate as a percentage of total income (0 when no income)
        const savingsRate  = totalIncome > 0
            ? Math.round((netSavings / totalIncome) * 100)
            : 0;

        // ── 30-Day Aggregates ─────────────────────────────────────────────────

        const monthlyIncome  = last30Income.reduce((s, i) => s + i.amount, 0);
        const monthlyExpense = last30Expenses.reduce((s, e) => s + e.amount, 0);

        // ── Budget Metrics ────────────────────────────────────────────────────

        const totalBudget      = activeBudgets.reduce((s, b) => s + b.amount, 0);
        const budgetUsed       = monthlyExpense;   // spending against the active budget
        const budgetLeft       = totalBudget - budgetUsed;
        const budgetUtilization = totalBudget > 0
            ? Math.round((budgetUsed / totalBudget) * 100)
            : 0;

        // ── Category Breakdown (last 30 days) ─────────────────────────────────
        // Groups expenses by category and sorts descending by total spent.
        const categoryMap = {};
        last30Expenses.forEach(e => {
            categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
        });
        const categoryBreakdown = Object.entries(categoryMap)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);

        // ── Income Source Breakdown ───────────────────────────────────────────
        const sourceMap = {};
        allIncomes.forEach(i => {
            sourceMap[i.source] = (sourceMap[i.source] || 0) + i.amount;
        });
        const incomeSources = Object.entries(sourceMap)
            .map(([source, total]) => ({ source, total }))
            .sort((a, b) => b.total - a.total);

        // ── Month-over-Month Change ───────────────────────────────────────────
        // Compare last 30 days (monthlyExpense) against the 30 days before that.
        const prevMonthExpenses = allExpenses
            .filter(e => e.date >= since60 && e.date < since30)
            .reduce((s, e) => s + e.amount, 0);

        const momChange = prevMonthExpenses > 0
            ? Math.round(((monthlyExpense - prevMonthExpenses) / prevMonthExpenses) * 100)
            : 0;

        // ── Aggregation Pipeline Queries ──────────────────────────────────────
        // Run these after the parallel batch above since they depend on userObjectId.
        const [monthlyTrends, categoryHistory] = await Promise.all([
            this._getMonthlyTrends(userObjectId, since180),
            this._getCategoryHistory(userObjectId, since90),
        ]);

        // ── Derived Convenience Fields ────────────────────────────────────────

        // Top 3 categories by spend — used as a quick summary in prompts
        const topCategories = categoryBreakdown.slice(0, 3).map(c => c.category);

        return {
            // All-time totals
            totalIncome,
            totalExpense,
            netSavings,
            savingsRate,

            // 30-day window
            monthlyIncome,
            monthlyExpense,

            // Budget
            totalBudget,
            budgetUsed,
            budgetLeft,
            budgetUtilization,

            // Breakdowns
            categoryBreakdown,
            incomeSources,
            topCategories,
            incomeSourceCount: Object.keys(sourceMap).length,

            // Trend data for chart and AI prompts
            monthlyTrends,        // Array<{month, amount, changeFromPrev}>
            categoryHistory,      // Object<category, Array<{month, total}>>
            momChange,            // signed integer %

            // Aliases used by specific AI prompts (keeps prompts readable)
            avgMonthlyIncome:  monthlyIncome,      // rolling 30-day as proxy for monthly avg
            avgMonthlyExpense: monthlyExpense,
            currentBudget:     totalBudget,
            historicalMonthly: monthlyTrends,      // alias used by predictExpenses prompt
            lastMonthExpense:  monthlyExpense,

            // Misc stats
            transactionCount: last30Expenses.length + last30Income.length,
            dailyAvgSpend:    Math.round(monthlyExpense / 30),
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private — Monthly expense totals aggregated by year+month
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Aggregates total expenses per calendar month for the last 6 months.
     * Returns a Recharts-compatible array sorted chronologically.
     *
     * Uses MongoDB's $group aggregation (server-side grouping) rather than
     * fetching raw documents to avoid pulling thousands of records into memory.
     *
     * @param   {Types.ObjectId} userObjectId
     * @param   {Date}           since  — start of the 6-month window
     * @returns {Promise<Array<{month: string, amount: number, changeFromPrev: number}>>}
     */
    async _getMonthlyTrends(userObjectId, since) {
        const rows = await Expense.aggregate([
            { $match: { userId: userObjectId, date: { $gte: since } } },
            {
                $group: {
                    _id:   { year: { $year: '$date' }, month: { $month: '$date' } },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        return rows.map((row, idx) => {
            const month = moment(`${row._id.year}-${row._id.month}`, 'YYYY-M').format('MMM YYYY');
            const prev  = rows[idx - 1];
            // changeFromPrev: positive means spending went up vs. the previous month
            const changeFromPrev = prev
                ? Math.round(((row.total - prev.total) / prev.total) * 100)
                : 0;
            return { month, amount: row.total, changeFromPrev };
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private — Per-category monthly totals (for expense prediction)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Aggregates per-category expense totals for each month in the last 3 months.
     * Returns a pivot table: { category: [{month, total}, ...] }
     *
     * Used by predictExpenses() to feed category-level trend data into the Gemini prompt.
     *
     * @param   {Types.ObjectId} userObjectId
     * @param   {Date}           since  — start of the 3-month window
     * @returns {Promise<Object<string, Array<{month: string, total: number}>>>}
     */
    async _getCategoryHistory(userObjectId, since) {
        const rows = await Expense.aggregate([
            { $match: { userId: userObjectId, date: { $gte: since } } },
            {
                $group: {
                    _id:   {
                        year:     { $year: '$date' },
                        month:    { $month: '$date' },
                        category: '$category',
                    },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        // Pivot from flat rows to { category → [{month, total}] }
        const pivot = {};
        rows.forEach(row => {
            const month = moment(`${row._id.year}-${row._id.month}`, 'YYYY-M').format('MMM YYYY');
            const cat   = row._id.category;
            if (!pivot[cat]) pivot[cat] = [];
            pivot[cat].push({ month, total: row.total });
        });
        return pivot;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Calendar-month snapshot — used exclusively by generateMonthlyReport()
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Fetches a full financial snapshot scoped to a specific calendar month.
     *
     * Distinct from getUserFinancialData() which uses rolling 30-day windows.
     * This method uses strict calendar boundaries (first → last day of month)
     * to produce an accurate "month-in-review" report.
     *
     * Also fetches the previous calendar month for comparison metrics.
     *
     * @param   {string} userId
     * @param   {number} year   — e.g. 2024
     * @param   {number} month  — 1–12
     * @returns {Promise<Object>} month-scoped financial data
     */
    async getMonthlyReportData(userId, year, month) {
        const userObjectId = new Types.ObjectId(String(userId));

        // Strict calendar-month boundaries
        const startOfMonth = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
        const endOfMonth   = moment(`${year}-${month}`, 'YYYY-M').endOf('month').toDate();

        // Previous calendar month boundaries (for MoM comparison)
        const startOfPrev  = moment(startOfMonth).subtract(1, 'month').toDate();
        const endOfPrev    = moment(endOfMonth).subtract(1, 'month').toDate();

        // Run all queries in parallel
        const [
            monthIncomes,
            monthExpenses,
            prevIncomes,
            prevExpenses,
            budgets,
        ] = await Promise.all([
            Income.find({ userId, date: { $gte: startOfMonth, $lte: endOfMonth } }).lean(),
            Expense.find({ userId, date: { $gte: startOfMonth, $lte: endOfMonth } }).lean(),
            Income.find({ userId, date: { $gte: startOfPrev,  $lte: endOfPrev  } }).lean(),
            Expense.find({ userId, date: { $gte: startOfPrev,  $lte: endOfPrev  } }).lean(),
            // Budgets that overlap with the target month
            Budget.find({
                userId,
                startDate: { $lte: endOfMonth },
                endDate:   { $gte: startOfMonth },
            }).lean(),
        ]);

        // ── Current Month Metrics ─────────────────────────────────────────────

        const totalIncome  = monthIncomes.reduce((s, i) => s + i.amount, 0);
        const totalExpense = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const netSavings   = totalIncome - totalExpense;
        const savingsRate  = totalIncome > 0
            ? Math.round((netSavings / totalIncome) * 100)
            : 0;

        const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
        const budgetUsed  = totalExpense;
        const budgetLeft  = totalBudget - budgetUsed;

        // ── Previous Month Metrics (for comparison) ───────────────────────────

        const prevIncome  = prevIncomes.reduce((s, i) => s + i.amount, 0);
        const prevExpense = prevExpenses.reduce((s, e) => s + e.amount, 0);

        // % change vs previous month (0 when previous month has no data)
        const incomeChange  = prevIncome  > 0
            ? Math.round(((totalIncome  - prevIncome)  / prevIncome)  * 100)
            : 0;
        const expenseChange = prevExpense > 0
            ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100)
            : 0;

        // ── Category and Source Breakdowns ────────────────────────────────────

        const categoryMap = {};
        monthExpenses.forEach(e => {
            categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
        });
        const categoryBreakdown = Object.entries(categoryMap)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);

        const sourceMap = {};
        monthIncomes.forEach(i => {
            sourceMap[i.source] = (sourceMap[i.source] || 0) + i.amount;
        });
        const incomeSources = Object.entries(sourceMap)
            .map(([source, total]) => ({ source, total }));

        // daysInMonth handles February and leap years correctly
        const daysInMonth = moment(`${year}-${month}`, 'YYYY-M').daysInMonth();

        return {
            reportMonth:      moment(`${year}-${month}`, 'YYYY-M').format('MMMM YYYY'),
            totalIncome,
            totalExpense,
            netSavings,
            savingsRate,
            totalBudget,
            budgetUsed,
            budgetLeft,
            categoryBreakdown,
            incomeSources,
            incomeChange,
            expenseChange,
            transactionCount: monthIncomes.length + monthExpenses.length,
            dailyAvgSpend:    totalExpense > 0 ? Math.round(totalExpense / daysInMonth) : 0,
        };
    }
}

// Singleton — one instance shared across all FinanceAgent calls within the process.
module.exports = new FinanceDataService();
