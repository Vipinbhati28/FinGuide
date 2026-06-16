'use strict';

/**
 * constants.js — Central store for all TTL values, limits, and shared config.
 *
 * Keeping these in one place means you can tune caching behaviour without
 * hunting through six different files.
 */

// ─── Cache TTLs (milliseconds) ────────────────────────────────────────────────
const TTL = {
    /** Shared financial context — prevents duplicate DB round-trips in a page burst. */
    CONTEXT:          2 * 60 * 1000,   // 2 min

    /** Health score — recalculate at most every 30 min. */
    HEALTH_SCORE:    30 * 60 * 1000,   // 30 min

    /** Budget advice — monthly patterns don't shift minute-to-minute. */
    BUDGET_ADVICE:   30 * 60 * 1000,   // 30 min

    /** Spending analysis — 6-month aggregates; very stable. */
    SPENDING:        60 * 60 * 1000,   // 1 hr

    /** Expense prediction — re-run hourly is sufficient. */
    PREDICTION:      60 * 60 * 1000,   // 1 hr

    /** Monthly report — past months are immutable; cache aggressively. */
    MONTHLY_REPORT:   2 * 60 * 60 * 1000, // 2 hr
};

// ─── Chat Limits ──────────────────────────────────────────────────────────────
const CHAT = {
    MAX_HISTORY_MESSAGES: 200,   // MongoDB cap per user
    CONTEXT_WINDOW_MSGS:   20,   // messages sent to Gemini per request
};

// ─── API Rate Limits ──────────────────────────────────────────────────────────
const RATE_LIMIT = {
    /** Standard endpoints — generous for normal UI usage. */
    GENERAL: { windowMs: 15 * 60 * 1000, max: 200 },   // 200 req / 15 min

    /** AI endpoints — Gemini has its own quotas; be conservative. */
    AI:      { windowMs: 60 * 1000,      max: 20  },   // 20 req / min

    /** Auth endpoints — prevent brute-force. */
    AUTH:    { windowMs: 15 * 60 * 1000, max: 20  },   // 20 req / 15 min
};

// ─── Prediction Engine ────────────────────────────────────────────────────────
const PREDICTION = {
    WMA_WEIGHTS:  [1, 2, 3],    // weights for weighted moving average (newest = last)
    BLEND_MONTHS: 6,             // months of data before LR is fully weighted
};

// ─── Health Score Grades ──────────────────────────────────────────────────────
const HEALTH_GRADE = {
    EXCELLENT: 80,
    GOOD:      60,
    AVERAGE:   40,
    // below 40 → Poor
};

module.exports = { TTL, CHAT, RATE_LIMIT, PREDICTION, HEALTH_GRADE };
