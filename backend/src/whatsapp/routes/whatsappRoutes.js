const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// @desc    Meta WhatsApp Cloud API webhook verification
// @route   GET /webhooks/whatsapp
router.get('/whatsapp', webhookController.verifyWebhook);

// @desc    Receive inbound WhatsApp Cloud API events
// @route   POST /webhooks/whatsapp
router.post('/whatsapp', webhookController.receiveWebhook);

module.exports = router;
