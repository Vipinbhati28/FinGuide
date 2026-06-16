'use strict';

const express     = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getHealthScore } = require('../controllers/healthScoreController');

const router = express.Router();

router.get('/health-score', protect, getHealthScore);

module.exports = router;
