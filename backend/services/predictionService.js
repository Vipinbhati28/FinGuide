/**
 * predictionService — Deterministic expense and savings prediction engine.
 *
 * Uses two statistical algorithms on historical transaction data:
 *
 *   1. Weighted Moving Average (WMA)
 *      Computes a weighted average of the last 3 monthly expense totals,
 *      giving higher weight to more recent months (weights: [1, 2, 3]).
 *      Reliable when data is limited (< 4 months).
 *
 *   2. Linear Regression (LR)
 *      Fits y = mx + b to the expense time series and extrapolates one month
 *      forward. Returns R² as a confidence indicator.
 *      More accurate with 4+ months of data.
 *
 *   3. Blended Prediction
 *      Final prediction = (1 − weight) × WMA + weight × LR
 *      where weight = min(dataMonths / 6, 1).
 *      This smoothly transitions from WMA-dominant (sparse data) to
 *      LR-dominant (rich data) as history accumulates.
 *
 * Persistence:
 *   - Each prediction is saved to PredictionHistory (one per user per month).
 *   - On each call, previously generated predictions whose forecast month has
 *     now passed are updated with actual transaction data, enabling
 *     "predicted vs actual" accuracy comparisons.
 *
 * No AI/Gemini calls are made here. This is pure mathematics.
 */

'use strict';

const moment             = require('moment');
const financeDataService = require('./financeDataService');
const PredictionHistory  = require('../models/PredictionHistory');
const Income             = require('../models/Income');
const Expense            = require('../models/Expense');
const { Types }          = require('mongoose');

// ─── Weighted Moving Average ──────────────────────────────────────────────────
/**
 * Computes a weighted moving average of the LAST `weights.length` values.
 * More recent values receive higher weights.
 *
 * @param {number[]} values  — ordered monthly amounts (oldest first)
 * @param {number[]} weights — weight per slot, same length (newest = last slot = highest)
 * @returns {number}
 */
function weightedMovingAverage(values, weights = [1, 2, 3]) {
    if (!values || values.length === 0) return 0;

    // Take the last N values where N = weights.length
    const slice       = values.slice(-weights.length);
    const usedWeights = weights.slice(-slice.length); // in case fewer values than weights

    const weightedSum = slice.reduce((sum, v, i) => sum + v * usedWeights[i], 0);
    const totalWeight = usedWeights.reduce((s, w) => s + w, 0);

    return weightedSum / totalWeight;
}

// ─── Linear Regression ───────────────────────────────────────────────────────
/**
 * Fits y = mx + b to the provided time series and evaluates R².
 *
 * x = 0, 1, 2, … (month index, oldest = 0)
 * y = monthly expense amount
 *
 * @param {number[]} values — ordered monthly expense amounts (oldest first)
 * @returns {{ slope: number, intercept: number, r2: number, nextValue: number }}
 */
