'use strict';

const express    = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getHistory, sendMessage, clearHistory } = require('../controllers/chatController');

const router = express.Router();

router.get('/history', protect, getHistory);
router.post('/message', protect, sendMessage);
router.delete('/clear', protect, clearHistory);

module.exports = router;
