'use strict';

const express     = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getCurrentPrediction, getPredictionHistory } = require('../controllers/predictionController');

const router = express.Router();

router.get('/current', protect, getCurrentPrediction);
router.get('/history', protect, getPredictionHistory);

module.exports = router;
