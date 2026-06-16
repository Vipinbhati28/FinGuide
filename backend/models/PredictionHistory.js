'use strict';

const mongoose = require('mongoose');

/**
 * Records a prediction generated for a future month, along with actuals once
 * that month has passed. This enables "predicted vs actual" accuracy tracking.
 *
 * Workflow:
 *   1. predictionService generates a forecast → saved here with actualExpense = null.
 *   2. On next visit after the forecast month passes, predictionService fills in
 *      actualExpense and actualSavings from the real transaction data.
 */

const CategoryPredictionSchema = new mongoose.Schema(
    {
        category:       { type: String, required: true },
        predictedAmount:{ type: Number, required: true },
        actualAmount:   { type: Number, default: null },
    },
    { _id: false }
);

const PredictionHistorySchema = new mongoose.Schema(
    {
        userId: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: true,
            index:    true,
        },

        // The calendar month this prediction is FOR (stored as first day of that month)
        forecastMonth: {
            type:     Date,
            required: true,
        },

        // ── Prediction outputs ───────────────────────────────────────────────
        predictedExpense:  { type: Number, required: true },
        predictedSavings:  { type: Number, required: true },
        categoryPredictions: [CategoryPredictionSchema],

        // Algorithm metadata
        algorithm: {
            type:    String,
            enum:    ['wma', 'linear_regression', 'blended'],
            default: 'blended',
        },
        confidence: { type: Number, min: 0, max: 100, required: true }, // R² × 100
        trend:      { type: String, enum: ['increasing', 'decreasing', 'stable'], required: true },
        dataMonths: { type: Number, required: true }, // how many months of history were used

        // ── Actuals (filled in after the forecast month passes) ──────────────
        actualExpense:  { type: Number, default: null },
        actualSavings:  { type: Number, default: null },
        accuracyPercent:{ type: Number, default: null }, // abs(predicted-actual)/actual × 100
    },
    { timestamps: true } // generatedAt = createdAt
);

// Compound unique index: one prediction per user per forecast month
PredictionHistorySchema.index({ userId: 1, forecastMonth: 1 }, { unique: true });

module.exports = mongoose.model('PredictionHistory', PredictionHistorySchema);
