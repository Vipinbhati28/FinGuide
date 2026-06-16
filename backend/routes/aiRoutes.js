'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getHealthScore,
    getBudgetRecommendation,
    getSpendingAnalysis,
    getExpensePrediction,
    chat,
    processVoice,
    getMonthlyReport,
    downloadMonthlyReport,
    runAllAnalysis,
} = require('../controllers/aiController');

// All routes require a valid JWT
router.get('/health-score',            protect, getHealthScore);
router.get('/budget-recommendation',   protect, getBudgetRecommendation);
router.get('/spending-analysis',       protect, getSpendingAnalysis);
router.get('/expense-prediction',      protect, getExpensePrediction);
router.post('/chat',                   protect, chat);
router.post('/voice',                  protect, processVoice);
router.get('/monthly-report',          protect, getMonthlyReport);
router.get('/monthly-report/download', protect, downloadMonthlyReport);
router.get('/all',                     protect, runAllAnalysis);

module.exports = router;