function linearRegression(values) {
    const n = values.length;
    if (n < 2) {
        return { slope: 0, intercept: values[0] || 0, r2: 0, nextValue: values[0] || 0 };
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    values.forEach((y, x) => {
        sumX  += x;
        sumY  += y;
        sumXY += x * y;
        sumX2 += x * x;
    });

    const denom    = n * sumX2 - sumX * sumX;
    const slope    = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // R² = coefficient of determination
    const meanY  = sumY / n;
    const ssTot  = values.reduce((s, y) => s + Math.pow(y - meanY, 2), 0);
    const ssRes  = values.reduce((s, y, x) => {
        const predicted = slope * x + intercept;
        return s + Math.pow(y - predicted, 2);
    }, 0);
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

    // Predict the next data point (month index = n)
    const nextValue = slope * n + intercept;

    return { slope, intercept, r2, nextValue };
}

// ─── Trend label from slope ───────────────────────────────────────────────────
function trendFromSlope(slope) {
    if (slope >  500) return 'increasing';
    if (slope < -500) return 'decreasing';
    if (slope >  100) return 'increasing';
    if (slope < -100) return 'decreasing';
    return 'stable';
}

// ─── PredictionService ────────────────────────────────────────────────────────

class PredictionService {

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Generate (or return cached) prediction for next month
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Generates a prediction for next calendar month.
     *
     * Steps:
     *   1. Backfill actuals for any past predictions whose forecast month has passed.
     *   2. Check if a prediction already exists for next month; return it if fresh (<1hr).
     *   3. Fetch monthly trend data and run WMA + LR algorithms.
     *   4. Save the result to PredictionHistory and return it.
     *
     * @param   {string} userId
     * @returns {Promise<PredictionResult>}
     */
    async generatePrediction(userId) {
        // Step 1 — fill in actuals for past predictions before returning new data
        await this._backfillActuals(userId);

        // Step 2 — return cached prediction if it was generated within the last hour
        const forecastMonth = moment().add(1, 'month').startOf('month').toDate();
        const existing      = await PredictionHistory.findOne({ userId, forecastMonth });
        if (existing && moment().diff(moment(existing.createdAt), 'hours') < 1) {
            return this._formatResult(existing);
        }

        // Step 3 — compute prediction
        const d          = await financeDataService.getUserFinancialData(userId);
        const prediction = await this._compute(userId, d);

        // Step 4 — persist (upsert so we don't duplicate)
        const record = await PredictionHistory.findOneAndUpdate(
            { userId, forecastMonth },
            {
                $set: {
                    predictedExpense:    prediction.predictedExpense,
                    predictedSavings:    prediction.predictedSavings,
                    categoryPredictions: prediction.categoryPredictions,
                    algorithm:           prediction.algorithm,
                    confidence:          prediction.confidence,
                    trend:               prediction.trend,
                    dataMonths:          prediction.dataMonths,
                    actualExpense:       null, // not yet known
                    actualSavings:       null,
                    accuracyPercent:     null,
                },
            },
            { upsert: true, new: true }
        );

        return this._formatResult(record, prediction);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Fetch prediction history (for chart)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Returns the last 6 months of prediction history, including actuals where
     * available, sorted chronologically (oldest first for Recharts).
     *
     * @param   {string} userId
     * @returns {Promise<Array>}
     */
    async getHistory(userId) {
        await this._backfillActuals(userId);

        const records = await PredictionHistory
            .find({ userId })
            .sort({ forecastMonth: 1 })
            .limit(12)
            .lean();

        return records.map(r => ({
            month:            moment(r.forecastMonth).format('MMM YYYY'),
            predictedExpense: r.predictedExpense,
            predictedSavings: r.predictedSavings,
            actualExpense:    r.actualExpense,
            actualSavings:    r.actualSavings,
            confidence:       r.confidence,
            accuracyPercent:  r.accuracyPercent,
            trend:            r.trend,
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Core algorithm
    // ═══════════════════════════════════════════════════════════════════════════

    async _compute(userId, d) {
        const monthlyAmounts = d.monthlyTrends.map(m => m.amount);
        const dataMonths     = monthlyAmounts.length;

        // ── WMA prediction ───────────────────────────────────────────────────
        const wmaPrediction = weightedMovingAverage(monthlyAmounts);

        // ── LR prediction ────────────────────────────────────────────────────
        const { slope, r2, nextValue: lrPrediction } = linearRegression(monthlyAmounts);

        // ── Blend based on data richness ─────────────────────────────────────
        // weight → 0 when < 3 months data (rely on WMA)
        // weight → 1 when ≥ 6 months data (rely on LR)
        const blendWeight    = Math.min(dataMonths / 6, 1);
        const blendedExpense = Math.max(0, Math.round(
            (1 - blendWeight) * wmaPrediction + blendWeight * lrPrediction
        ));

        // ── Confidence ───────────────────────────────────────────────────────
        // R² × data-richness factor (low confidence when few months of data)
        const dataRichness   = Math.min(dataMonths / 6, 1);
        const confidence     = Math.round(r2 * dataRichness * 100);

        // ── Algorithm label ──────────────────────────────────────────────────
        const algorithm = dataMonths < 3 ? 'wma'
            : dataMonths < 5             ? 'blended'
            :                              'linear_regression';

        // ── Predicted savings ─────────────────────────────────────────────────
        // Use current monthly income as the income forecast (simple, reasonable default)
        const predictedSavings = Math.round(d.monthlyIncome - blendedExpense);

        // ── Category-wise predictions (WMA per category) ──────────────────────
        const categoryPredictions = this._predictByCategory(d.categoryHistory);

        return {
            predictedExpense: blendedExpense,
            predictedSavings,
            algorithm,
            confidence,
            trend:      trendFromSlope(slope),
            dataMonths,
            slope,
            wmaPrediction:  Math.round(wmaPrediction),
            lrPrediction:   Math.max(0, Math.round(lrPrediction)),
            monthlyIncome:  d.monthlyIncome,
            categoryPredictions,
        };
    }

    /**
     * For each tracked category, apply WMA to its last-3-month totals.
     *
     * @param {Object} categoryHistory — { category: [{month, total}] }
     * @returns {Array<{category, predictedAmount}>}
     */
    _predictByCategory(categoryHistory) {
        return Object.entries(categoryHistory)
            .map(([category, monthlyData]) => {
                const values         = monthlyData.map(m => m.total);
                const predictedAmount = Math.round(weightedMovingAverage(values));
                return { category, predictedAmount };
            })
            .sort((a, b) => b.predictedAmount - a.predictedAmount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Backfill actuals for past predictions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Finds all past predictions whose `forecastMonth` has already passed and
     * `actualExpense` is still null, then fills in the real values from the DB.
     *
     * This automatically populates the "actual vs predicted" chart data.
     *
     * @param {string} userId
     */
    async _backfillActuals(userId) {
        const now  = new Date();
        const past = await PredictionHistory.find({
            userId,
            forecastMonth: { $lt: now },
            actualExpense: null,
        });

        for (const pred of past) {
            const year  = moment(pred.forecastMonth).year();
            const month = moment(pred.forecastMonth).month() + 1;

            try {
                const data = await financeDataService.getMonthlyReportData(userId, year, month);
                if (data.transactionCount > 0) {
                    pred.actualExpense  = data.totalExpense;
                    pred.actualSavings  = data.netSavings;
                    pred.accuracyPercent = data.totalExpense > 0
                        ? Math.round(Math.abs(pred.predictedExpense - data.totalExpense) / data.totalExpense * 100)
                        : null;
                    await pred.save();
                }
            } catch {
                // Non-fatal: leave actuals as null if data unavailable
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Format DB record into API response
    // ═══════════════════════════════════════════════════════════════════════════

    _formatResult(record, computedData = {}) {
        return {
            forecastMonth:       moment(record.forecastMonth).format('MMMM YYYY'),
            predictedExpense:    record.predictedExpense,
            predictedSavings:    record.predictedSavings,
            confidence:          record.confidence,
            trend:               record.trend,
            algorithm:           record.algorithm,
            dataMonths:          record.dataMonths,
            categoryPredictions: record.categoryPredictions || [],
            // Extra computed fields not stored in DB
            wmaPrediction:       computedData.wmaPrediction  || null,
            lrPrediction:        computedData.lrPrediction   || null,
            monthlyIncome:       computedData.monthlyIncome  || null,
            generatedAt:         record.createdAt,
        };
    }
}

module.exports = new PredictionService();
