'use strict';

const healthScoreService = require('../services/healthScoreService');

/**
 * GET /api/v1/finance/health-score
 * Returns the deterministic financial health score for the authenticated user.
 */
exports.getHealthScore = async (req, res) => {
    try {
        const result = await healthScoreService.calculateScore(req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[healthScoreController]', error.message);
        const status = error.message.includes('No transactions') ? 404 : 500;
        res.status(status).json({ message: error.message });
    }
};
