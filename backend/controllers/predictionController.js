'use strict';

const predictionService = require('../services/predictionService');

/**
 * GET /api/v1/predictions/current
 * Generates (or returns cached) next-month prediction for the authenticated user.
 */
exports.getCurrentPrediction = async (req, res) => {
    try {
        const result = await predictionService.generatePrediction(req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[predictionController:getCurrent]', error.message);
        const status = error.message.includes('No transactions') ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
};

/**
 * GET /api/v1/predictions/history
 * Returns the last 12 months of prediction records with actuals backfilled.
 */
exports.getPredictionHistory = async (req, res) => {
    try {
        const history = await predictionService.getHistory(req.user.id);
        res.json({ history });
    } catch (error) {
        console.error('[predictionController:getHistory]', error.message);
        res.status(500).json({ message: error.message });
    }
};
