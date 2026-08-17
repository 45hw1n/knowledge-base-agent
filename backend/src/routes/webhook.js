const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// @desc    Receive Pub/Sub notifications from Gmail
// @route   POST /webhook/gmail
router.post('/gmail', webhookController.handlePubSubNotification);

// @desc    Health check for webhook endpoint
// @route   GET /webhook/gmail
router.get('/gmail', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Gmail webhook endpoint is active'
  });
});

module.exports = router;
